import type { LoungeMessage } from './types';

function searchable(value: string) { return value.normalize('NFKC').toLowerCase(); }

/** Searches only messages received by this client; it never requests a server history. */
export function searchLoungeHistory(messages: readonly LoungeMessage[], query: string): LoungeMessage[] {
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return messages.filter(message => {
    const content = searchable(`${message.sender.account}\n${message.text}`);
    return terms.every(term => content.includes(term));
  }).reverse();
}
