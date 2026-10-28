import { useMemo } from 'react';
import { LoungeController } from '../../../../shared/lounge/controller';
import { useLounge } from '../../../../shared/lounge/useLounge';
import { invoke } from '../api/backend';
import type { CloudAuthState } from '../types';

export function useDesktopLounge(auth: CloudAuthState) {
  const { authenticated, baseUrl, userId } = auth;
  const controller = useMemo(() => new LoungeController(authenticated && baseUrl && userId ? {
    baseUrl, authorize: () => invoke<{ ticket: string }>('cloud_lounge_ticket', { identity: { baseUrl, userId } }),
  } : undefined), [authenticated, baseUrl, userId]);
  const state = useLounge(controller);
  return { controller, state };
}
