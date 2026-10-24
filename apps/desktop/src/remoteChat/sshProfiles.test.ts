// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { RemoteTerminals } from './terminals';
import { createGuiToolsClient } from '../../../../shared/remote-chat/guiTools';
import { localSshProfiles, readSshProfiles, saveSshProfiles } from '../../../../shared/terminal/sshProfiles';

vi.mock('../pages/codexGui/terminal/sshApi', () => ({ openNativeSsh: vi.fn(), sshFiles: vi.fn(), probeSsh: vi.fn() }));
vi.mock('../pages/codexGui/terminal/api', () => ({ terminalApi: {} }));
vi.mock('../api/backend', () => ({ invoke: vi.fn() }));
afterEach(() => localStorage.clear());
const profile = { id: 'desktop', name: 'PC server', host: 'server.test', port: 22, username: 'me',
  auth: 'password' as const, fingerprint: 'SHA256:known' };

it('pulls existing PC profiles and saves/removes mobile records in that same store', async () => {
  const host = new RemoteTerminals();
  const request = vi.fn((body: object) => host.request(body as Record<string, unknown>, 'owner'));
  const phone = createGuiToolsClient(<T,>(body: object) => request(body) as Promise<T>).terminal.ssh.profiles;
  saveSshProfiles([profile]);
  expect(await phone.list()).toEqual([profile]);
  const mobile = { ...profile, id: 'mobile', name: 'Added on phone' };
  await phone.save(mobile);
  expect(await localSshProfiles.list()).toEqual([profile, mobile]);
  await localSshProfiles.save({ ...profile, name: 'Updated on PC' });
  await phone.save({ ...mobile, name: 'Updated on phone' });
  expect(readSshProfiles().map(value => value.name)).toEqual(['Updated on PC', 'Updated on phone']);
  await phone.remove(mobile.id);
  expect(readSshProfiles()).toEqual([{ ...profile, name: 'Updated on PC' }]);
  expect(request).toHaveBeenCalledWith({ operation: 'guiTerminalSshProfileSave', profile: mobile });
});

it('validates remote metadata and strips credentials before saving or returning it', async () => {
  const host = new RemoteTerminals();
  const save = (value: object) => host.request({ operation: 'guiTerminalSshProfileSave', profile: value }, 'owner');
  await expect(save({ ...profile, port: 70000 })).rejects.toThrow('client.ssh.invalid');
  await expect(save({ ...profile, host: ' ' })).rejects.toThrow('client.ssh.invalid');
  const value = await save({ ...profile, password: 'secret', privateKey: 'PRIVATE KEY', passphrase: 'secret' });
  expect(value).toEqual([profile]);
  expect(localStorage.getItem('remoteai.ssh.profiles.v1')).not.toMatch(/secret|PRIVATE KEY/);
  expect(await host.request({ operation: 'guiTerminalSshProfiles' }, 'owner')).toEqual([profile]);
});

it('rejects new profiles at the limit without dropping existing ones', async () => {
  saveSshProfiles(Array.from({ length: 64 }, (_, index) => ({ ...profile, id: String(index) })));
  await expect(localSshProfiles.save(profile)).rejects.toThrow('client.ssh.profileLimit');
  expect(readSshProfiles()).toHaveLength(64);
  await localSshProfiles.save({ ...profile, id: '1', name: 'Edited' });
  expect(readSshProfiles().at(-1)?.name).toBe('Edited');
});
