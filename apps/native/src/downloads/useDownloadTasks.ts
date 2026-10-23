import { t } from '../i18n';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AuthSession } from '../types';
import { downloadManager, downloadOwner } from './manager';
import type { DownloadTask } from './types';

export function useDownloadTasks(session: AuthSession) {
  const tasks = useSyncExternalStore(downloadManager.subscribe, downloadManager.snapshot);
  const connection = useSyncExternalStore(downloadManager.subscribe, downloadManager.connection);
  const initializationError = useSyncExternalStore(downloadManager.subscribe, downloadManager.error);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [deleting, setDeleting] = useState<DownloadTask>();
  const pending = useRef(false);
  const owner = downloadOwner(session);
  useEffect(() => { void downloadManager.initialize(); }, []);

  const run = async (task: DownloadTask, operation: 'action' | 'delete' | 'share') => {
    if (pending.current) return;
    pending.current = true;
    setBusy(task.id);
    setError('');
    try {
      if (operation === 'delete') {
        await downloadManager.delete(task.id);
        setDeleting(undefined);
      } else if (operation === 'share') await downloadManager.share(task);
      else if (task.status === 'completed') await downloadManager.open(task);
      else if (['queued', 'preparing', 'downloading', 'verifying', 'saving'].includes(task.status)) {
        await downloadManager.pause(task.id);
      }
      else await downloadManager.resume(task.id);
    } catch {
      setError(operation === 'delete' ? t("client.threadActions.couldNotDeleteTheChatTryAgainLater")
        : operation === 'share' ? t("client.downloads.couldNotShareTheFileCheckThatItIsStill")
        : t("client.mobile.couldNotFinishCheckTheComputerConnectionPhoneStorageAnd"));
    } finally {
      pending.current = false;
      setBusy('');
    }
  };

  return {
    tasks: tasks.filter(task => task.source.owner === owner && (!task.source.preview || task.exported)).slice().reverse(),
    connection: connection?.owner === owner ? connection : undefined,
    error: error || initializationError, busy, deleting, setDeleting, run,
  };
}
