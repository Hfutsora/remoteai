import { Text, View } from 'react-native';
import type { SshEntry } from '../../../../../shared/terminal/ssh';
import type { SshFileActions, SshFilesState } from '../../../../../shared/terminal/useSshFileActions';
import { validSshName } from '../../../../../shared/terminal/useSshFiles';
import { BottomSheet } from '../../components/BottomSheet';
import { displayError, t } from '../../i18n';
import { SshButton, SshField } from './SshControls';
import { useSshStyles } from './sshStyles';

export function SshFileActionsSheet({ files, actions, context, closeContext }: {
  files: SshFilesState; actions: SshFileActions; context?: SshEntry; closeContext: () => void;
}) {
  const styles = useSshStyles();
  const { prompt, conflict } = actions;
  const deleting = prompt?.kind === 'delete';
  const title = prompt?.kind === 'createFolder' ? 'client.ssh.newFolder' : 'client.ssh.newFile';
  return <>
    {context && <BottomSheet visible maxWidth={400} title={context.name} onClose={closeContext}>
      <View style={styles.content}>
        <SshButton label={t('client.ssh.rename')} onPress={() => {
          closeContext(); actions.rename(context);
        }} />
        <SshButton label={t('client.ssh.delete')} onPress={() => {
          closeContext(); actions.remove(context);
        }} />
      </View>
    </BottomSheet>}
    {prompt && <BottomSheet visible maxWidth={400} dismissible={!files.busy}
      onClose={() => actions.setPrompt(undefined)}
      title={t(prompt.kind === 'rename' || prompt.kind === 'delete' ? `client.ssh.${prompt.kind}` : title)}
      actions={[{ label: t('client.ssh.cancel'), disabled: files.busy,
        onPress: () => actions.setPrompt(undefined) },
      { label: t(deleting ? 'client.ssh.delete' : 'client.ssh.confirm'),
        tone: deleting ? 'danger' : 'primary', loading: files.busy,
        disabled: files.busy || (!deleting && !validSshName(prompt.name)), onPress: actions.confirm }]}>
      {deleting ? <View>
        <Text style={styles.label}>{t('client.ssh.deleteConfirm', { name: prompt.name })}</Text>
        <Text style={styles.hint}>
          {t(prompt.entry?.directory ? 'client.ssh.deleteFolderHint' : 'client.ssh.deleteFileHint')}
        </Text>
      </View> : <SshField label={t('client.ssh.fileName')} value={prompt.name} maxLength={255} autoFocus
        editable={!files.busy} onChangeText={name => actions.setPrompt({ ...prompt, name })} />}
      {!!files.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(files.error)}</Text>}
    </BottomSheet>}
    {conflict && <BottomSheet visible maxWidth={400} title={t('client.ssh.uploadConflictTitle')}
      onClose={() => actions.chooseConflict(undefined)}>
      <View style={styles.content}>
        <Text style={styles.hint}>{t('client.ssh.uploadConflictHint', { name: conflict })}</Text>
        <SshButton label={t('client.ssh.overwrite')} onPress={() => actions.chooseConflict('overwrite')} />
        <SshButton label={t('client.ssh.keepBoth')} onPress={() => actions.chooseConflict('rename')} />
        <SshButton label={t('client.ssh.cancel')} onPress={() => actions.chooseConflict(undefined)} />
      </View>
    </BottomSheet>}
  </>;
}
