import type { LoungeController } from './controller';
import type { LoungeDraft, LoungeSnapshot } from './types';

export function conversationRows(options: {
  state: LoungeSnapshot; controller: LoungeController; drafts: Record<string, LoungeDraft>;
}) {
  const { state, controller, drafts } = options;
  return [undefined, ...state.contacts.filter(contact => contact.direct)]
    .map(contact => {
      const user = contact?.user;
      const id = user?.id ?? '';
      return { id, user, contact, online: state.status === 'connected' && contact?.online === true,
        draft: drafts[id], last: controller.conversationPreview(id),
        unread: state.unreadByConversation[id] ?? 0 };
    });
}

export type ConversationRow = ReturnType<typeof conversationRows>[number];
