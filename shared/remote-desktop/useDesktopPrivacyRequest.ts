import { useEffect, useRef, useState } from 'react';
import type { DesktopDisplaySession } from './displaySession';
import { changeDesktopDisplay, type DisplayAction } from './displayActions';
import type { DesktopScreenRequest } from './screenControl';

interface Options {
  request?: DesktopScreenRequest;
  action: Omit<DisplayAction, 'allowed' | 'message' | 'run'>;
  saving: boolean;
}

/** Apply an explicit target once, after startup; never invert a stale UI snapshot. */
export function useDesktopPrivacyRequest(options: Options) {
  const latest = useRef(options); latest.current = options;
  const completed = useRef<number>();
  const attempted = useRef<number>();
  const failure = useRef('');
  const [ready, setReady] = useState<DesktopDisplaySession>();
  useEffect(() => {
    const { request, action } = latest.current;
    if (!request || !ready?.available || action.receiver.current !== ready || action.updating.current
      || completed.current === request.id) return;
    if (attempted.current === request.id) {
      if (failure.current) action.status(failure.current);
      return;
    }
    attempted.current = request.id; failure.current = '';
    void changeDesktopDisplay({ ...action, allowed: true,
      message: 'client.deviceScreen.changing', run: async current => {
        try {
          const snapshot = await current.privacy(request.enabled);
          if (action.receiver.current !== current) return;
          if (snapshot?.privacyScreen !== request.enabled) throw new Error('client.deviceScreen.failed');
          completed.current = request.id;
        } catch (error) {
          failure.current = error instanceof Error ? error.message : 'client.deviceScreen.failed';
          throw error;
        }
      } });
  }, [options.request?.id, options.saving, ready]);
  return {
    pending: () => latest.current.request !== undefined && completed.current !== latest.current.request.id,
    ready: setReady,
    applied: (id: number | undefined) => {
      if (id === latest.current.request?.id) { completed.current = id; failure.current = ''; }
    },
    retry: () => {
      if (completed.current !== latest.current.request?.id) {
        attempted.current = undefined; failure.current = '';
      }
    },
  };
}
