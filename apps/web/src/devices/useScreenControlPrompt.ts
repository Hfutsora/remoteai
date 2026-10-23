import { useRef } from 'react';
import { Dialog } from 'antd-mobile';
import { t } from '../i18n';
import type { RemoteDevice } from '../types';
import { supportsScreenControl } from '../../../../shared/remote-desktop/screenControl';

// Keep confirmation above the device dropdown while its closing animation finishes.
const SCREEN_CONFIRMATION_Z_INDEX = '1100';
const SCREEN_CONFIRMATION_WIDTH = 'min(400px, calc(100vw - 32px))';

export function useScreenControlPrompt(onScreenControl: (device: RemoteDevice, enabled: boolean) => void) {
  const pending = useRef(false);
  return async (device: RemoteDevice, enabled: boolean) => {
    if (pending.current || !device.online || !supportsScreenControl(device)) return;
    pending.current = true;
    try {
      if (enabled && !await Dialog.confirm({ title: t('client.deviceScreen.confirmTitle'),
        content: t('client.deviceScreen.confirmMessage'), confirmText: t('client.deviceScreen.turnOff'),
        cancelText: t('client.accounts.cancel'),
        style: { '--z-index': SCREEN_CONFIRMATION_Z_INDEX,
          '--min-width': SCREEN_CONFIRMATION_WIDTH, '--max-width': SCREEN_CONFIRMATION_WIDTH },
        bodyStyle: { maxWidth: 400, width: '100%' } })) return;
      onScreenControl(device, enabled);
    } finally { pending.current = false; }
  };
}
