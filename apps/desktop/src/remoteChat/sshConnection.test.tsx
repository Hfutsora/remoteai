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

async function fixture(initial?: SshProfile) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const api: SshApi = { profiles: { list: vi.fn(async (): Promise<SshProfile[]> => initial ? [initial] : []),
    save: vi.fn(async value => [value]), remove: vi.fn(async () => []) },
  probe: vi.fn(async () => 'SHA256:first'), open: vi.fn(async () => info), files: vi.fn() };
  const connected = vi.fn(); const dispose = vi.fn(async () => {}); const close = vi.fn();
  const root = createRoot(document.createElement('div'));
  let state!: ReturnType<typeof useSshConnection>;
  function Fixture() {
    state = useSshConnection({ api, initial, projectCwd: '/project', createId: () => 'saved', connected, dispose, close });
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

const keyProfile: SshProfile = { id: 'key', name: 'Server', host: 'test', port: 22, username: 'user',
  auth: 'key', fingerprint: 'SHA256:first', revision: 3, accountScope: 'account' };

it('saves a name edit without credentials or a connection and preserves all other saved fields', async () => {
  const f = await fixture(keyProfile);
  try {
    vi.mocked(f.api.probe).mockRejectedValue(new Error('offline'));
    await act(async () => f.state().saveSettings({ ...keyProfile, name: 'Renamed' }));
    expect(f.api.profiles.save).toHaveBeenCalledExactlyOnceWith({ ...keyProfile, name: 'Renamed' });
    expect(f.api.probe).not.toHaveBeenCalled(); expect(f.api.open).not.toHaveBeenCalled();
    expect(f.connected).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it.each([{ host: 'new.test' }, { port: 2222 }])('forgets the old fingerprint when saving a changed endpoint %j',
  async edit => {
    const f = await fixture(keyProfile);
    try {
      await act(async () => f.state().saveSettings({ ...keyProfile, ...edit }));
      expect(f.api.profiles.save).toHaveBeenCalledWith({ ...keyProfile, ...edit, fingerprint: undefined });
      expect(f.api.probe).not.toHaveBeenCalled();
    } finally { await f.stop(); }
  });

it('does not write an unchanged profile', async () => {
  const f = await fixture(keyProfile);
  try {
    await act(async () => f.state().saveSettings(keyProfile));
    expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it('saves a new key profile without testing or including credentials', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().saveSettings({ ...values, auth: 'key', passphrase: 'secret' }));
    expect(f.api.profiles.save).toHaveBeenCalledWith({ id: 'saved', name: 'Server', host: 'test', port: 22,
      username: 'user', auth: 'key', fingerprint: undefined });
    expect(f.api.open).not.toHaveBeenCalled(); expect(f.api.probe).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('tests authentication once, closes the test session and keeps the form open without saving', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().test(values));
    expect(f.state().trust?.fingerprint).toBe('SHA256:first'); expect(f.api.open).not.toHaveBeenCalled();
    await act(async () => Promise.all([f.state().test(values), f.state().test(values)]));
    expect(f.api.open).toHaveBeenCalledExactlyOnceWith({ endpoint: { host: 'test', port: 22 }, username: 'user',
      fingerprint: 'SHA256:first', size: { cols: 80, rows: 24 }, password: 'secret' }, '/project');
    expect(f.dispose).toHaveBeenCalledExactlyOnceWith(info.id); expect(f.state().tested).toBe(true);
    expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.connected).not.toHaveBeenCalled();
    expect(f.close).not.toHaveBeenCalled(); expect(f.state().finished).toBe(false);
    await act(async () => f.state().saveSettings(values));
    expect(f.api.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: 'SHA256:first' }));
  } finally { await f.stop(); }
});

it('keeps failed tests separate from saving and clears obsolete success feedback', async () => {
  const f = await fixture({ ...keyProfile, auth: 'password' });
  try {
    await act(async () => f.state().test(values));
    await act(async () => f.state().clearTest());
    expect(f.state().tested).toBe(false);
    vi.mocked(f.api.open).mockRejectedValue(new Error('client.ssh.authenticationFailed'));
    await act(async () => f.state().test(values));
    expect(f.state().error).toBe('client.ssh.authenticationFailed'); expect(f.state().tested).toBe(false);
    await act(async () => f.state().saveSettings({ ...values, name: 'Renamed' }));
    expect(f.api.profiles.save).toHaveBeenCalledOnce(); expect(f.close).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it('leaves edits available after a save conflict without attempting SSH authentication', async () => {
  const f = await fixture(keyProfile);
  try {
    vi.mocked(f.api.profiles.save).mockRejectedValue(new Error('client.ssh.profileChanged'));
    await act(async () => f.state().saveSettings({ ...keyProfile, name: 'Renamed' }));
    expect(f.state().error).toBe('client.ssh.profileChanged'); expect(f.state().finished).toBe(false);
    expect(f.close).not.toHaveBeenCalled(); expect(f.api.open).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('closes a late test session after the form is unmounted', async () => {
  const f = await fixture();
  await act(async () => f.state().test(values));
  let resolve!: (info: TerminalInfo) => void;
  vi.mocked(f.api.open).mockImplementation(() => new Promise(done => { resolve = done; }));
  let pending!: Promise<void>;
  await act(async () => { pending = f.state().test(values); });
  await f.stop();
  await act(async () => { resolve(info); await pending; });
  expect(f.dispose).toHaveBeenCalledWith(info.id); expect(f.connected).not.toHaveBeenCalled();
  expect(f.api.profiles.save).not.toHaveBeenCalled();
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
