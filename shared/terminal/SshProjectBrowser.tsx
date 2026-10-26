import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Progress, Spin } from 'antd';
import { ProjectBrowser } from '../project-browser/ProjectBrowser';
import type { BrowserHost } from '../project-browser/entryActions';
import { displayText as t } from '../localization/messages';
import { remoteErrorText } from '../localization/errors';
import { createSshProjectClient } from './sshProjectClient';
import { SshProjectToolbar } from './SshProjectToolbar';
import { useSshFiles } from './useSshFiles';
import { useSshFileActions } from './useSshFileActions';
import { SshFileDialogs } from './SshFileDialogs';
import { SshDropTarget, type SshNativeDrop } from './SshDropTarget';
import { releaseSshUploadBatch, type SshUploadBatch } from './sshDrop';
import type { PendingSshUpload } from './useSshDropQueue';
import type { SshApi } from './ssh';
import './sshProjectBrowser.css';

export function SshProjectBrowser({ api, id, active, nativeDrop, pendingUpload }: {
  api: SshApi; id: string; active: boolean; nativeDrop?: SshNativeDrop; pendingUpload?: PendingSshUpload;
}) {
  const files = useSshFiles(api, id);
  const actions = useSshFileActions(files);
  const [hidden, setHidden] = useState(true);
  const accepted = useRef<PendingSshUpload>();
  const { client, download } = useMemo(() => createSshProjectClient(api, id), [api, id]);
  const host = useMemo<BrowserHost>(() => ({
    copyPath: path => navigator.clipboard.writeText(path), download, downloadDirectory: false,
    entryActions: ['createFile', 'createFolder', 'rename', 'move', 'delete'],
  }), [download]);
  useEffect(() => {
    if (pendingUpload && !files.loaded && files.error) { pendingUpload.complete(); return; }
    if (!pendingUpload || accepted.current === pendingUpload || files.busy || !files.loaded) return;
    accepted.current = pendingUpload;
    void actions.uploadSources(pendingUpload.batch.files, pendingUpload.batch.directory)
      .finally(pendingUpload.complete);
  }, [pendingUpload, files.busy, files.loaded, files.error, actions.uploadSources]);
  useEffect(() => () => { accepted.current?.complete(); }, []);
  const upload = async (batch: SshUploadBatch) => {
    try { await actions.uploadSources(batch.files); }
    finally { await releaseSshUploadBatch(batch); }
  };
  const toolbar = <SshProjectToolbar path={files.path} disabled={files.busy} hidden={hidden} setHidden={setHidden}
    navigate={path => { void files.navigate(path); }} upload={selected => { void actions.upload(selected); }} />;
  return <SshDropTarget id={id} path={files.path} active={active} disabled={files.busy || !files.loaded}
    native={nativeDrop} upload={upload} report={files.reportError}>
    <div className="ssh-project-browser" aria-busy={files.busy}>
      {files.error && <p className="ssh-project-feedback" role="alert">{remoteErrorText(files.error)}</p>}
      {!files.loaded && <div className="ssh-project-loading" role="status">
        {files.busy ? <Spin /> : <Button onClick={() => void files.load()}>{t('client.terminal.retry')}</Button>}
      </div>}
      {files.loaded && <ProjectBrowser client={client} cwd="/" connected t={t} host={host} onClose={() => {}}
        treeOptions={{ root: files.path, toolbar, showHidden: hidden, revision: files.entries }} />}
      {files.progress && <div className="ssh-upload-progress ssh-project-feedback" role="status">
        <span>{t('client.ssh.uploadingFile', { name: files.progress.name })}</span>
        <Progress percent={files.progress.total ? Math.floor(files.progress.sent / files.progress.total * 100) : 0}
          size="small" />
        <Button size="small" onClick={files.cancelUpload}>{t('client.ssh.cancelUpload')}</Button>
      </div>}
      <SshFileDialogs files={files} actions={actions} />
    </div>
  </SshDropTarget>;
}
