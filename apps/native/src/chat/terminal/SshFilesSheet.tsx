import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SshApi } from '../../../../../shared/terminal/ssh';
import { sshError } from '../../../../../shared/terminal/ssh';
import type { TerminalInfo } from '../../../../../shared/terminal/types';
import { sshChild, sshParent, useSshFiles, validSshName } from '../../../../../shared/terminal/useSshFiles';
import { BottomSheet } from '../../components/BottomSheet';
import { t, displayError, useLanguage } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { SshButton, SshField } from './SshControls';
import { useSshStyles } from './sshStyles';
import { nativeSshDownload, pickSshUpload } from './sshTransfers';
import type { SshConflictChoice } from '../../../../../shared/terminal/sshUpload';

type Prompt = { kind: 'rename' | 'createFolder' | 'delete'; name: string; path?: string };

const resolveUploadConflict = (name: string) => new Promise<SshConflictChoice>(resolve => {
  Alert.alert(t('client.ssh.uploadConflictTitle'), t('client.ssh.uploadConflictHint', { name }), [
    { text: t('client.ssh.cancel'), style: 'cancel', onPress: () => resolve(undefined) },
    { text: t('client.ssh.overwrite'), style: 'destructive', onPress: () => resolve('overwrite') },
    { text: t('client.ssh.keepBoth'), onPress: () => resolve('rename') },
  ], { cancelable: true, onDismiss: () => resolve(undefined) });
});

