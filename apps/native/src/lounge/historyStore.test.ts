import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import initSqlJs, { type Database, type BindParams } from 'sql.js';
import { nativeLoungeHistory } from './historyStore';
import { recentMessages } from '../../../../shared/lounge/archive';
import type { LoungeMessage } from '../../../../shared/lounge/types';

const state = vi.hoisted(() => ({ db: null as Database | null }));
vi.mock('expo-sqlite', () => {
  const all = (sql: string, args: unknown[]) => {
    const statement = state.db!.prepare(sql);
    try {
      statement.bind(args as BindParams);
      const result = [];
      while (statement.step()) result.push(statement.getAsObject());
      return result;
    } finally { statement.free(); }
  };
  return { openDatabaseAsync: async () => ({
    execAsync: async (sql: string) => { state.db!.exec(sql); },
    runAsync: async (sql: string, ...args: unknown[]) => { all(sql, args); },
    getAllAsync: async (sql: string, ...args: unknown[]) => all(sql, args),
    getFirstAsync: async (sql: string, ...args: unknown[]) => all(sql, args)[0] ?? null,
  }) };
});
let SQL: Awaited<ReturnType<typeof initSqlJs>>;
beforeAll(async () => { SQL = await initSqlJs(); state.db = new SQL.Database(); });
afterAll(() => state.db?.close());
const store = () => nativeLoungeHistory('https://cloud.test/', 'Alice@example.test');
const message = (id: string): LoungeMessage => ({ type: 'message', id, text: `hello ${id}`, images: [],
  sender: { id: 'bob', account: 'Bob@example.test' }, sentAt: '2026-10-28T00:00:00Z' });

it('persists receipt state and selects unfinished local jobs without resending completed messages', async () => {
  const history = nativeLoungeHistory('https://cloud.test', 'receipts');
  const outgoing: LoungeMessage = { ...message('pending'), recipient: { id: 'other', account: 'other' }, receipts: true,
    delivery: { direction: 'outgoing', status: 'pending', retry: true, attemptedAt: Date.now() } };
  await history.save(outgoing);
  const data = state.db!.export(); state.db!.close(); state.db = new SQL.Database(data);
  expect((await history.page({ query: '', pendingOnly: true })).messages).toHaveLength(1);
  expect((await history.get!('["bob","pending"]'))?.delivery?.status).toBe('pending');
  await history.save({ ...outgoing, delivery: { ...outgoing.delivery!, status: 'read' } });
  await history.save(outgoing);
  expect((await history.get!('["bob","pending"]'))?.delivery?.status).toBe('read');
  expect((await history.page({ query: '', pendingOnly: true })).messages).toHaveLength(0);
  const received: LoungeMessage = { ...outgoing, id: 'incoming',
    delivery: { direction: 'incoming', status: 'read', confirmed: 'delivered' } };
  await history.save(received);
  expect((await history.page({ query: '', pendingOnly: true })).messages.map(value => value.id)).toEqual(['incoming']);
  await history.save({ ...received, delivery: { ...received.delivery!, confirmed: 'read' } });
  expect((await history.page({ query: '', pendingOnly: true })).messages).toHaveLength(0);
});

it('keeps group and private searches separate and persists contacts without their online status', async () => {
  const history = nativeLoungeHistory('https://cloud.test', 'direct');
  const privateMessage = { ...message('secret'), conversation: 'bob', recipient: { id: 'alice', account: 'Alice' } };
  await history.save(message('group')); await history.save(privateMessage);
  await history.saveContact!({ user: privateMessage.sender, direct: true, online: true });
  const data = state.db!.export(); state.db!.close(); state.db = new SQL.Database(data);
  expect((await history.page({ query: '', conversation: '' })).messages.map(value => value.id)).toEqual(['group']);
  expect((await history.page({ query: '', conversation: 'bob' })).messages).toEqual([privateMessage]);
  expect(await history.contacts!()).toEqual([{ user: privateMessage.sender, direct: true }]);
});

it('preserves messages, images and avatars after reopening, without duplicating or sharing between accounts', async () => {
  const received = { ...message('picture'), images: ['data:image/png;base64,AAAA'],
    reply: { id: 'old', senderId: 'other', account: 'other@example.test', text: 'quoted-only', imageCount: 1 },
    sender: { id: 'bob', account: 'Bob@example.test', avatar: 'data:image/png;base64,AAAA' } };
  await store().save(received); await store().save(received);
  const data = state.db!.export(); state.db!.close(); state.db = new SQL.Database(data);
  const restored = await nativeLoungeHistory('https://cloud.test', 'alice@example.test').page({ query: '' });
  expect(restored.messages).toEqual([received]);
  expect((await store().page({ query: 'quoted-only' })).messages).toEqual([received]);
  expect(await nativeLoungeHistory('https://other.test', 'alice@example.test').page({ query: '' }))
    .toEqual({ messages: [] });
  expect(await nativeLoungeHistory('https://cloud.test', 'other@example.test').page({ query: '' }))
    .toEqual({ messages: [] });
});

it('searches older than the timeline limit with normalized terms and literal SQL wildcards', async () => {
  const archive = nativeLoungeHistory('https://cloud.test', 'search');
  const oldest = { ...message('old'), text: '唯一 100%_\\ old coffee', sentAt: '2026-01-01T00:00:00Z' };
  await archive.save(oldest);
  for (let index = 0; index < 210; index++) await archive.save(message(`new-${index}`));
  expect(recentMessages((await archive.page({ query: '', limit: 200 })).messages)).toHaveLength(200);
  expect((await archive.page({ query: 'ＢＯＢ 唯一 100%_\\' })).messages).toEqual([oldest]);
  expect((await archive.page({ query: '%missing' })).messages).toEqual([]);
  let page = await archive.page({ query: '' });
  const ids = page.messages.map(value => value.id);
  while (page.next) {
    page = await archive.page({ query: '', before: page.next }); ids.push(...page.messages.map(value => value.id));
  }
  expect(ids).toHaveLength(211); expect(new Set(ids).size).toBe(211); expect(ids.at(-1)).toBe('old');
});

it('limits image-heavy page memory while retaining all records for subsequent pages', async () => {
  const archive = nativeLoungeHistory('https://cloud.test', 'images');
  const image = `data:image/png;base64,${'A'.repeat(1024 * 1024)}`;
  for (let index = 0; index < 6; index++) {
    await archive.save({ ...message(`large-${index}`), images: [image, image, image] });
  }
  const first = await archive.page({ query: '' });
  expect(first.messages.length).toBeLessThan(6); expect(first.next).toBeDefined();
  const second = await archive.page({ query: '', before: first.next });
  expect(first.messages.length + second.messages.length).toBe(6);
  expect(second.next).toBeUndefined();
});
