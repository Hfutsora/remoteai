import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, Coffee, X } from 'lucide-react';
import { Modal } from 'antd';
import { displayText as t } from '../localization/messages';
import { getInterfaceLanguage, subscribeInterfaceLanguage } from '../localization/interfaceLanguage';
import { localeForLanguage } from '../localization/language';
import { initials, type LoungeAccount } from './types';
import type { LoungeController } from './controller';
import { LoungeComposer } from './LoungeComposer';
import { LoungeModeration } from './LoungeModeration';
import './lounge.css';

export function LoungePage({ controller, onLogin }: { controller: LoungeController; onLogin?: () => void }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const language = useSyncExternalStore(subscribeInterfaceLanguage, getInterfaceLanguage);
  const list = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [preview, setPreview] = useState<string>();
  const [moderating, setModerating] = useState<LoungeAccount>();
  const [now, setNow] = useState(Date.now);
  const mutedUntil = state.policy.mutedUntil;
  const muted = !!mutedUntil && Date.parse(mutedUntil) > now;
  useEffect(() => {
    if (!muted) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [muted, mutedUntil]);
  useEffect(() => { controller.setViewing(atBottom); return () => controller.setViewing(false); }, [controller, atBottom]);
  useLayoutEffect(() => { if (atBottom && list.current) list.current.scrollTop = list.current.scrollHeight; },
    [state.messages, atBottom]);
  const scrollBottom = () => { setAtBottom(true); if (list.current) list.current.scrollTop = list.current.scrollHeight; };
  const signedOut = state.status === 'signed-out';
  return <section className="lounge-page">
    <header className="lounge-heading"><div><Coffee size={21} /><h1>{t('client.lounge.title')}</h1></div>
      <span className={`lounge-connection is-${state.status}`} role="status">
        <i />{t(`client.lounge.${state.status}`)}</span></header>
    <div className="lounge-conversation" ref={list} role="log" aria-live="off" aria-label={t('client.lounge.title')}
      onScroll={() => {
        const node = list.current;
        if (node) setAtBottom(node.scrollHeight - node.clientHeight - node.scrollTop < 48);
      }}>
      {!state.messages.length && <div className="lounge-empty"><Coffee size={40} />
        <h2>{t(signedOut ? 'client.lounge.signIn' : 'client.lounge.empty')}</h2>
        <p>{t('client.lounge.ephemeral')}</p>
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
            <span className="lounge-avatar" aria-hidden>{initials(message.sender.account)}</span>
            <div className="lounge-message-main">
              {state.policy.moderator && !own ? <button type="button" className="lounge-account lounge-account-action"
                aria-label={t('client.lounge.manageUser', { account: message.sender.account })}
                onClick={() => setModerating(message.sender)}>{message.sender.account}</button>
                : <div className="lounge-account">{message.sender.account}</div>}
              <div className={`lounge-bubble${!message.text.trim() && message.images.length ? ' image-only' : ''}`}>
                {message.text && <div className="lounge-text">{message.text}</div>}
                {message.images.map((source, imageIndex) => <button type="button" key={imageIndex}
                  className="lounge-image" aria-label={t('client.lounge.previewImage')} onClick={() => setPreview(source)}>
                  <img src={source} alt={t('client.lounge.image')}
                    onLoad={() => { if (atBottom && list.current) list.current.scrollTop = list.current.scrollHeight; }} />
                </button>)}
              </div>
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
    <LoungeComposer key={state.user?.id ?? 'guest'} connected={state.status === 'connected' && !muted}
      send={draft => controller.send(draft)} />
    {moderating && state.policy.moderator && <LoungeModeration user={moderating} controller={controller}
      close={() => setModerating(undefined)} />}
    <Modal open={!!preview} footer={null} width="min(900px, 90vw)" centered destroyOnClose
      title={t('client.lounge.previewImage')} closeIcon={<X size={20} />} onCancel={() => setPreview(undefined)}>
      {preview && <img className="lounge-preview" src={preview} alt={t('client.lounge.image')} />}
    </Modal>
  </section>;
}
