import { avatarData, type LoungeAvatarStore } from './avatar';
import type { LoungeHistoryStore } from './archive';

export const MAX_TEXT = 4000;
export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_FRAME_BYTES = 6 * 1024 * 1024;
export const MAX_MUTE_MINUTES = 30 * 24 * 60;
export interface LoungeAccount { id: string; account: string; avatar?: string }
export interface LoungeMessage {
  type: 'message'; id: string; sender: LoungeAccount; text: string; images: string[]; sentAt: string;
}
export interface LoungeDraft { text: string; images: string[] }
export interface LoungePolicy { moderator: boolean; mutedUntil: string | null }
export interface LoungeSession {
  baseUrl: string;
  authorize: () => Promise<{ ticket: string }>;
  avatars?: LoungeAvatarStore;
  history?: LoungeHistoryStore;
}
export interface LoungeSnapshot {
  status: 'signed-out' | 'connecting' | 'connected';
  messages: LoungeMessage[];
  user?: LoungeAccount;
  unread: number;
  policy: LoungePolicy;
  historyRevision: number;
  historyError: boolean;
}

export function imageData(value: unknown): value is string {
  return typeof value === 'string' && value.length <= Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32
    && /^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/]+=*$/.test(value);
}

export function parseMessage(value: unknown): LoungeMessage | undefined {
  if (!value || typeof value !== 'object') return;
  const item = value as Partial<LoungeMessage>;
  if (item.type !== 'message' || typeof item.id !== 'string' || item.id.length > 80
    || typeof item.sender?.id !== 'string' || typeof item.sender.account !== 'string'
    || typeof item.text !== 'string' || [...item.text].length > MAX_TEXT
    || !Array.isArray(item.images) && item.images != null
    || typeof item.sentAt !== 'string' || !Number.isFinite(Date.parse(item.sentAt))) return;
  const images = item.images ?? [];
  if (images.length > MAX_IMAGES || !images.every(imageData)) return;
  const sender = { ...item.sender, avatar: avatarData(item.sender.avatar) ? item.sender.avatar : undefined };
  return { ...item, sender, images } as LoungeMessage;
}

export function initials(account: string) { return Array.from(account).slice(0, 2).join('').toUpperCase(); }
