import type { SQLiteDatabase } from 'expo-sqlite';
import { historyKey, historyPage, historyPageLimit, historyScope, historyText, historyTerms,
  messageBytes, RECENT_BYTE_LIMIT, type HistoryQuery, type LoungeHistoryStore,
} from '../../../../shared/lounge/archive';
import { parseMessage, type LoungeMessage } from '../../../../shared/lounge/types';

let database: Promise<SQLiteDatabase> | undefined;
let pending: Promise<unknown> = Promise.resolve();
const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS messages (
  scope TEXT NOT NULL, key TEXT NOT NULL, time INTEGER NOT NULL,
  search TEXT NOT NULL, content TEXT NOT NULL, PRIMARY KEY (scope, key)
);
CREATE INDEX IF NOT EXISTS timeline ON messages(scope, time, key);`;

async function open() {
  const { openDatabaseAsync } = await import('expo-sqlite');
  const db = await openDatabaseAsync('lounge-history-v1.db');
  try { await db.execAsync(SCHEMA); }
  catch (error) { await db.closeAsync(); throw error; }
  return db;
}

/** Serializes connection initialization and access; failed operations can be retried. */
function withDatabase<T>(operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const result = pending.then(async () => {
    database ??= open().catch((error: unknown) => { database = undefined; throw error; });
    return operation(await database);
  });
  pending = result.catch(() => { /* The caller receives the error; later operations may recover. */ });
  return result;
}

async function search(db: SQLiteDatabase, scope: string, query: HistoryQuery) {
  const terms = historyTerms(query.query);
  const conditions = ['scope = ?', ...terms.map(() => "search LIKE ? ESCAPE '\\'")];
  const parameters: (string | number)[] = [scope,
    ...terms.map(term => `%${term.replace(/[\\%_]/g, '\\$&')}%`)];
  if (query.before) {
    conditions.push('(time < ? OR (time = ? AND key < ?))');
    parameters.push(query.before.time, query.before.time, query.before.key);
  }
  // Select keys first so image-heavy pages never allocate the full matched payload set.
  const rows = await db.getAllAsync<{ key: string }>(
    `SELECT key FROM messages WHERE ${conditions.join(' AND ')} ORDER BY time DESC, key DESC LIMIT ?`,
    ...parameters, historyPageLimit(query) + 1);
  const messages: LoungeMessage[] = [];
  let bytes = 0;
  for (const row of rows) {
    const stored = await db.getFirstAsync<{ content: string }>(
      'SELECT content FROM messages WHERE scope = ? AND key = ?', scope, row.key);
    const message = stored && parseMessage(JSON.parse(stored.content));
    if (!message) continue;
    messages.push(message); bytes += messageBytes(message);
    if (bytes > RECENT_BYTE_LIMIT) break;
  }
  return historyPage(messages, query);
}

/** A durable local archive, isolated by server and account, separate from the chat cache. */
export function nativeLoungeHistory(baseUrl: string, account: string): LoungeHistoryStore {
  const scope = historyScope(baseUrl, account);
  return {
    save: message => withDatabase(async db => {
      await db.runAsync('INSERT OR REPLACE INTO messages(scope, key, time, search, content) VALUES (?, ?, ?, ?, ?)',
        scope, historyKey(message), Date.parse(message.sentAt), historyText(message), JSON.stringify(message));
    }),
    page: query => withDatabase(db => search(db, scope, query)),
  };
}
