import { useMemo } from 'react';
import { LoungeController } from '../../../../shared/lounge/controller';
import { browserAvatarStore } from '../../../../shared/lounge/avatar';
import { browserLoungeHistory } from '../../../../shared/lounge/browserHistory';
import { useLounge } from '../../../../shared/lounge/useLounge';
import { invoke } from '../api/backend';
import type { CloudAuthState } from '../types';

export function useDesktopLounge(auth: CloudAuthState) {
  const { authenticated, baseUrl, userId, userEmail } = auth;
  const controller = useMemo(() => new LoungeController(authenticated && baseUrl && userId ? {
    baseUrl, avatars: browserAvatarStore(baseUrl),
    history: browserLoungeHistory(baseUrl, userEmail || userId),
    authorize: () => invoke<{ ticket: string }>('cloud_lounge_ticket', { identity: { baseUrl, userId } }),
  } : undefined), [authenticated, baseUrl, userId, userEmail]);
  const state = useLounge(controller);
  return { controller, state };
}
