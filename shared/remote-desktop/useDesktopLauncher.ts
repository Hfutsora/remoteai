import { useEffect, useRef, useState } from 'react';
import type { DesktopScreenLaunch, DesktopScreenRequest } from './screenControl';

export function useDesktopLauncher(options: DesktopScreenLaunch & { active: boolean; connected: boolean }) {
  const [opened, setOpened] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [privacyRequest, setPrivacyRequest] = useState<DesktopScreenRequest>();
  const consumed = useRef<number>();
  const { screenRequest, screenRequestHandled, active, connected } = options;
  useEffect(() => {
    if (!active || !connected || !screenRequest || consumed.current === screenRequest.id) return;
    consumed.current = screenRequest.id;
    setPrivacyRequest(screenRequest); setOpened(true); setMinimized(false);
    screenRequestHandled?.(screenRequest.id);
  }, [active, connected, screenRequest, screenRequestHandled]);
  return { opened, minimized, setMinimized, privacyRequest,
    open: () => { setOpened(true); setMinimized(false); },
    close: () => { setOpened(false); setMinimized(false); setPrivacyRequest(undefined); } };
}
