import type { MessageKey } from '@remoteai/i18n';
import type { LoungeController } from './controller';
import type { ConversationRow } from './conversationRows';
import type { MobileLounge } from './useMobileLounge';

export interface ConversationAction {
  key: 'direct' | 'pin' | 'block' | 'delete';
  label: MessageKey;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** Keep mobile action availability and dismissal identical across native and Web. */
export function conversationActions({ row, model, controller, close }: {
  row: ConversationRow; model: MobileLounge; controller: LoungeController; close: () => void;
}): ConversationAction[] {
  const user = row.user;
  if (!user) return [];
  const dismissThen = (action: () => void) => () => { close(); action(); };
  const actions: ConversationAction[] = [
    { key: 'direct', label: 'client.lounge.directChat', onPress: dismissThen(() => model.select(user)) },
    { key: 'pin', label: row.contact?.pinned ? 'client.lounge.unpinChat' : 'client.lounge.pinChat',
      active: row.contact?.pinned,
      onPress: dismissThen(() => controller.setPinned(row.id, !row.contact?.pinned)) },
  ];
  if (model.state.directAvailable) actions.push({ key: 'block',
    label: model.state.blocked.includes(row.id) ? 'client.lounge.unblockUser' : 'client.lounge.blockUser',
    active: model.state.blocked.includes(row.id), onPress: dismissThen(() => model.setBlocking(user)) });
  actions.push({ key: 'delete', label: 'client.lounge.deleteChat',
    disabled: !model.state.directResetAvailable || model.state.status !== 'connected',
    onPress: dismissThen(() => model.setDeleting(user)) });
  return actions;
}
