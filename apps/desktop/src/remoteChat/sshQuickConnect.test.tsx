// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useSavedSshConnection } from '../../../../shared/terminal/useSavedSshConnection';
import type { SshApi } from '../../../../shared/terminal/ssh';
import type { SshProfile } from '../../../../shared/terminal/sshProfiles';
import type { TerminalInfo } from '../../../../shared/terminal/types';

const profile: SshProfile = { id: 'desktop', name: 'Desktop server', host: 'saved.test', port: 22,
  username: 'user', auth: 'password', fingerprint: 'SHA256:saved', revision: 1, accountScope: 'account' };
const info: TerminalInfo = { id: 'ssh-1', cwd: '/', shell: 'SSH' };
afterEach(() => vi.unstubAllGlobals());

async function fixture(options: { profile?: SshProfile; authenticate?: boolean; delay?: boolean; changed?: boolean } = {}) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const saved = options.profile ?? profile;
  let resolve!: (info: TerminalInfo) => void;
  const api: SshApi = { profiles: { list: vi.fn(async () => [saved]), save: vi.fn(async value => [value]),
    remove: vi.fn(async () => []) }, probe: vi.fn(async () => options.changed ? 'SHA256:changed' : 'SHA256:saved'),
  open: vi.fn(async request => {
    if (options.authenticate && request.password !== 'secret') throw new Error('client.ssh.authenticationFailed');
    return options.delay ? new Promise<TerminalInfo>(done => { resolve = done; }) : info;
  }), files: vi.fn() };
  const connected = vi.fn(); const dispose = vi.fn(async () => {}); const close = vi.fn();
  let state!: ReturnType<typeof useSavedSshConnection>;
  function Fixture() {
    state = useSavedSshConnection({ api, profile: saved, projectCwd: '/project', connected, dispose, close });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<StrictMode><Fixture /></StrictMode>));
  return { api, connected, dispose, close, state: () => state, resolve: () => resolve(info),
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

it('asks only for credentials after authentication fails and keeps them out of storage', async () => {
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
    expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.state().values.password).toBeUndefined();
  } finally { await f.stop(); }
});

it('requests a missing private key without opening the settings editor or attempting password login', async () => {
  const f = await fixture({ profile: { ...profile, auth: 'key' } });
  try {
    expect(f.state().needsCredentials).toBe(true); expect(f.api.open).not.toHaveBeenCalled();
    await act(async () => f.state().setCredential('privateKey', 'test-key'));
    await act(async () => f.state().connect());
    expect(f.api.open).toHaveBeenCalledWith(expect.objectContaining({ privateKey: 'test-key' }), '/project');
    expect(f.api.profiles.save).not.toHaveBeenCalled();
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
  const f = await fixture({ changed: true });
  try {
    expect(f.state().error).toBe('client.ssh.hostChanged'); expect(f.api.open).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('disposes a late connection after the user leaves', async () => {
  const f = await fixture({ delay: true });
  await f.stop();
  await act(async () => f.resolve());
  expect(f.dispose).toHaveBeenCalledExactlyOnceWith(info.id); expect(f.connected).not.toHaveBeenCalled();
});
