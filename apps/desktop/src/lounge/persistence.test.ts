// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { LoungeController } from '../../../../shared/lounge/controller';
import { historyPage, type LoungeHistoryStore } from '../../../../shared/lounge/archive';
import type { LoungeMessage } from '../../../../shared/lounge/types';

class Socket {
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose = null;
  onerror = null;
  close() {}
  constructor() { Socket.instances.push(this); }
  frame(frame: unknown) { this.onmessage?.({ data: JSON.stringify(frame) }); }
}
const message = (id: string): LoungeMessage => ({ type: 'message', id, text: `message ${id}`, images: [],
  sender: { id: 'bob', account: 'bob@example.test' }, sentAt: new Date().toISOString() });
const controllers: LoungeController[] = [];
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function start(history: LoungeHistoryStore, offline = false) {
  vi.stubGlobal('WebSocket', Socket);
  const controller = new LoungeController({ baseUrl: 'https://cloud.test', history,
    authorize: async () => { if (offline) throw new Error('offline'); return { ticket: 'ticket' }; } });
  controllers.push(controller); controller.start(); return controller;
}
afterEach(() => { controllers.splice(0).forEach(value => value.stop()); vi.unstubAllGlobals(); Socket.instances = []; });

it('archives receipt once, restores while offline without unread, and keeps history on logout', async () => {
  const rows: LoungeMessage[] = [];
  const store = { save: vi.fn(async (value: LoungeMessage) => { rows.push(value); }),
    page: vi.fn(async () => historyPage([...rows].reverse(), { query: '' })) };
  const first = start(store); await settle();
  const socket = Socket.instances[0];
  socket.frame({ type: 'ready', user: { id: 'alice', account: 'alice@example.test' } });
  const received = message('one'); socket.frame(received); socket.frame(received);
  expect(first.snapshot().unread).toBe(1);
  await first.searchHistory({ query: '' }); expect(store.save).toHaveBeenCalledTimes(1);
  first.stop(); expect(first.snapshot().messages).toEqual([]);
  const reopened = start(store, true); await settle();
  expect(reopened.snapshot().messages).toEqual([received]);
  expect(reopened.snapshot().unread).toBe(0);
  expect(reopened.snapshot().status).toBe('connecting');
});

it('merges an asynchronous restore with live arrivals and ignores results after account disposal', async () => {
  let restore: (value: { messages: LoungeMessage[] }) => void = () => {};
  const store = { save: vi.fn(async () => {}), page: () => new Promise<{ messages: LoungeMessage[] }>(resolve => {
    restore = resolve;
  }) };
  const controller = start(store); await settle();
  Socket.instances[0].frame({ type: 'ready', user: { id: 'alice', account: 'alice@example.test' } });
  const live = message('live'); Socket.instances[0].frame(live);
  restore({ messages: [message('old')] }); await settle();
  expect(controller.snapshot().messages.map(item => item.id)).toEqual(expect.arrayContaining(['live', 'old']));
  expect(controller.snapshot().unread).toBe(1);
  controller.stop(); controller.start(); await settle(); controller.stop();
  restore({ messages: [message('private')] }); await settle();
  expect(controller.snapshot().messages).toEqual([]);
  expect(controller.snapshot().unread).toBe(0);
});

it('reports failed persistence, retries received content, and clears the warning only after success', async () => {
  const store = { save: vi.fn(async () => {}), page: vi.fn(async () => ({ messages: [] as LoungeMessage[] })) };
  const controller = start(store); await settle();
  Socket.instances[0].frame({ type: 'ready', user: { id: 'alice', account: 'alice@example.test' } });
  store.save.mockRejectedValueOnce(new Error('disk full'));
  Socket.instances[0].frame(message('failed')); await settle();
  expect(controller.snapshot().historyError).toBe(true);
  store.page.mockRejectedValueOnce(new Error('disk full'));
  await controller.retryHistory(); expect(controller.snapshot().historyError).toBe(true);
  await controller.retryHistory(); expect(controller.snapshot().historyError).toBe(false);
  expect(store.save).toHaveBeenCalledTimes(3);
});

it('paginates the memory fallback without repeating equal-timestamp messages', async () => {
  const rows = ['a', 'b', 'c'].map(message);
  // Exercise the fallback via received messages, without a persistence adapter.
  const live = new LoungeController({ baseUrl: 'https://cloud.test', authorize: async () => ({ ticket: 'ticket' }) });
  vi.stubGlobal('WebSocket', Socket); controllers.push(live); live.start(); await settle();
  Socket.instances[0].frame({ type: 'ready', user: { id: 'alice', account: 'alice@example.test' } });
  rows.forEach(value => Socket.instances[0].frame(value));
  const first = await live.searchHistory({ query: '', limit: 2 });
  const second = await live.searchHistory({ query: '', limit: 2, before: first.next });
  expect(first.messages).toHaveLength(2); expect(second.messages).toHaveLength(1);
  expect(new Set([...first.messages, ...second.messages].map(value => value.id)).size).toBe(3);
  expect(second.next).toBeUndefined();
});
