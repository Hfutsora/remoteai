// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useSshConnection } from '../../../../shared/terminal/useSshConnection';
import type { SshApi } from '../../../../shared/terminal/ssh';
import type { SshProfile } from '../../../../shared/terminal/sshProfiles';
import type { TerminalInfo } from '../../../../shared/terminal/types';

afterEach(() => vi.unstubAllGlobals());
const values = { name: 'Server', host: 'test', port: 22, username: 'user', auth: 'password' as const, password: 'secret' };
const info: TerminalInfo = { id: 'ssh-1', cwd: '', projectCwd: '/project', shell: 'SSH' };

async function fixture() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const api: SshApi = { profiles: { list: vi.fn(async (): Promise<SshProfile[]> => []),
    save: vi.fn(async value => [value]), remove: vi.fn(async () => []) },
  probe: vi.fn(async () => 'SHA256:first'), open: vi.fn(async () => info), files: vi.fn() };
  const connected = vi.fn(); const dispose = vi.fn(async () => {}); const close = vi.fn();
  const root = createRoot(document.createElement('div'));
  let state!: ReturnType<typeof useSshConnection>;
  function Fixture() {
    state = useSshConnection({ api, projectCwd: '/project', createId: () => 'saved', connected, dispose, close });
    return null;
  }
  await act(async () => root.render(<Fixture />));
  return { api, connected, dispose, close, state: () => state, stop: () => act(async () => root.unmount()) };
}

it('requires host confirmation, saves metadata on the PC and adopts the opened shell once', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().submit(values));
    expect(f.state().trust?.fingerprint).toBe('SHA256:first');
    expect(f.api.open).not.toHaveBeenCalled();
    await act(async () => Promise.all([f.state().submit(values), f.state().submit(values)]));
    expect(f.api.open).toHaveBeenCalledTimes(1);
    expect(f.api.profiles.save).toHaveBeenCalledWith({ id: 'saved', name: 'Server', host: 'test', port: 22,
      username: 'user', auth: 'password', fingerprint: 'SHA256:first' });
    expect(f.connected).toHaveBeenCalledWith(info);
    expect(f.close).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it('checks a freshly pulled fingerprint and blocks changed hosts before sending credentials', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().submit(values));
    vi.mocked(f.api.profiles.list).mockResolvedValue([{ ...values, id: 'pc', fingerprint: 'SHA256:other' }]);
    await act(async () => f.state().submit(values));
    expect(f.state().error).toBe('client.ssh.hostChanged');
    expect(f.api.open).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('reports failed persistence while retaining the connected shell', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().submit(values));
    vi.mocked(f.api.profiles.save).mockRejectedValue(new Error('offline'));
    await act(async () => f.state().submit(values));
    expect(f.state().error).toBe('client.ssh.storageFailed');
    expect(f.connected).toHaveBeenCalledWith(info);
    expect(f.close).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('closes a late connection after leaving the form instead of adopting it in another project', async () => {
  const f = await fixture();
  await act(async () => f.state().submit(values));
  let resolve!: (info: TerminalInfo) => void;
  vi.mocked(f.api.open).mockImplementation(() => new Promise(done => { resolve = done; }));
  let pending!: Promise<void>;
  await act(async () => { pending = f.state().submit(values); });
  await f.stop();
  await act(async () => { resolve(info); await pending; });
  expect(f.dispose).toHaveBeenCalledWith(info.id);
  expect(f.connected).not.toHaveBeenCalled();
  expect(f.api.profiles.save).not.toHaveBeenCalled();
});
