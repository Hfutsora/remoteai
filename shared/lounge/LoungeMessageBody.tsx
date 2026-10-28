import { displayText as t } from '../localization/messages';
import type { LoungeMessage } from './types';

export function LoungeMessageBody({ message, preview, onImageLoad }: {
  message: LoungeMessage; preview: (source: string) => void; onImageLoad?: () => void;
}) {
  return <div className={`lounge-bubble${!message.text.trim() && message.images.length ? ' image-only' : ''}`}>
    {message.text && <div className="lounge-text">{message.text}</div>}
    {message.images.map((source, index) => <button type="button" key={index}
      className="lounge-image" aria-label={t('client.lounge.previewImage')} onClick={() => preview(source)}>
      <img src={source} alt={t('client.lounge.image')} onLoad={onImageLoad} />
    </button>)}
  </div>;
}
