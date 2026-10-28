import { expect, type Page, type WebSocketRoute } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { LoungeReply } from '../../../shared/lounge/reply';

export const pixel = 'data:image/png;base64,'
  + readFileSync(new URL('../src-tauri/icons/32x32.png', import.meta.url)).toString('base64');
export async function setupLounge(page: Page, web = false) {
  let socket: WebSocketRoute;
  let connections = 0;
  let authentications = 0;
  let ticketsAvailable = true;
  let blocked = false;
  let acknowledge = true;
  let contactOnline: boolean | null = true;
  let avatar = '';
  let rejectAvatar = false;
  const receipts: { type: string; id: string; to: string; status: string }[] = [];
  const moderation: { userId: string; minutes: number }[] = [];
  const sent: { id: string; text: string; images: string[]; avatar?: string; reply?: LoungeReply; to?: string }[] = [];
  const bob = { id: 'bob', account: 'bob@example.test' };
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://lounge.test/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/lounge/ticket' && !ticketsAvailable) return route.fulfill({ status: 503, body: '{}' });
    const data = path === '/lounge/ticket' ? { ticket: 'fixture-ticket' }
      : path === '/auth/me' ? { id: 'alice', email: 'alice@example.test', role: 'user' }
        : path === '/devices' ? { devices: [] } : path === '/devices/providers' ? { providers: [] }
          : path === '/sync/accounts/web-summary' ? { accounts: [] } : {};
    return route.fulfill({ json: data });
  });
  await page.routeWebSocket('**/lounge/socket', route => {
    socket = route; connections++;
    route.onMessage(raw => {
      const frame = JSON.parse(String(raw));
      if (frame.type === 'authenticate') {
        route.send(JSON.stringify({ type: 'ready', profiles: true,
          user: { id: 'alice', account: 'alice@example.test', avatar },
          direct: true, receipts: true, blocked: blocked ? [bob] : [] }));
        authentications++;
      }
      if (frame.type === 'ping') route.send('{"type":"pong"}');
      if (frame.type === 'avatar') {
        if (rejectAvatar) route.send(JSON.stringify({ type: 'rejected', id: frame.id,
          code: 'client.lounge.avatarSaveFailed' }));
        else {
          avatar = frame.avatar;
          route.send(JSON.stringify({ type: 'profiles', profiles: [{ id: 'alice', avatar }] }));
          route.send(JSON.stringify({ type: 'updated', id: frame.id }));
        }
      }
      if (frame.type === 'watch') route.send(JSON.stringify({ type: 'contacts',
        contacts: frame.watch.map((id: string) => ({ id, online: id === 'bob' ? contactOnline : true })) }));
      if (frame.type === 'block') {
        blocked = frame.blocked;
        route.send(JSON.stringify({ type: 'privacy', blocked: blocked ? [bob] : [] }));
        route.send(JSON.stringify({ type: 'updated', id: frame.id }));
      }
      if (frame.type === 'message') {
        sent.push(frame);
        route.send(JSON.stringify({ ...frame, sender: { id: 'alice', account: 'alice@example.test', avatar: frame.avatar },
          ...(frame.to ? { recipient: bob } : {}),
          sentAt: new Date().toISOString() }));
        if (frame.to && acknowledge) route.send(JSON.stringify({ type: 'receipt', id: frame.id,
          from: frame.to, to: 'alice', status: 'delivered' }));
      }
      if (frame.type === 'receipt') route.send(JSON.stringify({ type: 'receipt-confirm', id: frame.id,
        from: frame.to, to: 'alice', status: frame.status }));
      if (frame.type === 'receipt' || frame.type === 'receipt-confirm') receipts.push(frame);
      if (frame.type === 'moderate') {
        moderation.push(frame);
        route.send(JSON.stringify({ type: 'moderated', id: frame.id }));
      }
    });
  });
  await page.routeWebSocket('**/device-switch', route => route.onMessage(() => {}));
  await page.addInitScript(web => {
    localStorage.setItem('codex-switch:language', 'zh');
    localStorage.setItem('codex-switch.web.language.v1', 'zh');
    localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({ baseUrl: 'https://lounge.test',
      accessToken: 'fixture', refreshToken: 'fixture', email: 'alice@example.test' }));
    Object.defineProperty(window, 'Notification', { configurable: true, value: class {
      constructor() { throw new Error('System notifications are forbidden'); }
      static requestPermission() { throw new Error('Notification permission is forbidden'); }
    } });
    if (!web) Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {
      invoke: (command: string) => {
        if (command === 'cloud_lounge_ticket') return sessionStorage.getItem('lounge-test-offline')
          ? Promise.reject(new Error('offline')) : Promise.resolve({ ticket: 'fixture-ticket' });
        throw new Error(`Unexpected native operation: ${command}`);
      },
    } });
  }, web);
  return {
    sent, moderation, receipts, count: () => connections,
    avatar: (value: string) => {
      avatar = value;
      socket.send(JSON.stringify({ type: 'profiles', profiles: [{ id: 'alice', avatar }] }));
    },
    savedAvatar: () => avatar,
    rejectAvatar: (reject: boolean) => { rejectAvatar = reject; },
    acknowledge: (enabled: boolean) => { acknowledge = enabled; },
    receipt: (id: string, status: 'delivered' | 'read') => socket.send(JSON.stringify({
      type: 'receipt', id, from: 'bob', to: 'alice', status })),
    offline: () => { ticketsAvailable = false; },
    policy: (moderator: boolean, mutedUntil: string | null = null) => socket.send(JSON.stringify({
      type: 'policy', policy: { moderator, mutedUntil }, ...(moderator ? { onlineCount: 2 } : {}),
    })),
    presence: (onlineCount: number) => socket.send(JSON.stringify({ type: 'presence', onlineCount })),
    contact: (online: boolean | null) => {
      contactOnline = online;
      socket.send(JSON.stringify({ type: 'contacts', contacts: [{ id: 'bob', online }] }));
    },
    private: (text: string, sender = bob, id = crypto.randomUUID()) => {
      socket.send(JSON.stringify({ type: 'message', id, text, images: [], sender,
        recipient: { id: 'alice', account: 'alice@example.test' }, receipts: true, sentAt: new Date().toISOString() }));
      return id;
    },
    ready: () => expect.poll(() => authentications).toBeGreaterThan(0),
    close: () => socket.close({ code: 1001 }),
    push: (text: string, images: string[] = []) => socket.send(JSON.stringify({ type: 'message',
      id: crypto.randomUUID(), text, images, sender: { id: 'bob', account: 'bob@example.test' },
      sentAt: new Date().toISOString() })),
  };
}
