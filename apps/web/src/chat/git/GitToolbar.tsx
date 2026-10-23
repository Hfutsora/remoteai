import { displayText } from '../../i18n/index';
import { useState } from 'react';
import { Tooltip } from 'antd';
import { GitBranch, ChevronDown, RefreshCw, X, Download, ArrowDown, ArrowUp, ArrowDownUp, Undo2 } from 'lucide-react';
import type { RemoteGit } from '../../../../../shared/remote-chat/useRemoteGit';
import { GIT_ACTIONS, gitSyncCounts } from '../../../../../shared/remote-chat/gitActions';
import type { GitAction } from '../../../../../shared/remote-chat/gitTypes';
import { t } from '../../i18n';

const ACTION_ICONS = { fetch: Download, pull: ArrowDown, update: ArrowDownUp, push: ArrowUp };

export function GitToolbar({ panel, connected }: { panel: RemoteGit; connected: boolean }) {
  const [menu, setMenu] = useState<'branches' | 'actions' | null>(null);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<Exclude<GitAction, 'switch'>>('update');
  const disabled = panel.busy || !connected || !panel.changes;
  const repository = panel.repository;
  const counts = gitSyncCounts(repository);
  const branch = panel.changes?.branch ?? t("client.git.detachedHead");
  const selection = repository?.upstream ? `${branch} → ${repository.upstream}` : branch;
  const run = () => { setMenu(null); void panel.action(action); };
  return <div className="git-toolbar-container">
    <div className="git-toolbar">
      <button className="git-branch" type="button" aria-label={t("client.git.switchBranch")} disabled={disabled}
        aria-expanded={menu === 'branches'} onClick={() => setMenu(menu === 'branches' ? null : 'branches')}>
        <GitBranch size={16} /><span>{branch}</span><ChevronDown size={14} />
      </button>
      <div className="git-toolbar-actions">
        {GIT_ACTIONS.map(item => {
          const Icon = ACTION_ICONS[item.action];
          const count = counts[item.action];
          return <Tooltip key={item.action} title={displayText(item.label)} styles={{ root: { maxWidth: 400 } }}>
            <button type="button" aria-label={displayText(item.label)} disabled={disabled}
              className={count !== undefined ? 'git-counted-action' : undefined}
              aria-description={count !== undefined ? t("client.git.commitsToSync", { count }) : undefined}
              aria-expanded={menu === 'actions' && action === item.action}
              onClick={() => {
                setAction(item.action); setMenu(menu === 'actions' && action === item.action ? null : 'actions');
              }}><Icon size={18} />
              {count !== undefined && <span className="git-action-count" aria-hidden="true">{count}</span>}</button>
          </Tooltip>;
        })}
        <Tooltip title={t("client.git.rollBackSelectedFiles")} styles={{ root: { maxWidth: 400 } }}>
          <button type="button" aria-label={t("client.git.rollBackSelectedFiles")}
            disabled={disabled || !Object.keys(panel.selected).length || panel.changes?.files.some(file => file.conflict)}
            onClick={() => { setMenu(null); panel.requestFileAction('rollback'); }}><Undo2 size={18} /></button>
        </Tooltip>
        <Tooltip title={t("client.git.refreshGit")} styles={{ root: { maxWidth: 400 } }}>
          <button type="button" aria-label={t("client.git.refreshGit")} disabled={disabled}
            onClick={() => { panel.setDetail(null); void panel.refresh(); }}><RefreshCw size={18} /></button>
        </Tooltip>
      </div>
    </div>
    {menu && <div className="git-menu" role="region" aria-label={t(menu === 'branches' ? "client.git.switchBranch" : "client.git.syncProject")}>
      <div className="git-menu-heading"><strong>{t(menu === 'branches' ? "client.git.switchBranch" : "client.git.syncProject")}</strong>
        <button type="button" aria-label={t("client.git.closeMenu")} onClick={() => setMenu(null)}><X size={16} /></button></div>
      {menu === 'branches' ? <>
        <input aria-label={t("client.git.searchBranches")} placeholder={t("client.git.searchBranches")} value={query}
          onChange={event => setQuery(event.target.value)} />
        <div className="git-branch-list">{repository?.branches.filter(branch => branch.name.includes(query))
          .map(branch => <button key={branch.ref} type="button"
            disabled={disabled || branch.occupied || (!branch.remote && branch.name === panel.changes?.branch)}
            onClick={() => { setMenu(null); void panel.action('switch', branch.ref); }}>
            <span>{branch.name}</span><small>{t(branch.occupied ? "client.git.usedByAnotherWorktree" : branch.remote ? "client.git.remote" : "client.git.local")}
              {!branch.remote && branch.name === panel.changes?.branch ? ' ✓' : ''}</small></button>)}</div>
        <p className="git-current-branch">{t("client.git.currentSelection", { branch: selection })}</p>
      </> : <>
        <strong>{displayText(GIT_ACTIONS.find(item => item.action === action)!.label)}</strong>
        <p>{displayText(GIT_ACTIONS.find(item => item.action === action)!.hint)}</p>
        <p>{t("client.git.currentBranch")}：{panel.changes?.branch ?? 'HEAD'}<br />
          {t("client.git.trackedBranch")}：{repository?.upstream ?? t("client.accounts.notSet")}</p>
        {action === 'pull' && <>
          <label className="git-strategy">{t("client.git.updateMethod")}<select aria-label={t("client.git.updateMethod")} value={panel.strategy}
            onChange={event => panel.setStrategy(event.target.value === 'rebase' ? 'rebase' : 'merge')}>
            <option value="merge">{t("client.git.merge")}</option><option value="rebase">{t("client.git.rebase")}</option>
          </select></label>
        </>}
        {(action === 'pull' || action === 'update') && !!panel.changes?.files.length
          && <p>{t("client.git.commitLocalChangesBeforePullingOrUpdatingTheProject")}</p>}
        {!repository?.remotes.length && <p>{t("client.git.addARemoteRepositoryOnYourComputerFirst")}</p>}
        <button type="button" className="git-submit" disabled={disabled || !repository?.remotes.length
          || (action !== 'fetch' && !repository.upstream)
          || ((action === 'pull' || action === 'update') && !!panel.changes?.files.length)} onClick={run}>
          {t("client.git.run", { action: displayText(GIT_ACTIONS.find(item => item.action === action)!.label) })}</button>
      </>}
    </div>}
  </div>;
}
