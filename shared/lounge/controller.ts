import { MAX_FRAME_BYTES, parseMessage, type LoungeDraft, type LoungeMessage,
  type LoungeSession, type LoungeSnapshot } from './types';
import { avatarData } from './avatar';
import { browserLoungeRuntime, type LoungeRuntime } from './runtime';
import { historyPage, historyPosition, recentMessages, RECENT_MESSAGE_LIMIT,
  type HistoryPage, type HistoryQuery } from './archive';
import { searchLoungeHistory } from './history';

const HEARTBEAT_MS = 20_000;
const STALE_MS = 65_000;
const AUTH_RENEW_MS = 4 * 60_000;
const AUTH_TIMEOUT_MS = 15_000;
const SEND_TIMEOUT_MS = 20_000;
interface Pending { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }

async function authorize(session: LoungeSession) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([session.authorize(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('client.lounge.unavailable')), AUTH_TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timer); }
}

/** Owns the live connection and recent messages; optional storage archives received content locally. */
export class LoungeController {
  private state: LoungeSnapshot;
  private listeners = new Set<() => void>();
  private socket?: WebSocket;
  private running = false;
  private connecting = false;
  private viewing = false;
  private generation = 0;
  private attempt = 0;
  private received = 0;
  private authorized = 0;
  private renewing = false;
  private renewalStarted = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private pending = new Map<string, Pending>();
  private unsubscribe?: () => void;
  private lifecycle = 0;
  private writes: Promise<void> = Promise.resolve();
  private historyFailures = 0;

