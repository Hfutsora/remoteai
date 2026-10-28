// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { LoungeController } from '../../../../shared/lounge/controller';
import type { LoungeMessage } from '../../../../shared/lounge/types';
import type { LoungeContact } from '../../../../shared/lounge/contacts';
import { historyPage, type LoungeHistoryStore } from '../../../../shared/lounge/archive';

const alice = { id: 'alice', account: 'alice@example.test' };
const bob = { id: 'bob', account: 'bob@example.test' };
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror = null;
  readyState = 1; bufferedAmount = 0;
  send = vi.fn(); close() {}
  constructor() { Socket.instances.push(this); }
  frame(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
  ready(direct = true) { this.frame({ type: 'ready', user: alice, direct, receipts: true, blocked: [] }); }
}
const controllers: LoungeController[] = [];
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
async function start(history?: LoungeHistoryStore) {
  vi.stubGlobal('WebSocket', Socket);
  const controller = new LoungeController({ baseUrl: 'https://chat.test', account: alice.account, history,
    authorize: async () => ({ ticket: 'fixture' }) },
  { isVisible: () => true, subscribe: () => () => {}, randomId: () => crypto.randomUUID() });
  controllers.push(controller); controller.start(); await settle();
  return { controller, socket: Socket.instances.at(-1)! };
}
const message = (id: string, direct = false): LoungeMessage => ({ type: 'message', id, sender: bob,
  recipient: direct ? alice : undefined, text: id, images: [], sentAt: new Date().toISOString() });
afterEach(() => { controllers.splice(0).forEach(value => value.stop()); Socket.instances = []; vi.unstubAllGlobals(); });

it('isolates private timelines and unread counts without clearing other conversations', async () => {
  const { controller, socket } = await start(); socket.ready(); controller.setViewing(true);
  socket.frame(message('group')); socket.frame(message('private', true));
  expect(controller.snapshot().messages.map(value => value.id)).toEqual(['group']);
  expect(controller.snapshot().unread).toBe(1);
  expect(controller.snapshot().contacts[0].direct).toBe(true);
  controller.selectConversation(bob);
  expect(controller.snapshot().messages.map(value => value.id)).toEqual(['private']);
  expect(controller.snapshot().unread).toBe(0);
  socket.frame(message('another-group'));
  expect(controller.snapshot().unreadByConversation['']).toBe(1);
  expect((await controller.searchHistory({ query: '' })).messages.map(value => value.id)).toEqual(['private']);
  controller.selectConversation(); expect(controller.snapshot().unread).toBe(0);
  expect(controller.snapshot().messages.map(value => value.id)).toEqual(['group', 'another-group']);
});

it('enforces one-way blocks for new incoming content while retaining history and allowing outbound messages', async () => {
  const { controller, socket } = await start(); socket.ready();
  socket.frame(message('before'));
  socket.frame({ type: 'privacy', blocked: [bob] });
  socket.frame(message('hidden-group')); socket.frame(message('hidden-direct', true));
  expect(controller.snapshot().messages.map(value => value.id)).toEqual(['before']);
  controller.selectConversation(bob);
  socket.frame({ type: 'contacts', contacts: [{ id: bob.id, online: true }] });
  expect(controller.snapshot().contacts[0].online).toBe(true);
  const sending = controller.send({ text: 'outbound', images: [], to: bob.id });
  await sending;
  const frame = JSON.parse(socket.send.mock.calls.at(-1)![0]);
  expect(frame.to).toBe(bob.id);
  socket.frame({ ...message(frame.id), sender: alice, recipient: bob, text: frame.text }); await sending;
  expect(controller.snapshot().messages[0].text).toBe('outbound');
  socket.frame({ type: 'privacy', blocked: [] });
  socket.frame(message('unblocked', true));
  expect(controller.snapshot().messages.at(-1)?.text).toBe('unblocked');
});

it('never sends private content to old servers and clears online state after disconnect', async () => {
  const { controller, socket } = await start(); socket.ready(false);
  await expect(controller.send({ text: 'secret', images: [], to: bob.id })).rejects.toThrow('directUnavailable');
  expect(socket.send.mock.calls).toHaveLength(0);
  socket.ready(); controller.selectConversation(bob);
  socket.frame({ type: 'contacts', contacts: [{ id: bob.id, online: null }] });
  expect(controller.snapshot().contacts[0].online).toBeNull();
  socket.onclose?.(); expect(controller.snapshot().contacts[0].online).toBeUndefined();
});

it('restores people and separate private history without storing presence or historical unread', async () => {
  const rows: LoungeMessage[] = []; let people: LoungeContact[] = [];
  const store: LoungeHistoryStore = {
    save: async value => { rows.push(value); },
    page: async query => historyPage(rows.filter(value => (value.conversation ?? '') === query.conversation), query),
    saveContact: async value => { people = [{ user: value.user, direct: value.direct }]; },
    contacts: async () => people,
  };
  const first = await start(store); first.socket.ready();
  first.socket.frame(message('private-local', true)); await settle(); first.controller.stop();
  const next = await start(store); next.socket.ready();
  expect(next.controller.snapshot().contacts).toEqual([{ user: bob, direct: true }]);
  expect(next.controller.snapshot().messages).toHaveLength(0);
  next.controller.selectConversation(bob); await settle();
  expect(next.controller.snapshot().messages[0].text).toBe('private-local');
  expect(next.controller.snapshot().unread).toBe(0);
});
