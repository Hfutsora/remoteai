import { MAX_FRAME_BYTES, parseMessage, type LoungeDraft, type LoungeMessage,
  type LoungeSession, type LoungeSnapshot } from './types';
import { avatarData } from './avatar';

const HEARTBEAT_MS = 20_000;
const STALE_MS = 65_000;
const AUTH_RENEW_MS = 4 * 60_000;
const AUTH_TIMEOUT_MS = 15_000;
const SEND_TIMEOUT_MS = 20_000;
const MAX_MESSAGES = 200;
const MAX_HISTORY_BYTES = 24 * 1024 * 1024;
interface Pending { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }

function messageBytes(message: LoungeMessage) {
  return (message.text.length + (message.sender.avatar?.length ?? 0)
    + message.images.reduce((total, value) => total + value.length, 0)) * 2;
}

async function authorize(session: LoungeSession) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([session.authorize(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('client.lounge.unavailable')), AUTH_TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timer); }
}

/** Lives at the application root. All received content stays in this process's bounded memory. */
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

  constructor(private readonly session?: LoungeSession) {
    this.state = { status: session ? 'connecting' : 'signed-out', messages: [], unread: 0,
      policy: { moderator: false, mutedUntil: null } };
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
    window.addEventListener('online', this.wake);
    window.addEventListener('focus', this.wake);
    document.addEventListener('visibilitychange', this.wake);
    this.heartbeat = setInterval(this.tick, HEARTBEAT_MS);
    void this.connect();
  }
  stop() {
    this.running = false;
    this.generation++;
    this.connecting = false;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    window.removeEventListener('online', this.wake);
    window.removeEventListener('focus', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    this.disconnect();
    this.update({ messages: [], unread: 0, user: undefined, policy: { moderator: false, mutedUntil: null },
      status: this.session ? 'connecting' : 'signed-out' });
  }
  setViewing(viewing: boolean) { this.viewing = viewing; this.markRead(); }
  private canRead() { return this.viewing && document.visibilityState === 'visible' && document.hasFocus(); }
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
      const socket = new WebSocket(url);
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
    if (this.running) this.update({ status: 'connecting' });
  }
  private receive(data: unknown) {
    if (typeof data !== 'string' || data.length > MAX_FRAME_BYTES) return;
    let frame: Record<string, unknown>;
    try { frame = JSON.parse(data) as Record<string, unknown>; } catch { return; }
    if (!frame || typeof frame !== 'object') return;
    this.received = Date.now();
    if (frame.type === 'policy' || frame.type === 'ready') this.receivePolicy(frame.policy);
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
    const messages = [...previous, message].slice(-MAX_MESSAGES);
    let size = messages.reduce((sum, item) => sum + messageBytes(item), 0);
    while (size > MAX_HISTORY_BYTES && messages.length > 1) {
      const removed = messages.shift()!;
      size -= messageBytes(removed);
    }
    this.update({ messages, unread: this.canRead() ? 0 : this.state.unread + (own ? 0 : 1) });
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
    this.update({ policy: { moderator: value.moderator, mutedUntil: value.mutedUntil as string | null } });
  }
  private submit(frame: Record<string, unknown>): Promise<void> {
    const socket = this.socket;
    if (this.state.status !== 'connected' || !socket || socket.readyState !== WebSocket.OPEN
      || socket.bufferedAmount > MAX_FRAME_BYTES) return Promise.reject(new Error('client.lounge.sendFailed'));
    const id = crypto.randomUUID();
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
