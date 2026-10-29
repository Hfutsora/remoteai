import type { LoungeAccount, LoungeMessage } from './types';
import { avatarData } from './avatar';

export interface LoungeContact {
  user: LoungeAccount;
  direct: boolean;
  online?: boolean | null;
}

export function parseAccount(input: unknown): LoungeAccount | undefined {
  if (!input || typeof input !== 'object') return;
  const user = input as Partial<LoungeAccount>;
  if (typeof user.id !== 'string' || !user.id || user.id.length > 80
    || typeof user.account !== 'string' || !user.account || [...user.account].length > 320) return;
  return { id: user.id, account: user.account, avatar: avatarData(user.avatar) ? user.avatar : undefined };
}

export function parseContact(input: unknown): LoungeContact | undefined {
  if (!input || typeof input !== 'object') return;
  const value = input as Partial<LoungeContact>;
  const user = parseAccount(value.user);
  if (user && typeof value.direct === 'boolean') return { user, direct: value.direct };
}

export function mergeContact(contacts: LoungeContact[], incoming: LoungeContact): LoungeContact[] {
  const previous = contacts.find(contact => contact.user.id === incoming.user.id);
  const updated = { ...previous, ...incoming, direct: incoming.direct || !!previous?.direct,
    user: { ...incoming.user, avatar: incoming.user.avatar ?? previous?.user.avatar } };
  return [...contacts.filter(contact => contact.user.id !== incoming.user.id), updated];
}

export const messageConversation = (message: LoungeMessage, self: string) =>
  message.recipient ? (message.sender.id === self ? message.recipient.id : message.sender.id) : '';

export function contactStatus(contact: LoungeContact) {
  if (contact.online === null) return 'client.lounge.presenceHidden';
  if (contact.online === undefined) return 'client.lounge.presencePending';
  return contact.online ? 'client.lounge.userOnline' : 'client.lounge.userOffline';
}

export const sendError = (error: unknown) => error instanceof Error
  && ['client.lounge.muted', 'client.lounge.directUnavailable', 'client.lounge.awaitingReply'].includes(error.message)
  ? error.message : 'client.lounge.sendFailed';
