import { useLayoutEffect, useRef } from 'react';
import { MessagesSquare } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import type { MobileLounge } from './useMobileLounge';
import { LoungeAvatar } from './LoungeAvatar';
import { LoungeMessageBody } from './LoungeMessageBody';

export function MobileLoungeThread({ model }: { model: MobileLounge }) {
  const { state, offsets, scrollPositions, atBottom, setAtBottom } = model;
  const list = useRef<HTMLDivElement>(null);
  const restoring = useRef(true);
  const scrollBottom = () => {
    if (atBottom && list.current) list.current.scrollTop = list.current.scrollHeight;
  };
  useLayoutEffect(() => {
    const node = list.current;
    if (!node) return;
    restoring.current = true;
    const position = scrollPositions.current.get(state.conversation) ?? 0;
    const frame = requestAnimationFrame(() => {
      node.scrollTop = atBottom ? node.scrollHeight : position;
      restoring.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [state.conversation, state.messages, atBottom, scrollPositions]);
  return <div ref={list} className="lounge-conversation" role="log" aria-live="off"
    aria-label={t('client.lounge.title')} onScroll={() => {
      const node = list.current;
      if (!node || restoring.current) return;
      const offset = Math.max(0, node.scrollHeight - node.clientHeight - node.scrollTop);
      offsets.current.set(state.conversation, offset);
      scrollPositions.current.set(state.conversation, node.scrollTop); setAtBottom(offset < 48);
    }}>
    {!state.messages.length && <div className="lounge-empty">
      <span className="lounge-empty-symbol"><MessagesSquare size={27} /></span>
      <h2>{t(model.contact ? 'client.lounge.directEmpty' : 'client.lounge.empty')}</h2>
      <p>{t('client.lounge.emptyHint')}</p>
      <button type="button" className="lounge-greeting" onClick={() => model.draftState.change({
        ...model.draftState.draft, text: t(model.contact ? 'client.lounge.directGreeting' : 'client.lounge.greeting'),
      })}>{t(model.contact ? 'client.lounge.directGreeting' : 'client.lounge.greeting')}</button>
    </div>}
    {state.messages.map(message => {
      const own = message.sender.id === state.user?.id;
      return <article key={`${message.sender.id}:${message.id}`} className={`lounge-message${own ? ' is-own' : ''}`}>
        {!own && <LoungeAvatar user={message.sender} />}
        <div className="lounge-message-main">
          {!own && (state.policy.moderator ? <button type="button" className="lounge-account lounge-account-action"
            aria-label={t('client.lounge.manageUser', { account: message.sender.account })}
            onClick={() => model.setModerating(message.sender)}>{message.sender.account}</button>
            : <div className="lounge-account">{message.sender.account}</div>)}
          <LoungeMessageBody message={message} preview={model.setPreview} onImageLoad={scrollBottom}
            actions={{ reply: model.quote, blocked: state.blocked.includes(message.sender.id),
              direct: !own && state.directAvailable ? () => model.select(message.sender) : undefined,
              block: !own && state.directAvailable ? () => model.setBlocking(message.sender) : undefined }} />
          <time className="lounge-message-time" dateTime={message.sentAt}>
            {new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
      </article>;
    })}
  </div>;
}
