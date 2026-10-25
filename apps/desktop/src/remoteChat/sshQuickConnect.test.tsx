// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useSavedSshConnection } from '../../../../shared/terminal/useSavedSshConnection';
import type { SshApi } from '../../../../shared/terminal/ssh';
import type { SshProfile } from '../../../../shared/terminal/sshProfiles';
import type { TerminalInfo } from '../../../../shared/terminal/types';
import type { SshCredentials } from '../../../../shared/terminal/sshCredentials';

const profile: SshProfile = { id: 'desktop', name: 'Desktop server', host: 'saved.test', port: 22,
  username: 'user', auth: 'password', fingerprint: 'SHA256:saved', revision: 1, accountScope: 'account' };
const info: TerminalInfo = { id: 'ssh-1', cwd: '/', shell: 'SSH' };
afterEach(() => vi.unstubAllGlobals());

async function fixture(options: { profile?: SshProfile; authenticate?: boolean; delay?: boolean; changed?: boolean;
  credentials?: SshCredentials | null; credentialError?: string; delayCredentials?: boolean } = {}) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const saved = options.profile ?? profile;
  let resolve!: (info: TerminalInfo) => void;
  let resolveCredentials!: (value: SshCredentials) => void;
  const api: SshApi = { profiles: { list: vi.fn(async () => [saved]), save: vi.fn(async value => [value]),
    remove: vi.fn(async () => []) }, probe: vi.fn(async () => options.changed ? 'SHA256:changed' : 'SHA256:saved'),
  open: vi.fn(async request => {
    if (options.authenticate && request.password !== 'secret') throw new Error('client.ssh.authenticationFailed');
    return options.delay ? new Promise<TerminalInfo>(done => { resolve = done; }) : info;
  }), files: vi.fn() };
  if ('credentials' in options || options.credentialError) api.profiles.credentials = vi.fn(async () => {
    if (options.credentialError) throw new Error(options.credentialError);
    if (options.delayCredentials) return new Promise<SshCredentials>(done => { resolveCredentials = done; });
    return options.credentials ?? undefined;
  });
  const connected = vi.fn(); const dispose = vi.fn(async () => {}); const close = vi.fn();
  let state!: ReturnType<typeof useSavedSshConnection>;
  function Fixture() {
    state = useSavedSshConnection({ api, profile: saved, projectCwd: '/project', connected, dispose, close });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<StrictMode><Fixture /></StrictMode>));
  return { api, connected, dispose, close, state: () => state, resolve: () => resolve(info),
    resolveCredentials: () => resolveCredentials({ password: 'secret' }),
    stop: () => act(async () => root.unmount()) };
}

it('opens a saved connection once without rewriting its synced settings', async () => {
  const f = await fixture();
  try {
    expect(f.api.open).toHaveBeenCalledExactlyOnceWith({ endpoint: { host: 'saved.test', port: 22 },
      username: 'user', fingerprint: 'SHA256:saved', size: { cols: 80, rows: 24 }, password: undefined }, '/project');
    expect(f.connected).toHaveBeenCalledExactlyOnceWith(info); expect(f.close).toHaveBeenCalledOnce();
    expect(f.api.profiles.save).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('asks for credentials after authentication fails and saves successful login details separately', async () => {
  const f = await fixture({ authenticate: true });
  try {
    expect(f.state().needsCredentials).toBe(true); expect(f.connected).not.toHaveBeenCalled();
    expect(f.state().error).toBe('');
    await act(async () => f.state().setCredential('password', 'wrong'));
    await act(async () => f.state().connect());
    expect(f.state().error).toBe('client.ssh.authenticationFailed');
    await act(async () => f.state().setCredential('password', 'secret'));
    await act(async () => Promise.all([f.state().connect(), f.state().connect()]));
    expect(f.api.open).toHaveBeenCalledTimes(3); expect(f.connected).toHaveBeenCalledOnce();
    expect(f.api.profiles.save).toHaveBeenCalledExactlyOnceWith(profile, { password: 'secret' });
    expect(f.state().values.password).toBeUndefined();
  } finally { await f.stop(); }
});

it('requests a missing private key without opening the settings editor or attempting password login', async () => {
  const f = await fixture({ profile: { ...profile, auth: 'key' } });
  try {
    expect(f.state().needsCredentials).toBe(true); expect(f.api.open).not.toHaveBeenCalled();
    await act(async () => f.state().setCredential('privateKey', 'test-key'));
    await act(async () => f.state().connect());
    expect(f.api.open).toHaveBeenCalledWith(expect.objectContaining({ privateKey: 'test-key' }), '/project');
    expect(f.api.profiles.save).toHaveBeenCalledExactlyOnceWith({ ...profile, auth: 'key' },
      { privateKey: 'test-key', passphrase: '' });
  } finally { await f.stop(); }
});

it('requires confirmation before connecting a saved host without a known fingerprint', async () => {
  const f = await fixture({ profile: { ...profile, fingerprint: undefined } });
  try {
    expect(f.state().trust?.fingerprint).toBe('SHA256:saved'); expect(f.api.open).not.toHaveBeenCalled();
    await act(async () => f.state().connect());
    expect(f.connected).toHaveBeenCalledOnce();
    expect(f.api.profiles.save).toHaveBeenCalledWith(profile);
  } finally { await f.stop(); }
});

it('blocks a changed host fingerprint before attempting authentication', async () => {
  const f = await fixture({ changed: true, credentials: { password: 'secret' } });
  try {
    expect(f.state().error).toBe('client.ssh.hostChanged'); expect(f.api.open).not.toHaveBeenCalled();
    expect(f.api.profiles.credentials).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it.each([{ auth: 'password' as const, credentials: { password: 'secret' } },
  { auth: 'key' as const, credentials: { privateKey: 'encrypted-private-key', passphrase: 'key-password' } }])
('connects synchronized $auth credentials automatically without exposing them in form state', async options => {
  const f = await fixture({ profile: { ...profile, auth: options.auth }, credentials: options.credentials });
  try {
    expect(f.api.profiles.credentials).toHaveBeenCalledExactlyOnceWith({ ...profile, auth: options.auth });
    expect(f.api.open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(options.credentials), '/project');
    expect(f.connected).toHaveBeenCalledOnce(); expect(f.state().needsCredentials).toBe(false);
    expect(f.state().values).toEqual({ ...profile, auth: options.auth });
    expect(f.api.profiles.save).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('asks for missing legacy credentials without attempting an empty-password login', async () => {
  const f = await fixture({ credentials: null });
  try {
    expect(f.state().needsCredentials).toBe(true); expect(f.api.open).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('keeps credential loading errors visible and does not fall back to another login target', async () => {
  const f = await fixture({ credentialError: 'client.ssh.profileChanged' });
  try {
    expect(f.state().error).toBe('client.ssh.profileChanged'); expect(f.api.open).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('disposes a late connection after the user leaves', async () => {
  const f = await fixture({ delay: true });
  await f.stop();
  await act(async () => f.resolve());
  expect(f.dispose).toHaveBeenCalledExactlyOnceWith(info.id); expect(f.connected).not.toHaveBeenCalled();
});

it('does not open a session when credential retrieval finishes after the user leaves', async () => {
  const f = await fixture({ credentials: { password: 'secret' }, delayCredentials: true });
  await f.stop();
  await act(async () => f.resolveCredentials());
  expect(f.api.open).not.toHaveBeenCalled(); expect(f.connected).not.toHaveBeenCalled();
});
