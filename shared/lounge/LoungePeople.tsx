import { useState } from 'react';
import { MessageCircle, Plus } from 'lucide-react';
import { ThreadContextMenu } from '../chat/ThreadContextMenu';
import { displayText as t } from '../localization/messages';
import type { LoungeAccount, LoungeSnapshot } from './types';
import { contactStatus } from './contacts';
import { LoungeAvatar } from './LoungeAvatar';

export function LoungePeople({ state, select, block, newChat }: {
  state: LoungeSnapshot; select: (user?: LoungeAccount) => void; block: (user: LoungeAccount) => void;
  newChat: () => void;
}) {
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<string>();
  const contacts = state.contacts.filter(contact => contact.direct && contact.user.id !== state.user?.id
    && contact.user.account.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
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
      {contacts.map(contact => <ThreadContextMenu key={contact.user.id}
        open={menu === contact.user.id} onOpenChange={open => setMenu(open ? contact.user.id : undefined)}
        menu={{ items: [{ key: 'direct', label: t('client.lounge.directChat') },
          ...(state.directAvailable ? [{ key: 'block', label: t(state.blocked.includes(contact.user.id)
            ? 'client.lounge.unblockUser' : 'client.lounge.blockUser') }] : [])],
        onClick: ({ key }) => { setMenu(undefined); if (key === 'direct') select(contact.user); else block(contact.user); } }}>
        <button type="button"
          className={`lounge-person${state.conversation === contact.user.id ? ' is-selected' : ''}`}
          aria-label={t('client.lounge.directWith', { account: contact.user.account })}
          aria-current={state.conversation === contact.user.id ? 'page' : undefined} onClick={() => select(contact.user)}>
          <LoungeAvatar user={contact.user} /><span className="lounge-person-copy">
            <span>{contact.user.account}</span>
            {contact.direct && <small className={contact.online ? 'is-online' : ''}>{t(contactStatus(contact))}</small>}
            {state.blocked.includes(contact.user.id) && <small>{t('client.lounge.blocked')}</small>}
          </span><Unread value={state.unreadByConversation[contact.user.id]} />
        </button>
      </ThreadContextMenu>)}
    </div>
  </nav>;
}

function Unread({ value = 0 }: { value?: number }) {
  return value > 0 ? <span className="lounge-person-unread">{value > 99 ? '99+' : value}</span> : null;
}
