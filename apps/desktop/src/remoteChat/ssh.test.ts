// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { RemoteTerminals } from './terminals';
import { openNativeSsh, sshFiles } from '../pages/codexGui/terminal/sshApi';
import type { TerminalEvent } from '../../../../shared/terminal/types';

vi.mock('../pages/codexGui/terminal/sshApi', () => ({
  openNativeSsh: vi.fn(), sshFiles: vi.fn(), probeSsh: vi.fn(),
}));
vi.mock('../pages/codexGui/terminal/api', () => ({
  terminalApi: { open: vi.fn(), write: vi.fn(), resize: vi.fn(), close: vi.fn() },
}));
vi.mock('../api/backend', () => ({ invoke: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it('scopes SSH files to the authenticated terminal owner and retains project association', async () => {
  const terminals = new RemoteTerminals();
  vi.mocked(openNativeSsh).mockResolvedValue({ id: 'ssh-test', cwd: '', shell: 'SSH',
    ssh: { host: '127.0.0.1', port: 22, username: 'fixture' } });
  await terminals.request({ operation: 'guiTerminalSshOpen', cwd: '/project', request: {} }, 'owner');
  const files = { operation: 'guiTerminalSshFiles', id: 'ssh-test', request: { type: 'list', path: '.' } };
  await expect(terminals.request(files, 'intruder')).rejects.toThrow();
  expect(sshFiles).not.toHaveBeenCalled();
  await terminals.request(files, 'owner');
  expect(sshFiles).toHaveBeenCalledWith('ssh-test', { type: 'list', path: '.' });
  expect(await terminals.request({ operation: 'guiTerminalList', cwd: '/project' }, 'owner'))
    .toEqual([expect.objectContaining({ id: 'ssh-test', projectCwd: '/project' })]);
  expect(await terminals.request({ operation: 'guiTerminalList', cwd: '/other' }, 'owner')).toEqual([]);
});

it('rejects SFTP after shell exit', async () => {
  const terminals = new RemoteTerminals();
  let emit!: (event: TerminalEvent) => void;
  vi.mocked(openNativeSsh).mockImplementation(async (_request, receive) => {
    emit = receive;
    return { id: 'ssh-ended', cwd: '', shell: 'SSH', ssh: { host: 'test', port: 22, username: 'fixture' } };
  });
  await terminals.request({ operation: 'guiTerminalSshOpen', cwd: '/project', request: {} }, 'owner');
  emit({ type: 'exit', code: 0 });
  await expect(terminals.request({ operation: 'guiTerminalSshFiles', id: 'ssh-ended',
    request: { type: 'list', path: '.' } }, 'owner')).rejects.toThrow('client.ssh.closed');
  expect(sshFiles).not.toHaveBeenCalled();
});
