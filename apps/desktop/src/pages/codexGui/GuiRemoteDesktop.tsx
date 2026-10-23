import { lazy, Suspense, useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { Monitor } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import type { DesktopClient } from '../../../../../shared/remote-desktop/protocol';
import { uiText } from "../../i18n/uiText";
import { localDesktopClipboard } from '../../remoteDesktop/localClipboard';
import styles from './GuiRemoteDesktop.module.less';

const RemoteDesktop = lazy(() => import('../../../../web/src/chat/desktop/RemoteDesktop')
  .then(module => ({ default: module.RemoteDesktop })));

export function GuiRemoteDesktop({ client, active, connected }: {
  client: DesktopClient; active: boolean; connected: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [minimized, setMinimized] = useState(false);
  useEffect(() => { if (!active) { setOpened(false); setMinimized(false); } }, [active]);
  const background = opened && minimized && active;
  const label = uiText(background ? "client.remoteDesktop.restoreRemoteDesktop" : "client.remoteDesktop.openRemoteDesktop");
  const open = () => { setMinimized(false); setOpened(true); };
  const close = () => { setOpened(false); setMinimized(false); };
  return <>
    <Tooltip title={label} styles={{ root: { maxWidth: 400 } }}>
      <button type="button" className={styles.launcher} disabled={!active || (!opened && !connected)}
        aria-label={label} aria-expanded={opened && !minimized} onClick={open}>
        <Monitor size={14} aria-hidden="true" /><span>{uiText("client.remoteDesktop.remoteDesktop")}</span>
        {background && connected && <span className={styles.status} role="status" aria-label={uiText("client.remoteDesktop.runningInTheBackground")} />}
      </button>
    </Tooltip>
    <Suspense fallback={null}>
      {opened && <RemoteDesktop client={client} active={active} connected={connected} close={close}
        windowState={{ minimized, setMinimized }} nativeWindow={isTauri()}
        localClipboard={isTauri() ? localDesktopClipboard : undefined} />}
    </Suspense>
  </>;
}
