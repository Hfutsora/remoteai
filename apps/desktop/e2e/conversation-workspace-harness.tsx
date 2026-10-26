import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { FolderSearch, GitBranch } from 'lucide-react';
import { ProjectPicker } from '../src/pages/codexGui/ProjectPicker';
import { RemoteGuiProject } from '../src/pages/codexGui/remote/RemoteGuiProject';
import { ChatController } from '../../../shared/remote-chat/client/controller';
import { initialChatState } from '../../../shared/remote-chat/client/types';
import { gitApi, type GitStatus } from '../src/pages/codexGui/gitApi';
import type { GuiComputerNavigation } from '../src/pages/codexGui/remote/types';
import { setGuiLanguage } from '../src/i18n/uiText';
import { useGuiLanguage } from '../src/i18n/useGuiLanguage';
import styles from '../src/pages/codexGui/styles.module.less';
import 'antd/dist/reset.css';
import '../src/styles.css';
import '../../web/src/chat/desktopTools.css';

const mode = new URLSearchParams(location.search).get('mode') ?? 'local';
let branch: string | null = 'feature/conversation-context';
let unavailable = false;
const initialCwd = 'F:/projects/codex-switch';
const linkedCwd = 'F:/projects/worktrees/parallel-worktree-with-a-long-name';
const read = async (cwd: string): Promise<GitStatus> => {
  if (unavailable) throw new Error('Not a repository');
  return { cwd, branch, branches: [], changedFiles: 0, isWorktree: cwd === linkedCwd };
};
gitApi.request = request => read(request.cwd);
const controller = new ChatController(() => ({ start() {}, stop() {}, request: async () => {
  throw new Error('Unexpected fixture request');
} }));
controller.guiTools.workspace = request => read(request.cwd);
const device = { deviceId: 'remote', name: 'Office PC', platform: 'windows', online: true };
const computers: GuiComputerNavigation = { current: device, devices: [device], authenticated: true,
  loading: false, error: '', refresh() {}, choose() {}, login() {} };
setGuiLanguage('zh');

function Harness() {
  useGuiLanguage();
  const [running, setRunning] = useState(true);
  const [cwd, setCwd] = useState(initialCwd);
  const state = { ...initialChatState(), ready: true, selected: { id: 'current', cwd,
    turns: [{ id: 'turn', status: running ? 'inProgress' : 'completed', items: [] }] } };
  return <ConfigProvider><div className={`${styles.page} chat-page ${mode === 'remote' ? 'gui-remote-workspace' : ''}`}
    style={{ display: 'block', minHeight: '100vh', padding: 24 }}>
    <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <button onClick={() => setRunning(value => !value)}>{running ? 'Finish turn' : 'Start turn'}</button>
      <button onClick={() => setCwd(value => value === initialCwd ? linkedCwd : initialCwd)}>Switch conversation</button>
      <button onClick={() => { branch = 'feature/updated'; window.dispatchEvent(new Event('focus')); }}>Change branch</button>
      <button onClick={() => { unavailable = true; window.dispatchEvent(new Event('focus')); }}>Git unavailable</button>
      <button onClick={() => setGuiLanguage('en')}>English</button>
    </nav>
    <div style={{ display: 'flex', flexDirection: 'column', width: 'min(100%, 920px)', margin: '180px auto 0' }}>
      <p style={{ margin: 28 }}>正在检查项目文件…</p>
      {mode === 'local' ? <div className={styles.composerWrap}>
        <ProjectPicker value={cwd} projects={[cwd]} disabled={running} running={running} gitEnabled={false}
          active onBusyChange={() => {}} onChange={setCwd} onError={error => { throw error; }}
          actions={<><button type="button"><GitBranch size={15} /> Git</button>
            <button type="button"><FolderSearch size={15} /> 文件浏览</button></>} />
      </div> : <RemoteGuiProject state={state} controller={controller} computers={computers} active />}
      <div className={styles.composerWrap}><div className={styles.composer}>
        <textarea aria-label="Draft" placeholder="描述任务…" style={{ width: '100%', minHeight: 100,
          padding: 12, border: 0, resize: 'vertical', background: 'transparent', color: 'inherit' }} />
      </div></div>
    </div>
  </div></ConfigProvider>;
}

document.body.style.minWidth = '0';
createRoot(document.getElementById('root')!).render(<Harness />);
