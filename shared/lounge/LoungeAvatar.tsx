import { useState } from 'react';
import { initials, type LoungeAccount } from './types';
import { displayText as t } from '../localization/messages';

export function LoungeAvatar({ user, onDirect, onProfile }: {
  user: LoungeAccount; onDirect?: () => void; onProfile?: () => void;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  const content = user.avatar && failedSource !== user.avatar
      ? <img src={user.avatar} alt="" width={48} height={48} onError={() => setFailedSource(user.avatar)} />
      : initials(user.account);
  const action = onProfile ?? onDirect;
  return action ? <button type="button" className="lounge-avatar lounge-avatar-direct" onClick={action}
    aria-label={t(onProfile ? 'client.lounge.viewProfile' : 'client.lounge.directWith', {
      account: user.account })}>{content}</button>
    : <span className="lounge-avatar" aria-hidden>{content}</span>;
}
