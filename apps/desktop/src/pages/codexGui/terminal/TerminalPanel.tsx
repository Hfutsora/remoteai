import { displayText } from "../../../i18n/uiText";
import { useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { FolderSearch, Plus, SquareTerminal, X } from "lucide-react";
import { Tooltip } from "antd";
import { MAX_TERMINAL_TABS, type TerminalPanelState, type TerminalTab } from "./useTerminalPanel";
import { useTerminalResize } from "./useTerminalResize";
import { useTerminalSession } from "./useTerminalSession";
import type { TerminalApi } from "../../../../../../shared/terminal/types";
import styles from "./terminal.module.less";
import { TerminalKeys } from './TerminalKeys';
import { TerminalLinkMenu, type TerminalLinkTarget } from './TerminalLinkMenu';
import { SshMenu } from '../../../../../../shared/terminal/SshMenu';
import { SshFiles, sshFilesTabId } from '../../../../../../shared/terminal/SshFiles';
import { WorkspaceDrawerContext } from '../../../../../../shared/chat/workspaceDrawer';
import { sshLabel } from '../../../../../../shared/terminal/sshProfiles';
import { useGuiLanguage } from '../../../i18n/useGuiLanguage';


export default function TerminalPanel({ panel, active, api, fill = false, translate = displayText, notice, empty }: {
  panel: TerminalPanelState; active: boolean; api: TerminalApi; fill?: boolean;
  translate?: (source: string) => string;
  notice?: string;
  empty?: ReactNode;
}) {
  useGuiLanguage();
  const host = useRef<HTMLElement>(null);
  const resize = useTerminalResize(host);
  const visible = panel.open && active;
  const workspace = useContext(WorkspaceDrawerContext);
  const [fileTabs, setFileTabs] = useState<string[]>([]);
  const selectedSession = panel.tabs.find(tab => tab.id === panel.selected)?.session;
  return <section ref={host} className={`${styles.panel} ${fill ? styles.fill : ''}`}
    hidden={!visible} aria-label={translate("client.projectBrowser.terminal")} style={fill ? undefined : { height: resize.height }}>
    {!fill && <div className={styles.resize} role="separator" tabIndex={0} aria-label={translate("client.chat.resizeTerminalHeight")}
      aria-orientation="horizontal" aria-valuemin={resize.minimum} aria-valuemax={resize.maximum}
      aria-valuenow={resize.height} {...resize.handle} />}
    <div className={styles.toolbar}>
      <div className={styles.tabs} role="tablist" aria-label={translate("client.chat.terminalTabs")}>
        {panel.tabs.map((tab, index) => <div key={tab.id} className={styles.tab} data-selected={panel.selected === tab.id}>
          <Tooltip title={tab.cwd || translate("client.projectBrowser.terminal")} styles={{ root: { maxWidth: 400 } }}>
            <button role="tab" id={`terminal-tab-${tab.id}`} aria-selected={panel.selected === tab.id}
              aria-controls={`terminal-pane-${tab.id}`} onClick={() => panel.select(tab.id)}>
              <SquareTerminal size={15} /><span>{tab.session?.ssh ? sshLabel(tab.session.ssh)
                : tab.cwd || `${translate("client.projectBrowser.terminal")} ${index + 1}`}</span></button>
          </Tooltip>
          <button aria-label={`${translate("client.chat.closeTerminal")} ${index + 1}`} onClick={() => panel.remove(tab.id)}>
            <X size={14} /></button>
        </div>)}
      </div>
      <Tooltip title={translate("client.chat.newTerminal")} styles={{ root: { maxWidth: 400 } }}>
        <button className={styles.iconButton} aria-label={translate("client.chat.newTerminal")} onClick={panel.add}
          disabled={panel.tabs.length >= MAX_TERMINAL_TABS}><Plus size={18} /></button>
      </Tooltip>
      {api.ssh && panel.adopt && <SshMenu key={panel.projectCwd} api={api.ssh} projectCwd={panel.projectCwd ?? ''}
        adopt={panel.adopt} close={api.close} className={styles.iconButton}
        disabled={panel.tabs.length >= MAX_TERMINAL_TABS} />}
      {api.ssh && selectedSession?.ssh && <Tooltip title={translate('client.ssh.files')}
        styles={{ root: { maxWidth: 400 } }}>
        <button className={`${styles.iconButton} ${styles.close}`} aria-label={translate('client.ssh.files')}
          onClick={() => {
            setFileTabs(previous => previous.includes(selectedSession.id) ? previous : [...previous, selectedSession.id]);
            workspace?.tabs.open(sshFilesTabId(selectedSession.id));
          }}><FolderSearch size={17} /></button>
      </Tooltip>}
      {!fill && <button className={`${styles.iconButton} ${styles.close}`}
        style={selectedSession?.ssh ? { marginLeft: 0 } : undefined}
        aria-label={translate("client.chat.hideTerminal")} onClick={panel.hide}><X size={17} /></button>}
    </div>
    {notice && <div className={styles.status} role="alert">{translate(notice)}</div>}
    {!panel.tabs.length && empty}
    {panel.tabs.map((tab) => <TerminalPane key={tab.id} tab={tab} api={api} translate={translate} shortcuts={fill}
      visible={visible && panel.selected === tab.id} />)}
    {api.ssh && panel.tabs.filter(tab => tab.session?.ssh && fileTabs.includes(tab.session.id)).map(tab =>
      <SshFiles key={tab.id} info={tab.session!} api={api.ssh!} active={active} />)}
  </section>;
}

function TerminalPane({ tab, visible, api, translate, shortcuts }: {
  tab: TerminalTab; visible: boolean; api: TerminalApi; translate: (source: string) => string;
  shortcuts: boolean;
}) {
  const [link, setLink] = useState<TerminalLinkTarget>();
  const closeLink = useCallback(() => setLink(undefined), []);
  const { host, info, status, input } = useTerminalSession({ cwd: tab.cwd, visible, api,
    session: tab.session, onLink: setLink });
  return <div className={styles.pane} hidden={!visible} role="tabpanel" id={`terminal-pane-${tab.id}`}
    aria-labelledby={`terminal-tab-${tab.id}`}>
    <div ref={host} className={styles.screen} aria-label={info?.shell ?? translate("client.projectBrowser.terminal")} />
    {status && <div className={styles.status} role="status">{translate(status)}</div>}
    {shortcuts && <TerminalKeys input={input} />}
    {link && visible && <TerminalLinkMenu key={`${link.url}:${link.x}:${link.y}`} target={link} id={info?.id}
      api={api} close={closeLink} translate={translate} />}
  </div>;
}
