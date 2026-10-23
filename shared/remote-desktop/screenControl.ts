import { useEffect, useRef, useState } from 'react';

export interface DesktopScreenRequest { id: number; deviceId: string; enabled: boolean }
export interface DesktopScreenLaunch {
  screenRequest?: DesktopScreenRequest;
  screenRequestHandled?: (id: number) => void;
}
interface ScreenDevice { deviceId: string; platform: string; online: boolean }

export function supportsScreenControl(device: ScreenDevice) {
  return device.platform.trim().toLowerCase() === 'windows';
}

/** Requests belong to the signed-in account and are consumed only by the selected viewer. */
export function useDeviceScreenRequest(scope: string) {
  const sequence = useRef(0);
  const [pending, setPending] = useState<{ scope: string; request: DesktopScreenRequest }>();
  useEffect(() => setPending(undefined), [scope]);
  return {
    request: pending?.scope === scope ? pending.request : undefined,
    open: (device: ScreenDevice, enabled: boolean) => {
      if (!device.online || !supportsScreenControl(device)) return false;
      setPending({ scope, request: { id: ++sequence.current, deviceId: device.deviceId, enabled } });
      return true;
    },
    handled: (id: number) => setPending(current => current?.request.id === id ? undefined : current),
  };
}
