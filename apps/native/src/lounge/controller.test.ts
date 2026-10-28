import { afterEach, expect, it, vi } from 'vitest';
import { LoungeController } from '../../../../shared/lounge/controller';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor() { Socket.instances.push(this); }
  frame(value: object) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Socket.instances = []; });

it('runs without a DOM, reconnects on foreground, and clears only visible messages and session data', async () => {
  vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
  expect(typeof document).toBe('undefined');
  let active = true;
  let wake = () => {};
  const cleanup = vi.fn();
  const controller = new LoungeController({ baseUrl: 'https://chat.test', authorize: async () => ({ ticket: 'test' }) },
    { isVisible: () => active, randomId: () => 'native-id', subscribe: listener => { wake = listener; return cleanup; } });
  controller.start(); await settle();
  const socket = Socket.instances[0];
  socket.frame({ type: 'ready', user: { id: 'me', account: 'me@test' } });
  const incoming = (id: string) => socket.frame({ type: 'message', id, text: id, images: [],
    sender: { id: 'other', account: 'other@test' }, sentAt: new Date().toISOString() });
  incoming('background-page'); expect(controller.snapshot().unread).toBe(1);
  controller.setViewing(true); expect(controller.snapshot().unread).toBe(0);
  active = false; wake(); incoming('background-app'); expect(controller.snapshot().unread).toBe(1);
  active = true; wake(); expect(controller.snapshot().unread).toBe(0);
  const pending = controller.send({ text: 'keep draft on failure', images: [] }).catch(error => error.message);
  expect(JSON.parse(socket.send.mock.calls.at(-1)![0]).id).toBe('native-id');
  socket.onclose?.(); expect(await pending).toBe('client.lounge.sendFailed');
  wake(); await settle(); expect(Socket.instances).toHaveLength(2);
  controller.stop(); expect(cleanup).toHaveBeenCalledOnce();
  expect(controller.snapshot().messages).toEqual([]); expect(controller.snapshot().unread).toBe(0);
});
