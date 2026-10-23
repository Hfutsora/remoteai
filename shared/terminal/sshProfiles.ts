import type { SshRemote } from './ssh';

export interface SshProfile extends SshRemote {
  id: string; name: string; auth: 'password' | 'key'; fingerprint?: string;
}
const STORAGE_KEY = 'remoteai.ssh.profiles.v1';
const MAX_PROFILES = 64;

function profile(value: unknown): SshProfile | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.host !== 'string'
    || typeof item.username !== 'string' || typeof item.port !== 'number'
    || !Number.isInteger(item.port) || item.port < 1 || item.port > 65535
    || !['password', 'key'].includes(String(item.auth))) return null;
  return { id: item.id, name: item.name, host: item.host, username: item.username,
    port: item.port, auth: item.auth as SshProfile['auth'],
    fingerprint: typeof item.fingerprint === 'string' ? item.fingerprint : undefined };
}

export function readSshProfiles(): SshProfile[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_PROFILES).flatMap(value => profile(value) ?? []) : [];
  } catch { return []; }
}

/** Explicit serialization keeps passwords, key material and passphrases out of persistent storage. */
export function saveSshProfiles(profiles: SshProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.slice(0, MAX_PROFILES).flatMap(value => profile(value) ?? [])));
}

export const sshLabel = (value: SshRemote) => `${value.username}@${value.host}:${value.port}`;
export const sshEndpointKey = (value: SshRemote) => JSON.stringify([value.host, value.port]);
