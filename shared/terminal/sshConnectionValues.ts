import { parseSshProfile, sshEndpointKey, type SshProfile } from './sshProfiles';
import type { SshConnect } from './ssh';

export interface SshValues {
  name: string; host: string; port: number; username: string; auth: 'password' | 'key';
  password?: string; privateKey?: string; passphrase?: string;
}
export const newSshValues = (): SshValues => ({ name: '', host: '', port: 22, username: '', auth: 'password' });

export function sshProfileFromValues(options: {
  values: SshValues; id: string; selected?: SshProfile; fingerprint?: string;
}): SshProfile {
  const { values, id, selected, fingerprint } = options;
  const endpoint = { host: values.host.trim(), port: values.port, username: values.username.trim() };
  return { id, name: values.name?.trim() ?? '', ...endpoint, auth: values.auth,
    fingerprint: fingerprint ?? (selected && sshEndpointKey(selected) === sshEndpointKey(endpoint)
      ? selected.fingerprint : undefined),
    ...(selected ? { revision: selected.revision, accountScope: selected.accountScope } : {}) };
}

export const validSshSettings = (values: SshValues) => Boolean(parseSshProfile(
  sshProfileFromValues({ values, id: 'validation' }),
));
export const validSshValues = (values: SshValues) => validSshSettings(values)
  && (values.auth !== 'key' || Boolean(values.privateKey?.trim()));

export const sameSshProfile = (left: SshProfile, right: SshProfile) =>
  JSON.stringify(parseSshProfile(left)) === JSON.stringify(parseSshProfile(right));

export const sshConnectFromValues = (values: SshValues, fingerprint: string): SshConnect => ({
  endpoint: { host: values.host.trim(), port: values.port }, username: values.username.trim(), fingerprint,
  size: { cols: 80, rows: 24 }, ...(values.auth === 'key'
    ? { privateKey: values.privateKey, passphrase: values.passphrase } : { password: values.password }),
});
