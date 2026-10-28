// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoungeController } from '../../../../shared/lounge/controller';
import { browserAvatarStore } from '../../../../shared/lounge/avatar';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  bufferedAmount = 0;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; });
  constructor(readonly url: string) { Socket.instances.push(this); }
  frame(frame: unknown) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  ready() { this.frame({ type: 'ready', user: { id: 'self', account: 'alice@example.test' } }); }
  message(id: string, own = false) {
    this.frame({ type: 'message', id, sender: { id: own ? 'self' : 'other', account: 'bob@example.test' },
      text: 'hello 😀', images: [], sentAt: new Date().toISOString() });
  }
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let controller: LoungeController;
let authorization = vi.fn(async () => ({ ticket: 'ticket' }));
beforeEach(async () => {
  vi.useFakeTimers(); Socket.instances = [];
  vi.stubGlobal('WebSocket', Socket);
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  authorization = vi.fn(async () => ({ ticket: 'ticket' }));
  localStorage.clear();
  controller = new LoungeController({ baseUrl: 'https://example.test', authorize: authorization,
    avatars: browserAvatarStore('https://example.test') });
  controller.start(); await settle();
});
afterEach(() => { controller.stop(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('application lifetime lounge', () => {
  it('saves only the selected avatar and includes it with new messages across reconnects', async () => {
    const avatar = 'data:image/png;base64,AAAA';
    const socket = Socket.instances[0]; socket.ready();
    controller.setAvatar(avatar);
    expect(controller.snapshot().user?.avatar).toBe(avatar);
    const sending = controller.send({ text: 'private message', images: [] });
    const frame = JSON.parse(socket.send.mock.calls.at(-1)![0]);
    expect(frame.avatar).toBe(avatar);
    socket.message(frame.id, true); await sending;
    socket.ready(); expect(controller.snapshot().user?.avatar).toBe(avatar);
    expect(JSON.stringify(localStorage)).not.toContain('private message');
    controller.setAvatar('');
    socket.ready(); expect(controller.snapshot().user?.avatar).toBeUndefined();
  });
  it('connects without opening the page, counts background messages, and clears only when visible', () => {
    const socket = Socket.instances[0];
    expect(String(socket.url)).toBe('wss://example.test/lounge/socket');
    socket.onopen?.(); expect(socket.send).toHaveBeenCalledWith('{"type":"authenticate","ticket":"ticket"}');
    socket.ready(); socket.message('one'); socket.message('one'); socket.message('own', true);
    expect(controller.snapshot().unread).toBe(1);
    expect(controller.snapshot().messages).toHaveLength(2);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    controller.setViewing(true); socket.message('two'); expect(controller.snapshot().unread).toBe(2);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    window.dispatchEvent(new Event('focus')); expect(controller.snapshot().unread).toBe(0);
    controller.setViewing(false); socket.message('three'); expect(controller.snapshot().unread).toBe(1);
  });
  it('reconnects after loss without requesting missed messages or resending pending messages', async () => {
    const socket = Socket.instances[0]; socket.ready(); socket.message('before');
    const sent = controller.send({ text: 'draft', images: [] }).catch(error => error.message);
    socket.onclose?.(); expect(await sent).toBe('client.lounge.sendFailed');
    await vi.advanceTimersByTimeAsync(1000); await settle();
    const next = Socket.instances[1]; next.onopen?.(); next.ready();
    expect(next.send.mock.calls).toEqual([['{"type":"authenticate","ticket":"ticket"}']]);
    expect(controller.snapshot().messages).toHaveLength(1);
  });
  it('acknowledges only the authenticated sender echo and keeps renewal on the same connection', async () => {
    const socket = Socket.instances[0]; socket.ready();
    let confirmed = false;
    const sending = controller.send({ text: 'draft', images: [] }).then(() => { confirmed = true; });
    const id = JSON.parse(socket.send.mock.calls[0][0]).id as string;
    socket.message(id); await settle(); expect(confirmed).toBe(false);
    socket.message(id, true); await sending; expect(confirmed).toBe(true);
    for (let i = 0; i < 13; i++) {
      socket.frame({ type: 'pong' }); await vi.advanceTimersByTimeAsync(20_000);
      if (i === 11) socket.ready();
    }
    expect(authorization).toHaveBeenCalledTimes(2);
    expect(Socket.instances).toHaveLength(1);
  });
  it('recovers stale connections and rejects oversized or malformed incoming images', async () => {
    const socket = Socket.instances[0]; socket.ready();
    socket.frame({ type: 'message', id: 'bad', sender: { id: 'other', account: 'bob' },
      text: 'x', images: ['https://tracking.example/pixel'], sentAt: new Date().toISOString() });
    expect(controller.snapshot().messages).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(81_000);
    expect(socket.close).toHaveBeenCalled(); expect(Socket.instances.length).toBeGreaterThan(1);
  });
  it('bounds received history and clears it on logout', () => {
    const socket = Socket.instances[0]; socket.ready();
    for (let i = 0; i < 240; i++) socket.message(`message-${i}`);
    expect(controller.snapshot().messages).toHaveLength(200);
    controller.stop(); expect(controller.snapshot().messages).toHaveLength(0);
    expect(controller.snapshot().unread).toBe(0);
  });
  it('applies moderation without unread messages and refuses sending until the mute expires', async () => {
    const socket = Socket.instances[0]; socket.ready();
    socket.frame({ type: 'policy', policy: { moderator: true, mutedUntil: null } });
    expect(controller.snapshot().policy.moderator).toBe(true);
    const updating = controller.moderate('target', 60);
    const request = JSON.parse(socket.send.mock.calls.at(-1)![0]);
    expect(request).toMatchObject({ type: 'moderate', userId: 'target', minutes: 60 });
    socket.frame({ type: 'moderated', id: request.id }); await updating;
    socket.frame({ type: 'policy', policy: { moderator: false, mutedUntil: new Date(Date.now() + 1000).toISOString() } });
    await expect(controller.send({ text: 'blocked', images: [] })).rejects.toThrow('client.lounge.muted');
    expect(controller.snapshot().unread).toBe(0);
    expect(controller.snapshot().messages).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1001);
    const sending = controller.send({ text: 'after expiry', images: [] });
    socket.message(JSON.parse(socket.send.mock.calls.at(-1)![0]).id, true);
    await sending;
  });
});
