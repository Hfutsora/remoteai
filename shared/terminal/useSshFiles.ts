import { useEffect, useRef, useState } from 'react';
import { SSH_FILE_LIMIT, sshError, type SshApi, type SshEntry, type SshFileAction } from './ssh';
import { browserSshDownload, type SshDownload, type SshUpload } from './sshTransfers';

export const sshParent = (path: string) => path.replace(/\/+$/, '').slice(0, path.replace(/\/+$/, '').lastIndexOf('/')) || '/';
export const sshChild = (path: string, name: string) => `${path.replace(/\/+$/, '')}/${name}`;
export const validSshName = (name: string) => Boolean(name && name !== '.' && name !== '..'
  && name.length <= 255 && !/[\/\x00-\x1f\x7f]/.test(name));

export function useSshFiles(api: SshApi, id: string, saveDownload: SshDownload = browserSshDownload) {
  const [path, setPath] = useState('.');
  const [entries, setEntries] = useState<SshEntry[]>([]);
  const [selected, select] = useState<SshEntry>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const active = useRef(true);
  const running = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (running.current) return false;
    running.current = true; setBusy(true); setError('');
    try { await action(); return true; }
    catch (failure) {
      if (active.current) setError(sshError(failure, 'client.ssh.fileFailed'));
      return false;
    }
    finally { running.current = false; if (active.current) setBusy(false); }
  };
  const list = async (directory: string) => {
    const response = await api.files(id, { type: 'list', path: directory });
    if (response.type !== 'list' || !active.current) return;
    setPath(response.path); setEntries(response.entries); setTruncated(response.truncated); select(undefined);
  };
  const load = (directory = path) => run(() => list(directory));
  useEffect(() => {
    active.current = true; void load('.');
    return () => { active.current = false; };
  }, [api, id]);
  const mutate = (request: SshFileAction) => run(async () => {
    await api.files(id, request); await list(path);
  });
  const download = (entry: SshEntry) => run(async () => {
    if (entry.size > SSH_FILE_LIMIT) throw new Error('client.ssh.fileTooLarge');
    const response = await api.files(id, { type: 'read', path: entry.path });
    if (response.type !== 'file' || !active.current) return;
    await saveDownload(entry, response.data);
  });
  const upload = (file: SshUpload) => run(async () => {
    if (!validSshName(file.name)) throw new Error('client.ssh.invalidName');
    if (file.size > SSH_FILE_LIMIT) throw new Error('client.ssh.fileTooLarge');
    const data = await file.read();
    await api.files(id, { type: 'upload', path: sshChild(path, file.name), data });
    await list(path);
  });
  return { path, entries, selected, select, busy, error, truncated, load, mutate, download, upload };
}
