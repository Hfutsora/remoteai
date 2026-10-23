import { displayText } from '../../i18n/uiText';
import { displayError } from '../../i18n/uiText';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Modal, Segmented } from 'antd';
import { DownloadCard } from '../../../../web/src/downloads/DownloadCard';
import { downloadManager } from '../../../../web/src/downloads/manager';
import { useDownloadTasks } from '../../../../web/src/downloads/useDownloadTasks';
import { authenticatedDownloadOwner } from '../../downloads/useDesktopDownloads';
import { openDesktopDownload } from '../../downloads/openDownload';
import { LOCAL_DOWNLOAD_OWNER, useLocalGitDownloads } from '../../downloads/localGitDownloads';
import { uiText } from "../../i18n/uiText";
import { useGuiLanguage } from '../../i18n/useGuiLanguage';
import type { CloudAuthState } from '../../types';
import '../../../../web/src/downloads/styles.css';
import styles from './index.module.less';

type Filter = 'all' | 'active' | 'ready';
const READY_STATUSES = new Set(['ready', 'saving', 'completed']);

function confirmRemove() {
  return new Promise<boolean>(resolve => {
    Modal.confirm({ title: uiText("client.downloads.deleteDownload"), width: 400,
      content: uiText("client.downloads.removeThisTaskAndItsTemporaryFilesFilesYouHave"),
      okText: uiText("client.projectBrowser.deleted"), cancelText: uiText("client.downloads.keep"), okButtonProps: { danger: true },
      onOk: () => { resolve(true); }, onCancel: () => { resolve(false); },
      afterClose: () => resolve(false) });
  });
}

export function DownloadsPage({ auth }: { auth: CloudAuthState }) {
  useGuiLanguage();
  useLocalGitDownloads();
  const owner = authenticatedDownloadOwner(auth);
  const { tasks, busy, error, run } = useDownloadTasks(owner, {
    confirmRemove, openDownload: openDesktopDownload, additionalOwner: LOCAL_DOWNLOAD_OWNER });
  const [filter, setFilter] = useState<Filter>('all');
  const ready = tasks.filter(task => READY_STATUSES.has(task.status)).length;
  const visible = tasks.filter(task => filter === 'all' || READY_STATUSES.has(task.status) === (filter === 'ready'));
  return <section className={styles.page} aria-label={uiText("client.downloads.downloads")}>
    <header className={`topbar ${styles.header}`} data-tauri-drag-region>
      <div><span className="eyebrow">DOWNLOADS</span><h1>{uiText("client.downloads.downloads")}</h1></div>
      <span className={styles.total}>{uiText("client.downloads.tasks", { count: tasks.length })}</span>
    </header>
    <div className={styles.content}>
      <div className={styles.toolbar}><Segmented value={filter} onChange={setFilter} options={[
        { value: 'all', label: uiText("client.configHelp.all") },
        { value: 'active', label: `${uiText("client.downloads.incomplete")} · ${tasks.length - ready}` },
        { value: 'ready', label: `${uiText("client.downloads.ready")} · ${ready}` },
      ]} />
        <p>{uiText("client.downloads.openOrSaveFilesWhenReadyInterruptedDownloadsRetryAutomatically")}</p>
      </div>
      {error && <p role="alert" className={styles.notice}>{displayError(error)}</p>}
      <div className={styles.tasks}>{visible.map(task => <DownloadCard key={task.id} task={task}
        busy={busy === task.id} connected={!!downloadManager.connectionForSource(task.source)?.ready}
        action={() => { void run(task); }} open={() => { void run(task, 'open'); }}
        remove={() => { void run(task, 'remove'); }} text={displayText} />)}</div>
      {!visible.length && <div className={styles.empty}><Download size={36} strokeWidth={1.5} />
        <h2>{uiText(tasks.length ? "client.downloads.noDownloadsInThisView" : "client.downloads.noDownloadsYet")}</h2>
        <p>{uiText("client.downloads.openAFileInChatAndChooseDownloadToSee")}</p></div>}
    </div>
  </section>;
}
