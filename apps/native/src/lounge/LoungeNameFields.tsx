import { Pressable, Text, TextInput, View } from 'react-native';
import { useLoungeNameEditor, type LoungeNameEditorOptions } from '../../../../shared/lounge/useLoungeNameEditor';
import { t } from '../i18n';
import { textMetrics } from '../theme/text';
import { createLoungeStyles, useLoungeColor } from './theme';

export function LoungeNameFields(props: LoungeNameEditorOptions) {
  const editor = useLoungeNameEditor(props);
  const styles = useStyles(); const color = useLoungeColor();
  const label = t(editor.own ? 'client.lounge.nickname' : 'client.lounge.remark');
  return <View style={styles.root}>
    {!editor.own && <View style={styles.readonly}>
      <Text style={styles.label}>{t('client.lounge.nickname')}</Text>
      <Text style={styles.value}>{props.user.nickname || t('client.lounge.nameNotSet')}</Text>
    </View>}
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.hint}>{t(editor.own ? 'client.lounge.nicknameHint' : 'client.lounge.remarkHint')}</Text>
    <TextInput value={editor.value} onChangeText={editor.change} editable={!editor.busy} style={styles.input}
      accessibilityLabel={label} placeholder={t('client.lounge.nameNotSet')} autoCorrect={false}
      placeholderTextColor={color('#687c89', 'muted')} returnKeyType="done" onSubmitEditing={() => void editor.save()} />
    <Text style={styles.hint}>{t('client.lounge.nameLimit', { limit: editor.limit })}</Text>
    {!editor.available && <Text style={styles.hint}>{t('client.lounge.namesUnavailable')}</Text>}
    {editor.invalid && <Text accessibilityRole="alert" style={styles.error}>
      {t('client.lounge.nameInvalid', { limit: editor.limit })}</Text>}
    {editor.error && <Text accessibilityRole="alert" style={styles.error}>{t(editor.error)}</Text>}
    {editor.saved && <Text accessibilityLiveRegion="polite" style={styles.hint}>{t('client.lounge.nameSaved')}</Text>}
    <Pressable accessibilityRole="button" disabled={!editor.canSave}
      accessibilityState={{ disabled: !editor.canSave, busy: editor.busy }} onPress={() => void editor.save()}
      style={[styles.save, !editor.canSave && styles.disabled]}>
      <Text style={styles.saveText}>{t('client.lounge.saveName')}</Text>
    </Pressable>
  </View>;
}

const useStyles = createLoungeStyles(color => ({
  root: { marginTop: 24, gap: 8, maxWidth: 400 },
  readonly: { marginBottom: 16, gap: 8 },
  label: { ...textMetrics(14, 21), color: color('#202b33', 'ink'), fontWeight: '600' },
  value: { ...textMetrics(14, 21), color: color('#202b33', 'ink') },
  hint: { ...textMetrics(12, 19), color: color('#687c89', 'muted') },
  input: { ...textMetrics(16, 24), minHeight: 48, borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, color: color('#202b33', 'ink'), backgroundColor: color('#e9eef1', 'elevated') },
  error: { ...textMetrics(12, 19), color: color('#c14c51', 'danger') },
  save: { minHeight: 44, marginTop: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color('#456c96', 'info') },
  saveText: { ...textMetrics(15, 22), color: color('#f5f7f8', 'canvas'), fontWeight: '600' },
  disabled: { opacity: 0.4 },
}));
