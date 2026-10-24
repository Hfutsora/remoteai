import { useEffect, useRef, useState } from 'react';
import type { SshProfile, SshProfileStore } from './sshProfiles';
import { sshError } from './ssh';

/** Never fall back to this client's storage when the selected PC is unavailable. */
export function useSshProfiles(store: SshProfileStore) {
  const [profiles, setProfiles] = useState<SshProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const version = useRef(0);
  const refresh = async () => {
    const current = ++version.current;
    setLoading(true); setError('');
    try {
      const values = await store.list();
      if (current === version.current) setProfiles(values);
    } catch {
      if (current === version.current) setError('client.ssh.loadFailed');
    } finally { if (current === version.current) setLoading(false); }
  };
  useEffect(() => {
    setProfiles([]); void refresh();
    return () => { version.current += 1; };
  }, [store]);
  const mutate = async (action: () => Promise<SshProfile[]>) => {
    const current = ++version.current;
    try {
      const values = await action();
      if (current === version.current) { setProfiles(values); setError(''); }
    } catch (failure) { throw new Error(sshError(failure, 'client.ssh.storageFailed')); }
  };
  return { profiles, loading, error, refresh,
    save: (value: SshProfile) => mutate(() => store.save(value)),
    remove: (id: string) => mutate(() => store.remove(id)) };
}
