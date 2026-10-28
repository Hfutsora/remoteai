import { useState } from 'react';
import { initials, type LoungeAccount } from './types';

export function LoungeAvatar({ user }: { user: LoungeAccount }) {
  const [failedSource, setFailedSource] = useState<string>();
  return <span className="lounge-avatar" aria-hidden>
    {user.avatar && failedSource !== user.avatar
      ? <img src={user.avatar} alt="" width={48} height={48} onError={() => setFailedSource(user.avatar)} />
      : initials(user.account)}
  </span>;
}
