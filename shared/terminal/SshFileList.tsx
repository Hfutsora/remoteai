import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Dropdown, type MenuProps } from 'antd';
import { Copy, Download, File, FilePlus, Folder, FolderOpen, FolderPlus, Pencil, RefreshCw, Trash2, Upload }
  from 'lucide-react';
import { displayText as t } from '../localization/messages';
import type { SshEntry } from './ssh';
import type { SshFileActions, SshFilesState } from './useSshFileActions';

interface Props {
  files: SshFilesState; actions: SshFileActions; entries: SshEntry[];
  open: (path: string) => void; upload: () => void;
}

function contextMenu({ files, actions, open, upload }: Props, entry?: SshEntry): MenuProps {
  const items: MenuProps['items'] = [];
  if (entry) items.push(
    { key: 'open', label: t(entry.directory ? 'client.ssh.openFolder' : 'client.ssh.download'),
      icon: entry.directory ? <FolderOpen size={15} /> : <Download size={15} />,
      onClick: () => entry.directory ? open(entry.path) : void files.download(entry) },
    { key: 'rename', label: t('client.ssh.rename'), icon: <Pencil size={15} />,
      onClick: () => actions.rename(entry) },
    { key: 'path', label: t('client.ssh.copyPath'), icon: <Copy size={15} />,
      onClick: () => void actions.copyPath(entry.path) },
    { key: 'delete', label: t('client.ssh.delete'), danger: true, icon: <Trash2 size={15} />,
      onClick: () => actions.remove(entry) }, { type: 'divider' },
  );
  items.push(
    { key: 'newFile', label: t('client.ssh.newFile'), icon: <FilePlus size={15} />,
      onClick: () => actions.create('createFile') },
    { key: 'newFolder', label: t('client.ssh.newFolder'), icon: <FolderPlus size={15} />,
      onClick: () => actions.create('createFolder') },
    { key: 'upload', label: t('client.ssh.upload'), icon: <Upload size={15} />, onClick: upload },
    { key: 'refresh', label: t('client.ssh.refresh'), icon: <RefreshCw size={15} />,
      onClick: () => void files.load() },
  );
  return { items, onClick: () => { if (entry) files.select(entry); } };
}

export function SshFileList(props: Props) {
  const { files, entries, open } = props;
  const [contextEntry, setContextEntry] = useState<SshEntry>();
  const [menuOpen, setMenuOpen] = useState(false);
  const selectContext = (event: MouseEvent<HTMLUListElement>) => {
    event.preventDefault();
    const target = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-ssh-path]') : null;
    const entry = entries.find(item => item.path === target?.dataset.sshPath);
    setContextEntry(entry);
    if (entry) files.select(entry);
  };
  const dismissMenu = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !menuOpen) return;
    event.preventDefault(); event.stopPropagation(); setMenuOpen(false);
  };
  return <Dropdown trigger={['contextMenu']} disabled={files.busy} open={menuOpen && !files.busy}
    onOpenChange={setMenuOpen} menu={{ ...contextMenu(props, contextEntry), onKeyDown: dismissMenu }}
    overlayClassName="ssh-file-context">
    <ul className="ssh-file-list" aria-label={t('client.ssh.files')} onContextMenu={selectContext} onKeyDown={dismissMenu}>
      {entries.map(entry => <li key={entry.path}>
        <button type="button" data-ssh-path={entry.path} disabled={files.busy}
          aria-selected={files.selected?.path === entry.path} onClick={() => files.select(entry)}
          onDoubleClick={() => entry.directory ? open(entry.path) : void files.download(entry)}>
          {entry.directory ? <Folder size={17} /> : <File size={17} />}
          <span>{entry.name}</span><small>{entry.directory ? '' : `${entry.size.toLocaleString()} B`}</small>
        </button>
      </li>)}
      {!entries.length && !files.busy && <li className="ssh-hint">{t('client.ssh.empty')}</li>}
    </ul>
  </Dropdown>;
}
