import { accountName } from './names';
import { Menu } from 'antd';
import { Ban, MessageCircle, Pin, PinOff, Trash2 } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { conversationActions } from './conversationActions';
import type { ConversationRow } from './conversationRows';
import type { LoungeController } from './controller';
import type { MobileLounge } from './useMobileLounge';
import { LoungeAvatar } from './LoungeAvatar';
import { MobileLoungeSheet } from './MobileLoungeSheet';
import './chatActions.css';

const icons = { direct: MessageCircle, pin: Pin, block: Ban, delete: Trash2 };

export function MobileLoungeChatActions({ row, model, controller, close }: {
  row: ConversationRow; model: MobileLounge; controller: LoungeController; close: () => void;
}) {
  if (!row.user) return null;
  const actions = conversationActions({ row, model, controller, close });
  return <MobileLoungeSheet className="lounge-chat-actions-sheet" close={close} title={
    <div className="lounge-chat-actions-contact"><LoungeAvatar user={row.user} />
      <div><h2>{accountName(row.user)}</h2><p>{t('client.lounge.privateChats')}</p></div>
    </div>
  }>
    <Menu className="lounge-chat-actions" selectable={false} aria-label={accountName(row.user)}
      items={actions.map(action => {
        const Icon = action.key === 'pin' && action.active ? PinOff : icons[action.key];
        return { key: action.key, label: t(action.label), disabled: action.disabled,
          danger: action.key === 'delete', className: `lounge-chat-action-${action.key}`,
          icon: <span className="lounge-chat-action-icon"><Icon size={20} aria-hidden="true" /></span>,
          onClick: action.onPress };
      })} />
  </MobileLoungeSheet>;
}
