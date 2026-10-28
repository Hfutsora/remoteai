import { historyKey, historyPage, historyPageLimit, historyScope, historyText, historyTerms,
  messageBytes, RECENT_BYTE_LIMIT,
  type HistoryQuery, type LoungeHistoryStore } from './archive';
import { parseMessage, type LoungeMessage } from './types';
import { mergeContact, parseContact, type LoungeContact } from './contacts';

const DATABASE = 'remoteai-lounge-history-v1';
const META = 'metadata';
const CONTENT = 'content';
const CONTACTS = 'contacts';
interface Metadata { scope: string; key: string; time: number; search: string; conversation?: string }
let opening: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  return opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(META)) {
        const metadata = request.result.createObjectStore(META, { keyPath: ['scope', 'key'] });
        metadata.createIndex('timeline', ['scope', 'time', 'key']);
        request.result.createObjectStore(CONTENT);
      }
      request.result.createObjectStore(CONTACTS, { keyPath: ['scope', 'id'] });
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) { database.close(); return; }
      database.onversionchange = () => { database.close(); opening = undefined; };
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('History database is blocked')); };
  }).catch((error: unknown) => { opening = undefined; throw error; });
}

function complete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('History transaction aborted'));
    transaction.onerror = () => reject(transaction.error);
  });
}

async function save(scope: string, message: LoungeMessage) {
  const database = await openDatabase();
  const transaction = database.transaction([META, CONTENT], 'readwrite');
  const finished = complete(transaction);
  const key = historyKey(message);
  transaction.objectStore(META).put({ scope, key, time: Date.parse(message.sentAt), search: historyText(message),
    conversation: message.conversation ?? '' });
  transaction.objectStore(CONTENT).put(message, [scope, key]);
  await finished;
}

async function search(scope: string, query: HistoryQuery) {
  const database = await openDatabase();
  const transaction = database.transaction([META, CONTENT]);
  const finished = complete(transaction);
  const terms = historyTerms(query.query);
  const upper = query.before ? [scope, query.before.time, query.before.key] : [scope, Number.MAX_SAFE_INTEGER, []];
  const range = IDBKeyRange.bound([scope, -Number.MAX_SAFE_INTEGER, ''], upper, false, !!query.before);
  const values: LoungeMessage[] = [];
  let bytes = 0;
  const cursor = transaction.objectStore(META).index('timeline').openCursor(range, 'prev');
  cursor.onsuccess = () => {
    const row = cursor.result;
    if (!row || values.length > historyPageLimit(query) || bytes > RECENT_BYTE_LIMIT) return;
    const metadata = row.value as Metadata;
    if (query.conversation !== undefined && (metadata.conversation ?? '') !== query.conversation) {
      row.continue(); return;
    }
    if (!terms.every(term => metadata.search.includes(term))) { row.continue(); return; }
    const content = transaction.objectStore(CONTENT).get([scope, metadata.key]);
    content.onsuccess = () => {
      const message = parseMessage(content.result);
      if (message) { values.push(message); bytes += messageBytes(message); }
      row.continue();
    };
  };
  await finished;
  return historyPage(values, query);
}

/** IndexedDB belongs to this browser/WebView; no archive data crosses the network. */
export function browserLoungeHistory(baseUrl: string, account: string): LoungeHistoryStore {
  const scope = historyScope(baseUrl, account);
  return { save: message => save(scope, message), page: query => search(scope, query),
    contacts: () => contacts(scope), saveContact: contact => saveContact(scope, contact) };
}

async function contacts(scope: string) {
  const db = await openDatabase();
  const tx = db.transaction(CONTACTS); const done = complete(tx);
  const request = tx.objectStore(CONTACTS).getAll(IDBKeyRange.bound([scope, ''], [scope, []]));
  const values: LoungeContact[] = [];
  request.onsuccess = () => {
    for (const row of request.result) { const value = parseContact(row); if (value) values.push(value); }
  };
  await done; return values;
}

async function saveContact(scope: string, contact: LoungeContact) {
  const db = await openDatabase();
  const tx = db.transaction(CONTACTS, 'readwrite'); const done = complete(tx);
  const store = tx.objectStore(CONTACTS);
  const previous = store.get([scope, contact.user.id]);
  previous.onsuccess = () => {
    const saved = parseContact(previous.result);
    const [value] = mergeContact(saved ? [saved] : [], contact);
    store.put({ scope, id: value.user.id, user: value.user, direct: value.direct });
  };
  await done;
}
