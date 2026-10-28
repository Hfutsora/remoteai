import { X } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import type { LoungeReply } from './reply';

export function LoungeReplyPreview({ reply, cancel }: { reply: LoungeReply; cancel?: () => void }) {
  return <div className={`lounge-reply${cancel ? ' lounge-reply-draft' : ''}`}>
    <div><div className="lounge-reply-account">{t('client.lounge.replyingTo', { account: reply.account })}</div>
      <div className="lounge-reply-text">{reply.text}</div>
      {reply.imageCount > 0 && <div>{t('client.lounge.quotedImages', { count: reply.imageCount })}</div>}
    </div>
    {cancel && <button type="button" aria-label={t('client.lounge.cancelReply')} onClick={cancel}>
      <X size={16} /></button>}
  </div>;
}
