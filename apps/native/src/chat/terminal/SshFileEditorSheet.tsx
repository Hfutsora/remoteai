import { useState } from 'react';
import { Platform, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { useSshFileEditor } from '../../../../../shared/terminal/useSshFileEditor';
import { BottomSheet } from '../../components/BottomSheet';
import { displayError, t } from '../../i18n';
import { useSshStyles } from './sshStyles';

export function SshFileEditorSheet({ editor, connected }: {
  editor: ReturnType<typeof useSshFileEditor>; connected: boolean;
}) {
  const styles = useSshStyles();
  const { height } = useWindowDimensions();
  const [confirmClose, setConfirmClose] = useState(false);
  const [saved, setSaved] = useState(false);
  const file = editor.document;
  if (!file) return null;
  const close = () => {
    if (editor.busy) return;
    if (editor.dirty) setConfirmClose(true);
    else editor.close();
  };
  const save = async () => { setSaved(await editor.save()); };
  return <BottomSheet visible tall compactHeader dragFromHeaderOnly title={file.entry.name}
    subtitle={file.entry.path} onBack={close} onClose={close} dismissible={!editor.busy}
    actions={[{ label: t('client.ssh.closeFile'), disabled: editor.busy, onPress: close },
      { label: t('client.ssh.saveFile'), tone: 'primary', loading: editor.busy,
        disabled: !connected || !editor.dirty, onPress: save }]}>
    <View style={[styles.editor, { height: height * .55 }]}>
      <TextInput accessibilityLabel={t('client.ssh.fileContent')} multiline autoCapitalize="none"
        autoCorrect={false} spellCheck={false} textAlignVertical="top" editable={!editor.busy}
        style={[styles.input, styles.editorInput, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}
        value={file.text} onChangeText={text => { setSaved(false); editor.changeText(text); }} />
      {!!editor.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(editor.error)}</Text>}
      {saved && !editor.dirty && <Text accessibilityRole="alert" style={styles.hint}>
        {t('client.ssh.fileSaved')}
      </Text>}
    </View>
    {confirmClose && <BottomSheet visible maxWidth={400} title={t('client.ssh.unsavedTitle')}
      onClose={() => setConfirmClose(false)}
      actions={[{ label: t('client.ssh.cancel'), onPress: () => setConfirmClose(false) },
        { label: t('client.ssh.discardChanges'), tone: 'danger', onPress: () => {
          setConfirmClose(false); editor.close();
        } }]}>
      <Text style={styles.label}>{t('client.ssh.unsavedHint')}</Text>
    </BottomSheet>}
  </BottomSheet>;
}
