import { uiText } from "../../i18n/uiText";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { isDesktopApp } from '../../api/backend';
import { CreateProjectDialog } from './CreateProjectDialog';
import { folderName, projectName, readProjects, saveProject, type SavedProject } from './projectCatalog';
import { ProjectFolderPicker } from './ProjectFolderPicker';
import { WorkspacePicker } from './WorkspacePicker';
import { useProjectFolderDrop } from './useProjectFolderDrop';
import dropStyles from './ProjectPicker.module.less';
import layout from './styles.module.less';

interface ProjectPickerProps {
  value: string; projects: string[]; disabled: boolean;
  onChange: (cwd: string) => void; onError: (error: unknown) => void;
  gitEnabled?: boolean; onBusyChange?: (busy: boolean) => void; hostPicker?: ReactNode;
  actions?: ReactNode; running?: boolean; active?: boolean; dropTarget?: RefObject<HTMLElement>;
  dropState?: { dragging: boolean; reading: boolean };
}

export function ProjectPicker({ value, projects, disabled, onChange, onError,
  gitEnabled, onBusyChange, hostPicker, actions, running = false, active = true,
  dropTarget, dropState }: ProjectPickerProps) {
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(readProjects);
  const trigger = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const close = () => { setCreating(false); trigger.current?.focus(); };
  useEffect(() => { if (disabled || !active) setCreating(false); }, [disabled, active]);
  const create = (project: SavedProject) => {
    if (disabled) return;
    try {
      setSaved(saveProject(project)); onChange(project.path); close();
    } catch { onError(new Error(uiText("client.conversation.couldNotSaveTheProjectPleaseTryAgain"))); }
  };
  const folderDrop = useProjectFolderDrop({ target: dropTarget ?? bar,
    allowFileAttachments: true,
    enabled: !dropState && active && Boolean(gitEnabled) && !disabled && !creating,
    onFolder: path => create({ path, name: projectName(path) }), onError });
  const drop = dropState ?? folderDrop;
  return <div ref={bar} className={layout.projectBar}>
    {(drop.dragging || drop.reading) && <div className={dropStyles.dropHint} role="status">
      <span>{drop.reading ? uiText("client.chat.addingAttachments") : uiText("client.composer.dropToAddFilesOrFolders")}</span>
    </div>}
    {!running && <ProjectFolderPicker value={value} disabled={disabled} triggerRef={trigger}
      projects={[...saved, ...projects.map(path => ({ path, name: folderName(path) }))]}
      onChange={onChange} onClear={() => onChange('')} onOpen={() => setSaved(readProjects())}
      onAdd={() => setCreating(true)} addLabel={uiText("client.conversation.newProject")} />}
    <div className={layout.projectBarActions}>
      {!running && gitEnabled && onBusyChange && <WorkspacePicker key={value} cwd={value} disabled={disabled}
        onChange={onChange} onBusyChange={onBusyChange} localLabel={hostPicker ? uiText("client.conversation.worktree") : undefined} />}
      {actions}
    </div>
    {!running && !(gitEnabled && onBusyChange) && !hostPicker && <span className={layout.localLabel}>
      {isDesktopApp ? uiText("client.git.local") : uiText("client.conversation.remoteAiHost")}</span>}
    {hostPicker}
    {creating && <CreateProjectDialog disabled={disabled} onCreate={create} onError={onError}
      onClose={close} />}
  </div>;
}
