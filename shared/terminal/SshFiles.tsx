import { useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Popconfirm, Spin, Tooltip } from 'antd';
import { ArrowUp, Download, File, Folder, FolderPlus, Home, RefreshCw, Upload } from 'lucide-react';
import { WorkspaceDrawerTab } from '../chat/WorkspaceDrawerTab';
import { displayText as t } from '../localization/messages';
import type { TerminalInfo } from './types';
import type { SshApi } from './ssh';
import { sshChild, sshParent, useSshFiles, validSshName } from './useSshFiles';
import { browserSshUpload } from './sshTransfers';
import './ssh.css';

export const sshFilesTabId = (id: string) => `ssh-files:${id}`;
const ICON = <Folder size={16} />;

export function SshFiles({ info, api, active }: { info: TerminalInfo; api: SshApi; active: boolean }) {
  return <WorkspaceDrawerTab active={active} autoOpen
    tab={{ id: sshFilesTabId(info.id), title: t('client.ssh.filesTitle', { host: info.ssh?.host ?? '' }), icon: ICON }}>
    {() => <SshFileBrowser key={info.id} api={api} id={info.id} />}
  </WorkspaceDrawerTab>;
}

export function SshFileBrowser({ api, id }: { api: SshApi; id: string }) {
  const files = useSshFiles(api, id);
  const [address, setAddress] = useState<string>();
  const [filter, setFilter] = useState('');
  const [hidden, setHidden] = useState(true);
  const [prompt, setPrompt] = useState<{ kind: 'createFolder' | 'rename'; name: string }>();
  const input = useRef<HTMLInputElement>(null);
  const selected = files.selected;
  const action = (key: string, icon: ReactNode, invoke: () => void, disabled = false) =>
    <Tooltip title={t(key)} styles={{ root: { maxWidth: 400 } }}><Button icon={icon} aria-label={t(key)}
      disabled={files.busy || disabled} onClick={invoke} /></Tooltip>;
  const confirm = async () => {
    if (!prompt || !validSshName(prompt.name)) return;
    const destination = sshChild(files.path, prompt.name);
    const done = await files.mutate(prompt.kind === 'rename' && selected
      ? { type: 'rename', path: selected.path, destination } : { type: 'createFolder', path: destination });
    if (done) setPrompt(undefined);
  };
  const entries = files.entries.filter(entry => (hidden || !entry.name.startsWith('.'))
    && entry.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return <div className="ssh-files" aria-busy={files.busy}>
    <div className="ssh-file-toolbar">
      {action('client.ssh.home', <Home size={16} />, () => { setAddress(undefined); void files.load('.'); })}
      {action('client.ssh.parent', <ArrowUp size={16} />, () => {
        setAddress(undefined); void files.load(sshParent(files.path));
      }, files.path === '/')}
      {action('client.ssh.refresh', <RefreshCw size={16} />, () => void files.load())}
      {action('client.ssh.newFolder', <FolderPlus size={16} />, () => setPrompt({ kind: 'createFolder', name: '' }))}
      {action('client.ssh.upload', <Upload size={16} />, () => input.current?.click())}
      {files.busy && <Spin size="small" />}
      <input hidden type="file" ref={input} onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (file) void files.upload(browserSshUpload(file));
      }} />
    </div>
    <form className="ssh-file-path" onSubmit={event => {
      event.preventDefault(); void files.load(address ?? files.path).then(() => setAddress(undefined));
    }}>
      <Input value={address ?? files.path} aria-label={t('client.ssh.path')}
        onChange={event => setAddress(event.target.value)} disabled={files.busy} />
      <Button htmlType="submit" disabled={files.busy}>{t('client.ssh.go')}</Button>
    </form>
    <Input value={filter} onChange={event => setFilter(event.target.value)} allowClear
      placeholder={t('client.ssh.filter')} aria-label={t('client.ssh.filter')} />
    <Checkbox checked={hidden} onChange={event => setHidden(event.target.checked)}>{t('client.ssh.hidden')}</Checkbox>
    {files.error && <Alert type="error" role="alert" message={t(files.error)} />}
    {files.truncated && <Alert type="info" message={t('client.ssh.truncated')} />}
    <ul className="ssh-file-list" aria-label={t('client.ssh.files')}>
      {entries.map(entry => <li key={entry.path}><button type="button" disabled={files.busy}
        aria-selected={selected?.path === entry.path} onClick={() => files.select(entry)}
        onDoubleClick={() => { if (entry.directory) { setAddress(undefined); void files.load(entry.path); } }}>
        {entry.directory ? <Folder size={17} /> : <File size={17} />}
        <span>{entry.name}</span><small>{entry.directory ? '' : `${entry.size.toLocaleString()} B`}</small>
      </button></li>)}
      {!entries.length && !files.busy && <li className="ssh-hint">{t('client.ssh.empty')}</li>}
    </ul>
    {selected && <div className="ssh-file-actions">
      {selected.directory ? <Button disabled={files.busy} onClick={() => {
        setAddress(undefined); void files.load(selected.path);
      }}>{t('client.ssh.openFolder')}</Button> : <Button icon={<Download size={15} />} disabled={files.busy}
        onClick={() => void files.download(selected)}>{t('client.ssh.download')}</Button>}
      <Button disabled={files.busy} onClick={() => setPrompt({ kind: 'rename', name: selected.name })}>
        {t('client.ssh.rename')}</Button>
      <Popconfirm title={t('client.ssh.deleteConfirm', { name: selected.name })}
        description={t('client.ssh.deleteHint')} styles={{ root: { maxWidth: 400 } }}
        okText={t('client.ssh.delete')} cancelText={t('client.ssh.cancel')}
        onConfirm={() => files.mutate({ type: 'delete', path: selected.path })}>
        <Button danger disabled={files.busy}>{t('client.ssh.delete')}</Button>
      </Popconfirm>
    </div>}
    <p className="ssh-hint">{t('client.ssh.transferHint')}</p>
    {prompt && <Modal open width={400} title={t(prompt.kind === 'rename' ? 'client.ssh.rename' : 'client.ssh.newFolder')}
      onCancel={() => setPrompt(undefined)} onOk={() => void confirm()} confirmLoading={files.busy}
      okText={t('client.ssh.confirm')} cancelText={t('client.ssh.cancel')}
      okButtonProps={{ disabled: !validSshName(prompt.name) }}>
      <Input autoFocus aria-label={t('client.ssh.fileName')} value={prompt.name} maxLength={255}
        onChange={event => setPrompt({ ...prompt, name: event.target.value })}
        onPressEnter={() => void confirm()} />
    </Modal>}
  </div>;
}
