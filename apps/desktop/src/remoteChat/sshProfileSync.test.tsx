// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useSshProfiles } from '../../../../shared/terminal/useSshProfiles';
import type { SshProfile, SshProfileStore } from '../../../../shared/terminal/sshProfiles';

afterEach(() => vi.unstubAllGlobals());
const profile: SshProfile = { id: 'server', name: 'Server', host: 'test', port: 22, username: 'me', auth: 'key' };

it('ignores a late reply from the previous PC and refreshes edits made on the current PC', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let resolve!: (profiles: SshProfile[]) => void;
  const first: SshProfileStore = { list: () => new Promise(done => { resolve = done; }),
    save: vi.fn(), remove: vi.fn() };
  const second: SshProfileStore = { list: vi.fn(async () => [{ ...profile, name: 'Second PC' }]),
    save: vi.fn(), remove: vi.fn() };
  const root = createRoot(document.createElement('div'));
  let state!: ReturnType<typeof useSshProfiles>;
  function Fixture({ store }: { store: SshProfileStore }) { state = useSshProfiles(store); return null; }
  try {
    await act(async () => root.render(<Fixture store={first} />));
    await act(async () => root.render(<Fixture store={second} />));
    await act(async () => resolve([{ ...profile, name: 'First PC' }]));
    expect(state.profiles.map(value => value.name)).toEqual(['Second PC']);
    vi.mocked(second.list).mockResolvedValue([{ ...profile, name: 'Edited on PC' }]);
    await act(async () => state.refresh());
    expect(state.profiles.map(value => value.name)).toEqual(['Edited on PC']);
    expect(state.loading).toBe(false);
  } finally { await act(async () => root.unmount()); }
});

it('shows a failed PC read instead of silently using this browser’s profiles', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.setItem('remoteai.ssh.profiles.v1', JSON.stringify([profile]));
  const store: SshProfileStore = { list: vi.fn(async () => { throw new Error('offline'); }),
    save: vi.fn(), remove: vi.fn() };
  const root = createRoot(document.createElement('div'));
  let state!: ReturnType<typeof useSshProfiles>;
  function Fixture() { state = useSshProfiles(store); return null; }
  try {
    await act(async () => root.render(<Fixture />));
    expect(state.error).toBe('client.ssh.loadFailed');
    expect(state.profiles).toEqual([]);
    expect(state.loading).toBe(false);
  } finally { await act(async () => root.unmount()); localStorage.clear(); }
});
