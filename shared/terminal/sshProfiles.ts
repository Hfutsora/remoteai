import type { SshRemote } from './ssh';

export interface SshProfile extends SshRemote {
  id: string; name: string; auth: 'password' | 'key'; fingerprint?: string;
}
export interface SshProfileStore {
  list: () => Promise<SshProfile[]>;
  save: (value: SshProfile) => Promise<SshProfile[]>;
  remove: (id: string) => Promise<SshProfile[]>;
}
const STORAGE_KEY = 'remoteai.ssh.profiles.v1';
const MAX_PROFILES = 64;

export function parseSshProfile(value: unknown): SshProfile | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.host !== 'string'
    || typeof item.username !== 'string' || typeof item.port !== 'number'
    || !Number.isInteger(item.port) || item.port < 1 || item.port > 65535
    || !['password', 'key'].includes(String(item.auth))
    || !item.id || item.id.length > 128 || item.name.length > 80
    || !item.host.trim() || item.host.length > 253 || /[\s\x00-\x1f\x7f]/.test(item.host)
    || !item.username.trim() || item.username.length > 256 || /[\x00-\x1f\x7f]/.test(item.username)
    || (item.fingerprint !== undefined && (typeof item.fingerprint !== 'string'
      || item.fingerprint.length > 256))) return null;
  return { id: item.id, name: item.name, host: item.host, username: item.username,
    port: item.port, auth: item.auth as SshProfile['auth'],
    fingerprint: typeof item.fingerprint === 'string' ? item.fingerprint : undefined };
}

export function readSshProfiles(): SshProfile[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_PROFILES).flatMap(value => parseSshProfile(value) ?? []) : [];
  } catch { return []; }
}

/** Explicit serialization keeps passwords, key material and passphrases out of persistent storage. */
export function saveSshProfiles(profiles: SshProfile[]) {
  const values = profiles.slice(0, MAX_PROFILES).flatMap(value => parseSshProfile(value) ?? []);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

/** The PC is the source of truth. Update individual records so different clients cannot overwrite the whole list. */
export const localSshProfiles: SshProfileStore = {
  list: async () => readSshProfiles(),
  async save(value) {
    const saved = parseSshProfile(value);
    if (!saved) throw new Error('client.ssh.invalid');
    const profiles = readSshProfiles().filter(item => item.id !== saved.id);
    if (profiles.length >= MAX_PROFILES) throw new Error('client.ssh.profileLimit');
    const next = [...profiles, saved];
    saveSshProfiles(next);
    return next;
  },
  async remove(id) {
    if (typeof id !== 'string' || !id || id.length > 128) throw new Error('client.ssh.invalid');
    const next = readSshProfiles().filter(item => item.id !== id);
    saveSshProfiles(next);
    return next;
  },
};

export const sshLabel = (value: SshRemote) => `${value.username}@${value.host}:${value.port}`;
export const sshEndpointKey = (value: SshRemote) => JSON.stringify([value.host, value.port]);
