import { utf8ToBytes } from '@noble/hashes/utils';
import type { SessionCipher } from './cipher';
import { decodeChatUtf8 } from './utf8';
import { compressedPacket, compressedPacketBody, MAX_PACKET_PLAIN_BYTES, MIN_COMPRESSION_BYTES,
  type PacketCompression } from './packetCompression';

const MAX_PENDING_PACKETS = 64;

/** Async native work is bounded independently of delivery windows; control frames never wait behind it. */
export class CompressedPackets {
  private readonly sending = new Set<string>();
  private receiving = 0;
  private closed = false;

  constructor(private readonly codec: PacketCompression, private readonly cipher: SessionCipher,
    private readonly failed: () => void, private readonly drained: () => void = () => {}) {}

  get bufferedAmount() { return this.sending.size * MAX_PACKET_PLAIN_BYTES; }

  send(key: string, text: string, write: (payload: string) => void): boolean {
    if (this.closed) return false;
    if (this.sending.has(key)) return true;
    if (this.sending.size >= MAX_PENDING_PACKETS) return false;
    const bytes = utf8ToBytes(text);
    if (bytes.length > MAX_PACKET_PLAIN_BYTES) throw new Error('Invalid packet');
    if (bytes.length < MIN_COMPRESSION_BYTES) { write(this.cipher.encrypt(text)); return true; }
    this.sending.add(key);
    void this.codec.compress(bytes).then(compressed => {
      if (this.closed) return;
      const packet = compressedPacket(bytes, compressed);
      write(packet ? this.cipher.encryptCompressed(packet) : this.cipher.encrypt(text));
    }).catch(() => { if (!this.closed) this.failed(); }).finally(() => {
      this.sending.delete(key);
      if (!this.closed) this.drained();
    });
    return true;
  }

  receive(payload: string, accept: (text: string) => void) {
    if (this.closed) return;
    // Both delivery lanes and retry paths can burst together. Leave overflow unacknowledged
    // so delivery retries it after native capacity returns, without growing the work queue.
    if (this.receiving >= MAX_PENDING_PACKETS) return;
    // Authenticate and reject replays before allocating the bounded decompression output.
    const packet = this.cipher.decryptCompressed(payload);
    if (packet === null) return;
    const { bytes, length } = compressedPacketBody(packet);
    this.receiving++;
    void this.codec.decompress(bytes, length).then(plain => {
      if (this.closed) return;
      if (plain.length !== length) throw new Error('Invalid decompressed length');
      accept(decodeChatUtf8(plain));
    }).catch(() => { if (!this.closed) this.failed(); }).finally(() => { this.receiving--; });
  }

  close() { this.closed = true; this.sending.clear(); this.codec.close(); }
}

/** This is routing only; SessionCipher authenticates the nonce before accepting the flag. */
export function isCompressedPacket(payload: string) { return payload.slice(8, 16) === '00000001'; }
