import { displayText } from '../i18n/index';
import { displayError } from '../i18n/index';
import { lazy, Suspense, useContext, useMemo } from 'react';
import { WorkspaceDrawerContext, workspaceTabId } from '../../../../shared/chat/workspaceDrawer';
import { WorkspaceDrawerTab } from '../../../../shared/chat/WorkspaceDrawerTab';
import { Button, Drawer, Spin, Tooltip } from 'antd';
import { PanelBottom, SquareTerminal } from 'lucide-react';
import type { GuiToolsClient } from '../../../../shared/remote-chat/guiTools';
import { useRemoteTerminalLauncher } from '../../../../shared/remote-chat/useRemoteTerminalLauncher';
import { remoteTerminalApi } from '../../../../shared/remote-chat/terminalApi';
import { useDesktopLayout } from '../useDesktopLayout';
import { t, useLanguage } from '../i18n';
import './terminal.css';
import { useToolLaunch } from '../../../../shared/remote-chat/useToolLaunch';

const TerminalPanel = lazy(() => import('../../../desktop/src/pages/codexGui/terminal/TerminalPanel'));
const TERMINAL_ICON = <SquareTerminal size={16} />;

/** Switching projects detaches the view; each PC retains the project's terminal sessions. */
export function ChatTerminal({ client, cwd, active, connected, deviceName, launchId = 0, hideTrigger = false }: {
  client: GuiToolsClient['terminal']; cwd: string; active: boolean; connected: boolean; deviceName?: string;
  launchId?: number; hideTrigger?: boolean;
}) {
  useLanguage();
  const desktop = useDesktopLayout();
  const workspace = useContext(WorkspaceDrawerContext);
  const shared = desktop && Boolean(workspace);
  const id = workspaceTabId.terminal(cwd);
  const panel = useRemoteTerminalLauncher({ client, cwd, connected });
  const api = useMemo(() => remoteTerminalApi(client), [client]);
  const visible = active && (shared ? workspace?.tabs.visible && workspace.tabs.selected === id : panel.open);
  const toggle = () => {
    if (!shared) { panel.toggle(); return; }
    if (visible) { workspace?.tabs.hide(); return; }
    workspace?.tabs.open(id);
    if (!panel.open) panel.toggle();
  };
  useToolLaunch(launchId, toggle, connected && !panel.busy);
  const label = visible ? t("client.chat.hideRemoteTerminal") : t("client.chat.openRemoteTerminal");
  const content = (shown: boolean) => panel.tabs.length ? <Suspense
    fallback={<div className="chat-terminal-loading"><Spin />{t("client.chat.openingTerminal")}</div>}>
    <TerminalPanel panel={panel} api={api} active={shown} fill translate={displayText} notice={panel.error} />
  </Suspense> : <div className="chat-terminal-empty">
    {panel.busy ? <div className="chat-terminal-loading"><Spin />{t("client.chat.openingTerminal")}</div>
      : <>{panel.error && <p role="alert">{displayError(panel.error)}</p>}
        <button type="button" className="chat-button" disabled={!connected} onClick={panel.retry}>
          {panel.error ? t("client.terminal.retry") : t("client.chat.newTerminal")}</button></>}
  </div>;
  return <>
    {!hideTrigger && (desktop ? <Tooltip title={label} styles={{ root: { maxWidth: 400 } }}>
      <Button type="text" icon={<PanelBottom size={16} />} aria-label={label} aria-expanded={Boolean(visible)}
        disabled={panel.busy || (!connected && !panel.tabs.length && !panel.error)} onClick={toggle} />
    </Tooltip> : <button type="button" className="chat-terminal-toggle" aria-label={label} data-error={!!panel.error}
      aria-expanded={visible} disabled={panel.busy || (!connected && !panel.tabs.length && !panel.error)}
      onClick={toggle}>
      <SquareTerminal size={22} /></button>)}
    {(panel.open || panel.tabs.length > 0) && (shared ? <WorkspaceDrawerTab active={active && panel.open}
      tab={{ id, title: t("client.chat.remoteTerminal"), icon: TERMINAL_ICON }}>{content}</WorkspaceDrawerTab>
      : <Drawer open={visible} placement="bottom" height="90%"
      title={t("client.chat.remoteTerminal")} extra={<span className="chat-terminal-device">{deviceName}</span>}
      rootClassName="chat-terminal-drawer" onClose={panel.hide}
      closable={{ 'aria-label': t("client.chat.hideTerminal"), placement: 'end' }}>
      {content(Boolean(visible))}
    </Drawer>)}
  </>;
}
