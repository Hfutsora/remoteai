import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, Ban, Coffee, Users, X } from 'lucide-react';
import { Drawer, Modal } from 'antd';
import { displayText as t } from '../localization/messages';
import { getInterfaceLanguage, subscribeInterfaceLanguage } from '../localization/interfaceLanguage';
import { localeForLanguage } from '../localization/language';
import { type LoungeAccount, type LoungeMessage } from './types';
import type { LoungeController } from './controller';
import { LoungeComposer } from './LoungeComposer';
import { LoungeModeration } from './LoungeModeration';
import { LoungeAvatar } from './LoungeAvatar';
import { LoungeAvatarSettings } from './LoungeAvatarSettings';
import { LoungeMessageBody } from './LoungeMessageBody';
import { LoungeHistory } from './LoungeHistory';
import { quoteMessage, type LoungeReply } from './reply';
import { LoungePeople } from './LoungePeople';
import { LoungeBlockDialog } from './LoungeBlockDialog';
import { contactStatus } from './contacts';
import './lounge.css';
import './people.css';

export function LoungePage({ controller, onLogin, mobile = false }: {
  controller: LoungeController; onLogin?: () => void; mobile?: boolean;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const language = useSyncExternalStore(subscribeInterfaceLanguage, getInterfaceLanguage);
  const list = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [preview, setPreview] = useState<string>();
  const [moderating, setModerating] = useState<LoungeAccount>();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reply, setReply] = useState<LoungeReply>();
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [blocking, setBlocking] = useState<LoungeAccount>();
  const contact = state.contacts.find(value => value.user.id === state.conversation);
  const select = (user?: LoungeAccount) => { controller.selectConversation(user); setPeopleOpen(false); setAtBottom(true); };
  useEffect(() => setReply(undefined), [controller, state.conversation]);
  const quote = (message: LoungeMessage) => { setReply(quoteMessage(message)); setHistoryOpen(false); };
  const [now, setNow] = useState(Date.now);
  const mutedUntil = state.policy.mutedUntil;
  const muted = !!mutedUntil && Date.parse(mutedUntil) > now;
  useEffect(() => {
    if (!muted) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [muted, mutedUntil]);
  useEffect(() => {
    controller.setViewing(atBottom && !historyOpen && !avatarOpen && !peopleOpen);
    return () => controller.setViewing(false);
  }, [controller, atBottom, historyOpen, avatarOpen, peopleOpen]);
  useLayoutEffect(() => { if (atBottom && list.current) list.current.scrollTop = list.current.scrollHeight; },
    [state.messages, atBottom]);
  const scrollBottom = () => { setAtBottom(true); if (list.current) list.current.scrollTop = list.current.scrollHeight; };
  const signedOut = state.status === 'signed-out';
  return <section className="lounge-layout">
    <aside className="lounge-sidebar"><LoungePeople state={state} select={select} block={setBlocking} /></aside>
    <section className="lounge-page">
    <header className="lounge-heading"><div className="lounge-heading-title">
      <button className="lounge-people-toggle" type="button" aria-label={t('client.lounge.people')}
        onClick={() => setPeopleOpen(true)}><Users size={21} /></button>
      {!contact && <Coffee size={21} />}<h1>{contact?.user.account ?? t('client.lounge.title')}</h1></div>
      <div className="lounge-heading-actions"><span className={`lounge-connection is-${state.status}`} role="status">
        <i />{t(`client.lounge.${state.status}`)}</span>
        {contact && <span className="lounge-peer-status">{t(contactStatus(contact))}</span>}
        {contact && state.directAvailable && <button type="button" className="lounge-block-button"
          aria-label={t(state.blocked.includes(contact.user.id) ? 'client.lounge.unblockUser' : 'client.lounge.blockUser')}
          title={t(state.blocked.includes(contact.user.id) ? 'client.lounge.unblockUser' : 'client.lounge.blockUser')}
          onClick={() => setBlocking(contact.user)}><Ban size={18} /></button>}
        {state.policy.moderator && state.onlineCount !== undefined && <span className="lounge-online-count">
          {t('client.lounge.onlineCount', { count: state.onlineCount })}</span>}
        {state.user && <button type="button" className="lounge-avatar-trigger" onClick={() => setAvatarOpen(true)}
          aria-label={t('client.lounge.avatarSettings')} title={t('client.lounge.avatarSettings')}>
          <LoungeAvatar user={state.user} /></button>}</div></header>
    <div className="lounge-conversation" ref={list} role="log" aria-live="off" aria-label={t('client.lounge.title')}
      onScroll={() => {
        const node = list.current;
        if (node) setAtBottom(node.scrollHeight - node.clientHeight - node.scrollTop < 48);
      }}>
      {!state.messages.length && <div className="lounge-empty"><Coffee size={40} />
        <h2>{t(signedOut ? 'client.lounge.signIn' : contact ? 'client.lounge.directEmpty' : 'client.lounge.empty')}</h2>
        <p>{t(contact ? 'client.lounge.directHint' : 'client.lounge.ephemeral')}</p>
        {signedOut && onLogin && <button type="button" onClick={onLogin}>{t('client.lounge.login')}</button>}
      </div>}
      {state.messages.map((message, index) => {
        const own = message.sender.id === state.user?.id;
        const previous = state.messages[index - 1];
        const showTime = !previous || Date.parse(message.sentAt) - Date.parse(previous.sentAt) > 5 * 60_000;
        return <div key={`${message.sender.id}:${message.id}`}>
          {showTime && <div className="lounge-time"><time dateTime={message.sentAt}>
            {new Intl.DateTimeFormat(localeForLanguage(language), { hour: '2-digit', minute: '2-digit' })
              .format(new Date(message.sentAt))}</time></div>}
          <article className={`lounge-message${own ? ' is-own' : ''}`}>
            <LoungeAvatar user={message.sender} />
            <div className="lounge-message-main">
              {state.policy.moderator && !own ? <button type="button" className="lounge-account lounge-account-action"
                aria-label={t('client.lounge.manageUser', { account: message.sender.account })}
                onClick={() => setModerating(message.sender)}>{message.sender.account}</button>
                : <div className="lounge-account">{message.sender.account}</div>}
              <LoungeMessageBody message={message} preview={setPreview}
                actions={{ reply: quote, blocked: state.blocked.includes(message.sender.id),
                  direct: !own && state.directAvailable ? () => select(message.sender) : undefined,
                  block: !own && state.directAvailable ? () => setBlocking(message.sender) : undefined }}
                onImageLoad={() => { if (atBottom && list.current) list.current.scrollTop = list.current.scrollHeight; }} />
            </div>
          </article>
        </div>;
      })}
    </div>
    {!atBottom && <button className="lounge-jump" type="button" onClick={scrollBottom}>
      <ArrowDown size={15} />{t('client.lounge.latest')}{state.unread > 0 && ` · ${state.unread}`}</button>}
    {muted && <p className="lounge-mute-notice" role="status">{t('client.lounge.mutedUntil', {
      time: new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: 'short', timeStyle: 'short' })
        .format(new Date(mutedUntil!)),
    })}</p>}
    {!!state.conversation && state.status === 'connected' && !state.directAvailable
      && <p className="lounge-mute-notice" role="status">{t('client.lounge.directUpgrade')}</p>}
    {state.historyError && <p className="lounge-history-warning" role="alert">{t('client.lounge.historySaveFailed')}
      <button type="button" onClick={() => void controller.retryHistory()}>{t('client.lounge.historyRetry')}</button></p>}
    <LoungeComposer key={`${state.user?.id ?? 'guest'}:${state.conversation}`}
      connected={state.status === 'connected' && !muted && (!state.conversation || state.directAvailable)} mobile={mobile}
      reply={reply} cancelReply={sent => setReply(current => !sent || current === sent ? undefined : current)}
      send={draft => controller.send({ ...draft, to: state.conversation || undefined })}
      onHistory={() => setHistoryOpen(true)} />
    <LoungeHistory open={historyOpen} close={() => setHistoryOpen(false)} controller={controller}
      preview={setPreview} reply={quote} />
    {avatarOpen && state.user && <LoungeAvatarSettings user={state.user} controller={controller}
      close={() => setAvatarOpen(false)} />}
    {moderating && state.policy.moderator && <LoungeModeration user={moderating} controller={controller}
      close={() => setModerating(undefined)} />}
    <Modal open={!!preview} footer={null} width="min(900px, 90vw)" centered destroyOnClose
      title={t('client.lounge.previewImage')} closeIcon={<X size={20} />} onCancel={() => setPreview(undefined)}>
      {preview && <img className="lounge-preview" src={preview} alt={t('client.lounge.image')} />}
    </Modal>
    {blocking && <LoungeBlockDialog user={blocking} blocked={state.blocked.includes(blocking.id)}
      controller={controller} close={() => setBlocking(undefined)} />}
    <Drawer open={peopleOpen} width="min(320px, 100vw)" placement="left" title={t('client.lounge.people')}
      onClose={() => setPeopleOpen(false)} styles={{ body: { padding: 0 } }}>
      <LoungePeople state={state} select={select} block={setBlocking} />
    </Drawer>
    </section>
  </section>;
}
