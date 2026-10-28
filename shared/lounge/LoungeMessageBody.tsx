import { displayText as t } from '../localization/messages';
import type { LoungeMessage } from './types';
import { LoungeReplyPreview } from './LoungeReplyPreview';
import { LoungeMessageMenu, type LoungeMessageMenuActions } from './LoungeMessageMenu';

export function LoungeMessageBody({ message, preview, onImageLoad, actions }: {
  message: LoungeMessage; preview: (source: string) => void; onImageLoad?: () => void;
  actions?: LoungeMessageMenuActions;
}) {
  const bubble = <div className={`lounge-bubble${!message.text.trim() && message.images.length && !message.reply
    ? ' image-only' : ''}`} tabIndex={actions ? 0 : undefined}>
    {message.reply && <LoungeReplyPreview reply={message.reply} />}
    {message.text && <div className="lounge-text">{message.text}</div>}
    {message.images.map((source, index) => <button type="button" key={index}
      className="lounge-image" aria-label={t('client.lounge.previewImage')} onClick={() => preview(source)}>
      <img src={source} alt={t('client.lounge.image')} onLoad={onImageLoad} />
    </button>)}
  </div>;
  return actions ? <LoungeMessageMenu message={message} {...actions}>{bubble}</LoungeMessageMenu> : bubble;
}
