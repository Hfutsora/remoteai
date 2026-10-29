import { accountName, accountMatches } from './names';
import { useState } from 'react';
import { MessageCircle, Pin, Plus } from 'lucide-react';
import { ThreadContextMenu } from '../chat/ThreadContextMenu';
import { displayText as t } from '../localization/messages';
import type { LoungeAccount, LoungeSnapshot } from './types';
import { contactStatus, orderedDirectContacts } from './contacts';
import { LoungeAvatar } from './LoungeAvatar';
import { LoungeMyAccount } from './LoungeMyAccount';
import './contextMenu.css';

export function LoungePeople({ state, select, block, newChat, pin, profile }: {
  state: LoungeSnapshot; select: (user?: LoungeAccount) => void; block: (user: LoungeAccount) => void;
  newChat: () => void;
  pin: (userId: string, pinned: boolean) => void;
  profile: (user: LoungeAccount) => void;
}) {
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<string>();
  const contacts = orderedDirectContacts(state.contacts, state.user?.id).filter(contact =>
    accountMatches(contact.user, query));
  return <nav className="lounge-people" aria-label={t('client.lounge.people')}>
    <div className="lounge-people-heading"><h2>{t('client.lounge.people')}</h2>
      <button type="button" className="lounge-new-chat-button" onClick={newChat} disabled={!state.directAvailable}>
        <Plus size={15} aria-hidden="true" />{t('client.lounge.newChat')}</button></div>
    <input aria-label={t('client.lounge.peopleSearch')} placeholder={t('client.lounge.peopleSearch')}
      value={query} onChange={event => setQuery(event.target.value)} />
    <button type="button" className={`lounge-person${!state.conversation ? ' is-selected' : ''}`}
      aria-current={!state.conversation ? 'page' : undefined} onClick={() => select()}>
      <span className="lounge-avatar"><MessageCircle size={22} /></span>
      <span>{t('client.lounge.groupChat')}</span><Unread value={state.unreadByConversation['']} /></button>
    <div className="lounge-people-list">
      {!contacts.length && <p>{t('client.lounge.noPeople')}</p>}
      {contacts.map(contact => <ThreadContextMenu key={contact.user.id} overlayClassName="lounge-context-menu"
        open={menu === contact.user.id} onOpenChange={open => setMenu(open ? contact.user.id : undefined)}
        menu={{ items: [{ key: 'direct', label: t('client.lounge.directChat') },
          { key: 'profile', label: t('client.lounge.profile') },
          { key: 'pin', label: t(contact.pinned ? 'client.lounge.unpinChat' : 'client.lounge.pinChat') },
          ...(state.directAvailable ? [{ key: 'block', label: t(state.blocked.includes(contact.user.id)
            ? 'client.lounge.unblockUser' : 'client.lounge.blockUser') }] : [])],
        onClick: ({ key }) => {
          setMenu(undefined);
          if (key === 'pin') pin(contact.user.id, !contact.pinned);
          else if (key === 'profile') profile(contact.user);
          else if (key === 'direct') select(contact.user); else block(contact.user);
        } }}>
        <button type="button"
          className={`lounge-person${state.conversation === contact.user.id ? ' is-selected' : ''}`}
          aria-label={t('client.lounge.directWith', { account: accountName(contact.user) })}
          aria-current={state.conversation === contact.user.id ? 'page' : undefined} onClick={() => select(contact.user)}>
          <LoungeAvatar user={contact.user} /><span className="lounge-person-copy">
            <span>{accountName(contact.user)}</span>
            {contact.direct && <small className={contact.online ? 'is-online' : ''}>{t(contactStatus(contact))}</small>}
            {state.blocked.includes(contact.user.id) && <small>{t('client.lounge.blocked')}</small>}
          </span>{contact.pinned && <Pin size={14} className="lounge-pin" role="img"
            aria-label={t('client.lounge.pinned')} />}
          <Unread value={state.unreadByConversation[contact.user.id]} />
        </button>
      </ThreadContextMenu>)}
    </div>
    {state.user && <LoungeMyAccount key={state.user.id} user={state.user} settings={profile} />}
  </nav>;
}

function Unread({ value = 0 }: { value?: number }) {
  return value > 0 ? <span className="lounge-person-unread">{value > 99 ? '99+' : value}</span> : null;
}
