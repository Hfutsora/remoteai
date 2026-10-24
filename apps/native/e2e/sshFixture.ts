import type { SshApi, SshEntry } from '../../../shared/terminal/ssh';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';
import type { TerminalInfo } from '../../../shared/terminal/types';

/** A separate PC store for each fixture computer; credentials are never recorded. */
const stores = new Map<string, SshProfile[]>();
export function createSshFixture(computer: string, adopt: (info: TerminalInfo) => void): SshApi {
  if (!stores.has(computer)) stores.set(computer, [{ id: 'saved', name: `Saved on ${computer}`,
    host: 'fixture.test', port: 22, username: 'fixture', auth: 'password', fingerprint: 'SHA256:fixture' }]);
  const entries: SshEntry[] = [
    { name: '中文目录', path: '/中文目录', directory: true, size: 0 },
    { name: 'hello.txt', path: '/hello.txt', directory: false, size: 5 },
  ];
  return {
    profiles: {
      list: async () => stores.get(computer) ?? [],
      save: async value => {
        const next = [...(stores.get(computer) ?? []).filter(item => item.id !== value.id), value];
        stores.set(computer, next); return next;
      },
      remove: async id => {
        const next = (stores.get(computer) ?? []).filter(item => item.id !== id);
        stores.set(computer, next); return next;
      },
    },
    probe: async () => 'SHA256:fixture',
    open: async (request, projectCwd) => {
      if (request.password === 'wrong') throw new Error('client.ssh.authenticationFailed');
      const info = { id: `ssh-${Date.now()}`, cwd: '', projectCwd, shell: 'SSH',
        ssh: { ...request.endpoint, username: request.username } };
      adopt(info); return info;
    },
    files: async (_id, action) => {
      const path = action.path === '.' ? '/' : action.path;
      if (action.type === 'list') return { type: 'list', path, truncated: false,
        entries: entries.filter(entry => entry.path.slice(0, entry.path.lastIndexOf('/')) === path.replace(/\/$/, '')) };
      if (action.type === 'read') return { type: 'file', data: 'aGVsbG8=' };
      if (action.type === 'createFolder' || action.type === 'upload') {
        entries.push({ path, name: path.split('/').at(-1)!, directory: action.type === 'createFolder', size: 0 });
      }
      if (action.type === 'rename') {
        const entry = entries.find(item => item.path === path);
        if (entry) { entry.path = action.destination; entry.name = action.destination.split('/').at(-1)!; }
      }
      if (action.type === 'delete') {
        const index = entries.findIndex(item => item.path === path);
        if (index >= 0) entries.splice(index, 1);
      }
      return { type: 'done' };
    },
  };
}