export function SshFilesSheet({ api, info, connected, close }: {
  api: SshApi; info: TerminalInfo; connected: boolean; close: () => void;
}) {
  useLanguage();
  const styles = useSshStyles();
  const color = useThemeColor();
  const { height } = useWindowDimensions();
  const files = useSshFiles(api, info.id, nativeSshDownload);
  const [address, setAddress] = useState<string>();
  const [filter, setFilter] = useState('');
  const [hidden, setHidden] = useState(true);
  const [prompt, setPrompt] = useState<Prompt>();
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const disabled = files.busy || picking || !connected;
  const load = (path: string) => { setNotice(''); setAddress(undefined); void files.load(path); };
  const upload = async () => {
    if (disabled) return;
    setPicking(true); setError(''); setNotice('');
    try { await pickSshUpload(file => files.upload(file, resolveUploadConflict)); }
    catch (failure) { setError(sshError(failure, 'client.ssh.fileFailed')); }
    finally { setPicking(false); }
  };
  const confirm = async () => {
    if (!prompt || disabled) return;
    if (prompt.kind !== 'delete' && !validSshName(prompt.name)) return;
    const destination = sshChild(files.path, prompt.name);
    const done = await files.mutate(prompt.kind === 'rename'
      ? { type: 'rename', path: prompt.path!, destination }
      : { type: prompt.kind, path: prompt.kind === 'delete' ? prompt.path! : destination });
    if (done) setPrompt(undefined);
  };
  const entries = files.entries.filter(entry => (hidden || !entry.name.startsWith('.'))
    && entry.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  const selected = files.selected;
  return <BottomSheet visible title={t('client.ssh.files')} subtitle={info.ssh?.host} onClose={close}
    onBack={close} tall compactHeader dragFromHeaderOnly>
    <View style={[styles.files, { height: height * .7 }]}>
      <FlatList style={styles.fileList} data={entries} keyExtractor={entry => entry.path}
        ListHeaderComponent={<View style={styles.content}>
          <View style={styles.row}>
            <SshButton label={t('client.ssh.home')} disabled={disabled} onPress={() => load('.')} />
            <SshButton label={t('client.ssh.parent')} disabled={disabled || files.path === '/'}
              onPress={() => load(sshParent(files.path))} />
            <SshButton label={t('client.ssh.refresh')} disabled={disabled} onPress={() => load(files.path)} />
            <SshButton label={t('client.ssh.newFolder')} disabled={disabled}
              onPress={() => setPrompt({ kind: 'createFolder', name: '' })} />
            <SshButton label={t('client.ssh.upload')} disabled={disabled} onPress={() => void upload()} />
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.address]} accessibilityLabel={t('client.ssh.path')}
              autoCapitalize="none" autoCorrect={false} value={address ?? files.path} onChangeText={setAddress}
              editable={!disabled} onSubmitEditing={() => load(address ?? files.path)} />
            <SshButton label={t('client.ssh.go')} disabled={disabled} onPress={() => load(address ?? files.path)} />
          </View>
          <TextInput style={styles.input} accessibilityLabel={t('client.ssh.filter')}
            placeholder={t('client.ssh.filter')}
            placeholderTextColor={color('#718078', 'muted')} value={filter} onChangeText={setFilter} />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: hidden }}
            style={styles.row} onPress={() => setHidden(value => !value)}>
            <Ionicons name={hidden ? 'checkbox-outline' : 'square-outline'} size={22}
              color={color('#14806f', 'accent')} />
            <Text style={styles.label}>{t('client.ssh.hidden')}</Text>
          </Pressable>
          {disabled && (files.busy || picking) && <ActivityIndicator />}
          {!!(error || files.error) && <Text accessibilityRole="alert" style={styles.error}>
            {displayError(error || files.error)}</Text>}
          {!!notice && <Text accessibilityRole="alert" style={styles.hint}>{t('client.ssh.downloaded')}</Text>}
          {files.truncated && <Text style={styles.hint}>{t('client.ssh.truncated')}</Text>}
      </View>}
        keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable accessibilityRole="button"
          accessibilityLabel={item.name} accessibilityState={{ selected: selected?.path === item.path, disabled }}
          disabled={disabled}
          style={[styles.file, selected?.path === item.path && styles.selected]} onPress={() => files.select(item)}>
          <Ionicons name={item.directory ? 'folder-outline' : 'document-outline'} size={20}
            color={color('#718078', 'muted')} />
          <Text style={styles.fileName}>{item.name}</Text>
          {!item.directory && <Text style={styles.hint}>{item.size.toLocaleString()}{' B'}</Text>}
        </Pressable>}
        ListEmptyComponent={!files.busy ? <Text style={styles.hint}>{t('client.ssh.empty')}</Text> : null} />
      {selected && <View style={styles.row}>
        <SshButton label={t(selected.directory ? 'client.ssh.openFolder' : 'client.ssh.download')} disabled={disabled}
          onPress={() => {
            if (selected.directory) load(selected.path);
            else void files.download(selected).then(done => { if (done) setNotice('downloaded'); });
          }} />
        <SshButton label={t('client.ssh.rename')} disabled={disabled}
          onPress={() => setPrompt({ kind: 'rename', name: selected.name, path: selected.path })} />
        <SshButton label={t('client.ssh.delete')} disabled={disabled}
          onPress={() => setPrompt({ kind: 'delete', name: selected.name, path: selected.path })} />
      </View>}
      <Text style={styles.hint}>{t('client.ssh.transferHint')}</Text>
    </View>
    {prompt && <BottomSheet visible maxWidth={400} dismissible={!files.busy} onClose={() => setPrompt(undefined)}
      title={t(prompt.kind === 'createFolder' ? 'client.ssh.newFolder' : `client.ssh.${prompt.kind}`)}
      actions={[{ label: t('client.ssh.cancel'), disabled: files.busy, onPress: () => setPrompt(undefined) },
        { label: t(prompt.kind === 'delete' ? 'client.ssh.delete' : 'client.ssh.confirm'),
          disabled: disabled || (prompt.kind !== 'delete' && !validSshName(prompt.name)),
          loading: files.busy, onPress: confirm }]}>
      {prompt.kind === 'delete' ? <View>
        <Text style={styles.label}>{t('client.ssh.deleteConfirm', { name: prompt.name })}</Text>
        <Text style={styles.hint}>{t('client.ssh.deleteHint')}</Text>
      </View> : <SshField label={t('client.ssh.fileName')} value={prompt.name} maxLength={255} autoFocus
        editable={!files.busy} onChangeText={name => setPrompt({ ...prompt, name })} />}
      {!!files.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(files.error)}</Text>}
    </BottomSheet>}
  </BottomSheet>;
}
