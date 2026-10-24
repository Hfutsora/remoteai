import { useEffect, useRef, useState } from 'react';
import { sshError, type SshApi } from './ssh';
import { sshEndpointKey, type SshProfile } from './sshProfiles';
import type { TerminalInfo } from './types';
import { useSshProfiles } from './useSshProfiles';

export interface SshValues {
  name: string; host: string; port: number; username: string; auth: 'password' | 'key';
  password?: string; privateKey?: string; passphrase?: string;
}
export const newSshValues = (): SshValues => ({ name: '', host: '', port: 22, username: '', auth: 'password' });
export const validSshValues = (value: SshValues) => Boolean(value.host.trim() && value.username.trim()
  && Number.isInteger(value.port) && value.port > 0 && value.port <= 65535
  && (value.auth !== 'key' || value.privateKey?.trim()));

interface Options {
  api: SshApi; projectCwd: string; initial?: SshProfile; createId: () => string;
  connected: (info: TerminalInfo) => void; dispose: (id: string) => Promise<void>; close: () => void;
}

/** Shared host verification and save flow for desktop, browser and native forms. */
export function useSshConnection(options: Options) {
  const { api, projectCwd, initial, createId, connected, dispose, close } = options;
  const saved = useSshProfiles(api.profiles);
  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState('');
  const [trust, setTrust] = useState<{ endpoint: string; fingerprint: string }>();
  const lifetime = useRef(true);
  const pending = useRef(false);
  useEffect(() => { lifetime.current = true; return () => { lifetime.current = false; }; }, []);
  const choose = (profile?: SshProfile) => {
    setSelected(profile); setError(''); setTrust(undefined);
    return profile ?? newSshValues();
  };
  const fingerprintFor = async (values: SshValues) => {
    const endpoint = { host: values.host.trim(), port: values.port };
    const endpointKey = sshEndpointKey({ ...endpoint, username: values.username });
    const fingerprint = await api.probe(endpoint);
    // Refresh before trusting: another client may have saved this host since the form was opened.
    const profiles = await api.profiles.list();
    if (selected?.revision) {
      const current = profiles.find(value => value.id === selected.id);
      if (!current || current.revision !== selected.revision || current.accountScope !== selected.accountScope) {
        throw new Error('client.ssh.profileChanged');
      }
    }
    const known = profiles.filter(value => sshEndpointKey(value) === endpointKey && value.fingerprint);
    if (known.some(value => value.fingerprint !== fingerprint)) throw new Error('client.ssh.hostChanged');
    if (!known.length && (trust?.endpoint !== endpointKey || trust.fingerprint !== fingerprint)) {
      if (lifetime.current) setTrust({ endpoint: endpointKey, fingerprint });
      return;
    }
    return fingerprint;
  };
  const connect = async (values: SshValues, fingerprint: string) => {
    const endpoint = { host: values.host.trim(), port: values.port };
    const info = await api.open({ endpoint, username: values.username.trim(), fingerprint,
      size: { cols: 80, rows: 24 }, ...(values.auth === 'key'
        ? { privateKey: values.privateKey, passphrase: values.passphrase }
        : { password: values.password }) }, projectCwd);
    if (!lifetime.current) { await dispose(info.id); return; }
    const profile: SshProfile = { id: selected?.id ?? createId(), name: values.name?.trim() ?? '',
      ...endpoint, username: values.username.trim(), auth: values.auth, fingerprint,
      ...(selected ? { revision: selected.revision, accountScope: selected.accountScope } : {}) };
    let stored = true;
    try { await saved.save(profile); }
    catch (failure) { stored = false;
      if (lifetime.current) setError(sshError(failure, 'client.ssh.storageFailed')); }
    if (!lifetime.current) { await dispose(info.id); return; }
    connected(info); setFinished(true);
    if (stored) close();
  };
  const submit = async (values: SshValues) => {
    if (pending.current || finished || saved.loading || saved.error) return;
    if (!validSshValues(values)) { setError('client.ssh.invalid'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const fingerprint = await fingerprintFor(values);
      if (fingerprint && lifetime.current) await connect(values, fingerprint);
    } catch (failure) { if (lifetime.current) setError(sshError(failure, 'client.ssh.connectionFailed')); }
    finally { pending.current = false; if (lifetime.current) setBusy(false); }
  };
  const remove = async () => {
    if (!selected || pending.current) return false;
    pending.current = true; setBusy(true); setError('');
    try {
      await saved.remove(selected.id, selected.revision, selected.accountScope);
      if (lifetime.current) choose(); return true;
    }
    catch (failure) { if (lifetime.current) setError(sshError(failure, 'client.ssh.storageFailed')); return false; }
    finally { pending.current = false; if (lifetime.current) setBusy(false); }
  };
  const current = selected && saved.profiles.find(value => value.id === selected.id);
  const selectionError = selected?.revision && !saved.loading && !saved.error
    && (!current || current.revision !== selected.revision || current.accountScope !== selected.accountScope)
    ? 'client.ssh.profileChanged' : '';
  return { ...saved, selected, choose, busy, finished, error: error || saved.error || selectionError, trust,
    clearTrust: () => setTrust(undefined), submit, remove };
}
