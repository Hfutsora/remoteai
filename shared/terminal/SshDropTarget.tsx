import { useRef, type ReactNode } from 'react';
import { useFileDrop, type SubscribeFileDrop } from '../chat/useFileDrop';
import { displayText as t } from '../localization/messages';
import { browserSshUploadBatch, droppedSshFiles, releaseSshUploadBatch, type SshUploadBatch } from './sshDrop';

export interface SshNativeDrop {
  subscribe?: SubscribeFileDrop;
  read: (paths: string[]) => Promise<SshUploadBatch>;
}

interface Props {
  id: string; path: string; active: boolean; disabled?: boolean; children: ReactNode;
  className?: string; native?: SshNativeDrop;
  upload: (batch: SshUploadBatch) => Promise<void>;
  report: (error: unknown) => void;
}

/** Both native and browser drops use the same queue, conflicts and cancellation as the upload button. */
export function SshDropTarget({ id, path, active, disabled = false, children, className = '', native,
  upload, report }: Props) {
  const target = useRef<HTMLDivElement>(null);
  const drop = useFileDrop({ target, scope: id, active, disabled, subscribe: native?.subscribe, report,
    addFiles: files => upload(browserSshUploadBatch(files)),
    addPaths: async (paths, current) => {
      if (!native) return;
      const batch = await native.read(paths);
      if (current()) await upload(batch);
      else await releaseSshUploadBatch(batch);
    } });
  return <div ref={target} className={`ssh-drop-target ${className}`} {...drop.handlers} onDrop={event => {
    if (!native?.subscribe) {
      try { droppedSshFiles(event.dataTransfer); }
      catch (error) {
        event.preventDefault(); event.stopPropagation(); drop.clearDrag(); report(error); return;
      }
    }
    drop.handlers.onDrop(event);
  }}>
    {children}
    {drop.dragging && <div className="ssh-drop-overlay" role="status"><span>
      {t('client.ssh.dropUpload', { path })}
    </span></div>}
  </div>;
}
