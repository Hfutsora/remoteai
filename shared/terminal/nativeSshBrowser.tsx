import type { BrowserSettings } from '../project-browser/nativeBridge';
import type { ProjectTreeOptions } from '../project-browser/ProjectTree';
import { SshProjectToolbar } from './SshProjectToolbar';
import type { NativeSshBrowserAction } from './nativeSshBrowserAction';
import './sshProjectBrowser.css';

export function nativeSshTreeOptions(settings: BrowserSettings, send: (action: NativeSshBrowserAction) => void)
  : ProjectTreeOptions | undefined {
  const ssh = settings.ssh;
  if (!ssh) return undefined;
  return {
    root: ssh.path, showHidden: ssh.hidden, revision: ssh.revision,
    renderToolbar: ({ refresh, menu }) => <SshProjectToolbar path={ssh.path}
      disabled={ssh.busy || !settings.connected} hidden={ssh.hidden}
      setHidden={value => send({ type: 'ssh', action: 'hidden', value })}
      navigate={path => send({ type: 'ssh', action: 'navigate', path })}
      pickUpload={() => send({ type: 'ssh', action: 'upload' })} actions={<>{refresh}{menu}</>} />,
  };
}
