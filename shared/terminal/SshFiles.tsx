import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Checkbox, Input, Progress, Spin, Tooltip } from 'antd';
import { ArrowUp, Download, FilePlus, Folder, FolderPlus, Home, RefreshCw, Upload } from 'lucide-react';
import { WorkspaceDrawerTab } from '../chat/WorkspaceDrawerTab';
import { displayText as t } from '../localization/messages';
import { remoteErrorText } from '../localization/errors';
import type { TerminalInfo } from './types';
import type { SshApi } from './ssh';
import { sshParent, useSshFiles } from './useSshFiles';
import { useSshFileActions } from './useSshFileActions';
import { SshFileDialogs } from './SshFileDialogs';
import { SshFileList } from './SshFileList';
import { SshDropTarget, type SshNativeDrop } from './SshDropTarget';
import { releaseSshUploadBatch, type SshUploadBatch } from './sshDrop';
import type { PendingSshUpload } from './useSshDropQueue';
import './ssh.css';

export const sshFilesTabId = (id: string) => `ssh-files:${id}`;
const ICON = <Folder size={16} />;

interface DropProps { nativeDrop?: SshNativeDrop; pendingUpload?: PendingSshUpload }

export function SshFiles({ info, api, active, ...drop }: {
  info: TerminalInfo; api: SshApi; active: boolean;
} & DropProps) {
  return <WorkspaceDrawerTab active={active} autoOpen
    tab={{ id: sshFilesTabId(info.id), title: t('client.ssh.filesTitle', { host: info.ssh?.host ?? '' }), icon: ICON }}>
    {visible => <SshFileBrowser key={info.id} api={api} id={info.id} active={active && visible} {...drop} />}
  </WorkspaceDrawerTab>;
}

export function SshFileBrowser({ api, id, active = true, nativeDrop, pendingUpload }: {
  api: SshApi; id: string; active?: boolean;
} & DropProps) {
  const files = useSshFiles(api, id);
  const actions = useSshFileActions(files);
  const [address, setAddress] = useState<string>();
  const [filter, setFilter] = useState('');
  const [hidden, setHidden] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const accepted = useRef<PendingSshUpload>();
  useEffect(() => {
    if (pendingUpload && !files.loaded && files.error) { pendingUpload.complete(); return; }
    if (!pendingUpload || accepted.current === pendingUpload || files.busy || !files.loaded) return;
    accepted.current = pendingUpload;
    void actions.uploadSources(pendingUpload.batch.files, pendingUpload.batch.directory).finally(pendingUpload.complete);
  }, [pendingUpload, files.busy, files.loaded, files.error, actions.uploadSources]);
  useEffect(() => () => { accepted.current?.complete(); }, []);
  const upload = async (batch: SshUploadBatch) => {
    try { await actions.uploadSources(batch.files); }
    finally { await releaseSshUploadBatch(batch); }
  };
  const selected = files.selected;
  const open = (path: string) => { setAddress(undefined); void files.navigate(path); };
  const action = (key: string, icon: ReactNode, invoke: () => void, disabled = false) =>
    <Tooltip title={t(key)} styles={{ root: { maxWidth: 400 } }}><Button icon={icon} aria-label={t(key)}
      disabled={files.busy || disabled} onClick={invoke} /></Tooltip>;
  const entries = files.entries.filter(entry => (hidden || !entry.name.startsWith('.'))
    && entry.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return <SshDropTarget id={id} path={files.path} active={active} disabled={files.busy || !files.loaded}
    native={nativeDrop} upload={upload} report={files.reportError}>
    <div className="ssh-files" aria-busy={files.busy}>
    <div className="ssh-file-toolbar">
      {action('client.ssh.refresh', <RefreshCw size={16} />, () => void files.load())}
      {action('client.ssh.newFile', <FilePlus size={16} />, () => actions.create('createFile'))}
      {action('client.ssh.newFolder', <FolderPlus size={16} />, () => actions.create('createFolder'))}
      {action('client.ssh.upload', <Upload size={16} />, () => input.current?.click())}
      {files.busy && <Spin size="small" />}
      <input hidden type="file" multiple ref={input} onChange={event => {
        const selected = event.currentTarget.files;
        if (selected?.length) void actions.upload(selected);
        event.currentTarget.value = '';
      }} />
    </div>
    <form className="ssh-file-path" onSubmit={event => {
      event.preventDefault(); open(address ?? files.path);
    }}>
      {action('client.ssh.home', <Home size={16} />, () => open('.'))}
      {action('client.ssh.parent', <ArrowUp size={16} />, () => open(sshParent(files.path)), files.path === '/')}
      <Input value={address ?? files.path} aria-label={t('client.ssh.path')}
        onChange={event => setAddress(event.target.value)} disabled={files.busy} />
      <Button htmlType="submit" disabled={files.busy}>{t('client.ssh.go')}</Button>
    </form>
    <Input value={filter} onChange={event => setFilter(event.target.value)} allowClear
      placeholder={t('client.ssh.filter')} aria-label={t('client.ssh.filter')} />
    <Checkbox checked={hidden} onChange={event => setHidden(event.target.checked)}>{t('client.ssh.hidden')}</Checkbox>
    {files.error && <Alert type="error" role="alert" message={remoteErrorText(files.error)} />}
    {actions.copyStatus && <Alert type={actions.copyStatus === 'client.ssh.pathCopied' ? 'success' : 'error'}
      message={t(actions.copyStatus)} />}
    {files.truncated && <Alert type="info" message={t('client.ssh.truncated')} />}
    {files.progress && <div className="ssh-upload-progress" role="status">
      <span>{t('client.ssh.uploadingFile', { name: files.progress.name })}</span>
      <Progress percent={files.progress.total ? Math.floor(files.progress.sent / files.progress.total * 100) : 0}
        size="small" />
      <Button size="small" onClick={files.cancelUpload}>{t('client.ssh.cancelUpload')}</Button>
    </div>}
    <SshFileList files={files} actions={actions} entries={entries} open={open} upload={() => input.current?.click()} />
    {selected && <div className="ssh-file-actions">
      {selected.directory ? <Button disabled={files.busy} onClick={() => {
        open(selected.path);
      }}>{t('client.ssh.openFolder')}</Button> : <Button icon={<Download size={15} />} disabled={files.busy}
        onClick={() => void files.download(selected)}>{t('client.ssh.download')}</Button>}
      <Button disabled={files.busy} onClick={() => actions.rename(selected)}>
        {t('client.ssh.rename')}</Button>
      <Button danger disabled={files.busy} onClick={() => actions.remove(selected)}>{t('client.ssh.delete')}</Button>
    </div>}
    <p className="ssh-hint">{t('client.ssh.transferHint')}</p>
    <p className="ssh-hint">{t('client.ssh.uploadDropHint')}</p>
    <SshFileDialogs files={files} actions={actions} />
  </div></SshDropTarget>;
}
