import { useState } from 'react';
import { ChevronLeft, MessageSquarePlus, MessagesSquare, Search } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { ThreadContextMenu } from '../chat/ThreadContextMenu';
import type { LoungeController } from './controller';
import type { MobileLounge } from './useMobileLounge';
import { conversationRows, type ConversationRow } from './conversationRows';
import { LoungeAvatar } from './LoungeAvatar';
import { contactStatus } from './contacts';
import { MobileLoungeSheet } from './MobileLoungeSheet';

export function MobileLoungeChats({ model, controller, onBack }: {
  model: MobileLounge; controller: LoungeController; onBack?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<string>();
  const rows = conversationRows({ state: model.state, controller, drafts: model.drafts }).filter(row =>
    (row.user?.account ?? t('client.lounge.groupChat')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="lounge-chat-list">
    <header className="lounge-mobile-heading">
      <button type="button" aria-label={t('client.discovery.back')} onClick={onBack}>
        <ChevronLeft size={22} /></button><h1>{t('client.lounge.chats')}</h1>
      <button type="button" className="lounge-new-chat" onClick={() => model.setSheet('members')}>
        <MessageSquarePlus size={18} />{t('client.lounge.newChat')}</button>
    </header>
    <label className="lounge-chat-search"><Search size={18} /><input value={query}
      onChange={event => setQuery(event.target.value)} aria-label={t('client.lounge.searchChats')}
      placeholder={t('client.lounge.searchChats')} /></label>
    <div className="lounge-chat-rows">
      {!rows.length && <p className="lounge-no-chats">{t('client.lounge.noChats')}</p>}
      {rows.map((row, index) => <div key={row.id}>
        {(index === 0 || !rows[index - 1].user) && <h2 className="lounge-section-label">
          {t(row.user ? 'client.lounge.privateChats' : 'client.lounge.publicRoom')}</h2>}
        <ThreadContextMenu open={!!row.user && menu === row.id}
          onOpenChange={open => setMenu(open && row.user ? row.id : undefined)}
          menu={{ items: row.user ? [{ key: 'direct', label: t('client.lounge.directChat') },
            ...(model.state.directAvailable ? [{ key: 'block', label: t(model.state.blocked.includes(row.id)
              ? 'client.lounge.unblockUser' : 'client.lounge.blockUser') }] : [])] : [],
          onClick: ({ key }) => {
            setMenu(undefined);
            if (key === 'block' && row.user) model.setBlocking(row.user); else model.select(row.user);
          } }}>
          <button className={`lounge-chat-row${row.current ? ' is-current' : ''}`} type="button"
            aria-label={row.user ? t('client.lounge.directWith', { account: row.user.account }) : t('client.lounge.groupChat')}
            aria-description={row.contact ? t(contactStatus(row.contact)) : undefined}
            aria-current={row.current ? 'page' : undefined} onClick={() => model.select(row.user)}>
            {row.user ? <span className="lounge-chat-avatar" aria-hidden>
              <LoungeAvatar user={row.user} />
              <span className={`lounge-avatar-presence${row.online ? ' is-online' : ''}`} />
            </span> : <span className="lounge-avatar"><MessagesSquare size={22} /></span>}
            <span className="lounge-chat-row-copy"><strong>{row.user?.account ?? t('client.lounge.groupChat')}</strong>
              <span>{previewText(row)}</span></span>
            <span className="lounge-chat-row-meta">
              {row.last && <time>{new Date(row.last.sentAt).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit' })}</time>}
              {row.unread > 0 ? <span className="lounge-chat-badge">{row.unread > 99 ? '99+' : row.unread}</span>
                : row.current && <small>{t('client.lounge.current')}</small>}
            </span>
          </button>
        </ThreadContextMenu>
      </div>)}
    </div>
  </section>;
}

function previewText(row: ConversationRow) {
  if (row.draft?.text || row.draft?.images.length) return t('client.lounge.draftPreview', {
    text: row.draft.text || t('client.lounge.quotedImages', { count: row.draft.images.length }) });
  if (row.last) return row.last.text || t('client.lounge.quotedImages', { count: row.last.images.length });
  return t(row.user ? 'client.lounge.directEmpty' : 'client.lounge.emptyHint');
}

export function MobileLoungeMembers({ model }: { model: MobileLounge }) {
  const members = model.state.contacts.filter(contact => contact.user.id !== model.state.user?.id);
  return <MobileLoungeSheet title={t('client.lounge.members')} close={() => model.setSheet(undefined)}>
    <p className="lounge-sheet-copy">{t('client.lounge.membersHint')}</p>
    {!members.length && <p className="lounge-sheet-copy">{t('client.lounge.noMembers')}</p>}
    {members.map(contact => <button type="button" key={contact.user.id} className="lounge-chat-row"
      disabled={!model.state.directAvailable} onClick={() => model.select(contact.user)}
      aria-label={t('client.lounge.directWith', { account: contact.user.account })}>
      <LoungeAvatar user={contact.user} /><span className="lounge-chat-row-copy">
        <strong>{contact.user.account}</strong>{contact.direct && <small>{t(contactStatus(contact))}</small>}</span>
      <span className="lounge-member-action">{t('client.lounge.privateChats')}</span>
    </button>)}
  </MobileLoungeSheet>;
}