  constructor(private readonly session?: LoungeSession, private readonly runtime: LoungeRuntime = browserLoungeRuntime) {
    this.state = { status: session ? 'connecting' : 'signed-out', messages: [], unread: 0,
      policy: { moderator: false, mutedUntil: null }, historyRevision: 0, historyError: false };
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(value: Partial<LoungeSnapshot>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach(listener => listener());
  }

  start() {
    if (this.running || !this.session) return;
    this.running = true;
    this.lifecycle++;
    void this.restoreHistory();
    this.unsubscribe = this.runtime.subscribe(this.wake);
    this.heartbeat = setInterval(this.tick, HEARTBEAT_MS);
    void this.connect();
  }
  stop() {
    this.running = false;
    this.lifecycle++;
    this.generation++;
    this.connecting = false;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.disconnect();
    this.update({ messages: [], unread: 0, user: undefined, policy: { moderator: false, mutedUntil: null },
      status: this.session ? 'connecting' : 'signed-out', historyError: false, onlineCount: undefined });
  }
  setViewing(viewing: boolean) { this.viewing = viewing; this.markRead(); }
  private canRead() { return this.viewing && this.runtime.isVisible(); }
  private markRead() { if (this.canRead() && this.state.unread) this.update({ unread: 0 }); }
  private wake = () => {
    this.markRead();
    if (this.socket && Date.now() - this.received > STALE_MS) this.disconnect();
    if (!this.socket) { clearTimeout(this.retry); void this.connect(); }
  };
  private tick = () => {
    if (!this.socket || !this.running) return;
    if (Date.now() - this.received > STALE_MS
      || this.renewalStarted && Date.now() - this.renewalStarted > AUTH_TIMEOUT_MS) {
      this.disconnect(); this.schedule(); return;
    }
    if (this.state.status !== 'connected') return;
    try { this.socket.send(JSON.stringify({ type: 'ping' })); } catch { this.disconnect(); this.schedule(); }
    if (Date.now() - this.authorized >= AUTH_RENEW_MS) void this.renew();
  };
  private schedule() {
    if (!this.running) return;
    clearTimeout(this.retry);
    this.retry = setTimeout(() => void this.connect(), Math.min(15_000, 1000 * 2 ** this.attempt++));
  }
  private async connect() {
    if (!this.running || !this.session || this.socket || this.connecting) return;
    this.connecting = true;
    const generation = ++this.generation;
    this.update({ status: 'connecting' });
    try {
      const credentials = await authorize(this.session);
      if (!this.running || generation !== this.generation) return;
      const url = new URL(`${this.session.baseUrl.replace(/\/+$/, '')}/lounge/socket`);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url.toString());
      this.socket = socket;
      this.received = Date.now();
      this.renewalStarted = Date.now();
      socket.onopen = () => {
        if (this.socket === socket) socket.send(JSON.stringify({ type: 'authenticate', ticket: credentials.ticket }));
      };
      socket.onmessage = event => { if (this.socket === socket) this.receive(event.data); };
      socket.onerror = () => { if (this.socket === socket) { this.disconnect(); this.schedule(); } };
      socket.onclose = () => { if (this.socket === socket) { this.disconnect(); this.schedule(); } };
    } catch { if (this.running && generation === this.generation) this.schedule(); }
    finally { if (generation === this.generation) this.connecting = false; }
  }
  private async renew() {
    if (this.renewing || !this.session || !this.socket) return;
    this.renewing = true;
    const socket = this.socket;
    try {
      const credentials = await authorize(this.session);
      if (socket !== this.socket || !this.running) return;
      socket.send(JSON.stringify({ type: 'authenticate', ticket: credentials.ticket }));
      this.renewalStarted = Date.now();
    } catch { if (this.socket === socket) { this.disconnect(); this.schedule(); } }
    finally { this.renewing = false; }
  }
  private disconnect() {
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onclose = socket.onmessage = socket.onopen = socket.onerror = null;
      socket.close();
    }
    this.renewalStarted = 0;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer); pending.reject(new Error('client.lounge.sendFailed'));
    }
    this.pending.clear();
    if (this.running) this.update({ status: 'connecting', onlineCount: undefined });
  }
  private receive(data: unknown) {
    if (typeof data !== 'string' || data.length > MAX_FRAME_BYTES) return;
    let frame: Record<string, unknown>;
    try { frame = JSON.parse(data) as Record<string, unknown>; } catch { return; }
    if (!frame || typeof frame !== 'object') return;
    this.received = Date.now();
    if (frame.type === 'policy' || frame.type === 'ready') this.receivePolicy(frame.policy);
    if (['policy', 'ready', 'presence'].includes(String(frame.type)) && this.state.policy.moderator) {
      const count = frame.onlineCount;
      if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) this.update({ onlineCount: count });
    }
    if (frame.type === 'moderated' || frame.type === 'rejected') {
      const pending = this.pending.get(String(frame.id));
      if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(String(frame.id));
      if (frame.type === 'moderated') pending.resolve();
      else pending.reject(new Error(frame.code === 'client.lounge.muted' ? frame.code : 'client.lounge.actionFailed'));
      return;
    }
    if (frame.type === 'ready') {
      const user = frame.user as LoungeSnapshot['user'];
      if (!user || typeof user.id !== 'string' || typeof user.account !== 'string') return;
      this.authorized = Date.now(); this.attempt = 0; this.renewalStarted = 0;
      this.update({ status: 'connected', user: { ...user, avatar: this.session?.avatars?.load(user.id) } }); return;
    }
    const message = parseMessage(frame);
    if (!message || this.state.status !== 'connected') return;
    this.append(message);
  }
  private append(message: LoungeMessage) {
    const own = message.sender.id === this.state.user?.id;
    if (own) {
      const pending = this.pending.get(message.id);
      if (pending) { clearTimeout(pending.timer); pending.resolve(); this.pending.delete(message.id); }
    }
    if (this.state.messages.some(item => item.id === message.id && item.sender.id === message.sender.id)) return;
    const previous = this.state.messages.map(item => item.sender.id === message.sender.id
      ? { ...item, sender: message.sender } : item);
    const messages = recentMessages([...previous, message]);
    this.update({ messages, unread: this.canRead() ? 0 : this.state.unread + (own ? 0 : 1) });
    this.archive(message);
  }
  private archive(message: LoungeMessage) {
    const store = this.session?.history;
    if (!store) return;
    const lifecycle = this.lifecycle;
    this.writes = this.writes.then(() => store.save(message)).then(() => {
      if (this.running && lifecycle === this.lifecycle) {
        this.update({ historyRevision: this.state.historyRevision + 1 });
      }
    }).catch(() => {
      this.historyFailures++;
      if (this.running && lifecycle === this.lifecycle) this.update({ historyError: true });
    });
  }
  private async restoreHistory() {
    const store = this.session?.history;
    if (!store) return;
    const lifecycle = this.lifecycle;
    try {
      const page = await store.page({ query: '', limit: RECENT_MESSAGE_LIMIT });
      if (!this.running || lifecycle !== this.lifecycle) return;
      this.update({ messages: recentMessages([...page.messages.reverse(), ...this.state.messages]) });
      return true;
    } catch {
      if (this.running && lifecycle === this.lifecycle) this.update({ historyError: true });
    }
  }
  async searchHistory(query: HistoryQuery): Promise<HistoryPage> {
    await this.writes;
    if (this.session?.history) return this.session.history.page(query);
    const matches = searchLoungeHistory(this.state.messages, query.query).filter(message => {
      const position = historyPosition(message);
      return !query.before || position.time < query.before.time
        || position.time === query.before.time && position.key < query.before.key;
    }).sort((a, b) => {
      const first = historyPosition(a); const second = historyPosition(b);
      return second.time - first.time || (first.key < second.key ? 1 : -1);
    });
    return historyPage(matches, query);
  }
  async retryHistory() {
    await this.writes;
    const lifecycle = this.lifecycle;
    const failures = this.historyFailures;
    for (const message of this.state.messages) this.archive(message);
    await this.writes;
    const restored = await this.restoreHistory();
    if (restored && this.running && lifecycle === this.lifecycle && failures === this.historyFailures) {
      this.update({ historyError: false });
    }
  }
  send(draft: LoungeDraft): Promise<void> {
    if (this.state.policy.mutedUntil && Date.parse(this.state.policy.mutedUntil) > Date.now()) {
      return Promise.reject(new Error('client.lounge.muted'));
    }
    return this.submit({ type: 'message', ...draft, avatar: this.state.user?.avatar ?? '' });
  }
  setAvatar(avatar: string) {
    const user = this.state.user;
    if (!user || !this.session?.avatars) throw new Error('client.lounge.avatarSaveFailed');
    if (avatar && !avatarData(avatar)) throw new Error('client.lounge.imageFailed');
    this.session.avatars.save(user.id, avatar);
    const updated = { ...user, avatar: avatar || undefined };
    this.update({ user: updated, messages: this.state.messages.map(message => message.sender.id === user.id
      ? { ...message, sender: updated } : message) });
  }
  moderate(userId: string, minutes: number): Promise<void> {
    return this.submit({ type: 'moderate', userId, minutes });
  }
  private receivePolicy(input: unknown) {
    if (!input || typeof input !== 'object') return;
    const value = input as Record<string, unknown>;
    if (typeof value.moderator !== 'boolean' || value.mutedUntil !== null &&
      (typeof value.mutedUntil !== 'string' || !Number.isFinite(Date.parse(value.mutedUntil)))) return;
    this.update({ policy: { moderator: value.moderator, mutedUntil: value.mutedUntil as string | null },
      onlineCount: value.moderator ? this.state.onlineCount : undefined });
  }
  private submit(frame: Record<string, unknown>): Promise<void> {
    const socket = this.socket;
    if (this.state.status !== 'connected' || !socket || socket.readyState !== WebSocket.OPEN
      || socket.bufferedAmount > MAX_FRAME_BYTES) return Promise.reject(new Error('client.lounge.sendFailed'));
    const id = this.runtime.randomId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id); reject(new Error('client.lounge.sendFailed'));
      }, SEND_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      try { socket.send(JSON.stringify({ id, ...frame })); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(new Error('client.lounge.sendFailed')); }
    });
  }
}
