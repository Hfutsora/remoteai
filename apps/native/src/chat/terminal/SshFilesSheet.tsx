import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import type { SshApi, SshEntry } from '../../../../../shared/terminal/ssh';
import { sshError } from '../../../../../shared/terminal/ssh';
import type { TerminalInfo } from '../../../../../shared/terminal/types';
import { useSshFiles } from '../../../../../shared/terminal/useSshFiles';
import { useSshFileActions } from '../../../../../shared/terminal/useSshFileActions';
import { useSshFileEditor } from '../../../../../shared/terminal/useSshFileEditor';
import { BottomSheet } from '../../components/BottomSheet';
import { SheetFlatList } from '../../components/SheetScrollView';
import { t, displayError, useLanguage } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { SshFileIconButton, SshFileToolbar } from './SshFileToolbar';
import { useSshFileStyles } from './sshFileStyles';
import { useSshStyles } from './sshStyles';
import { nativeSshDownload, pickSshUpload } from './sshTransfers';
import { SshFileActionsSheet } from './SshFileActionsSheet';
import { SshFileEditorSheet } from './SshFileEditorSheet';

const FILE_LONG_PRESS_MS = 500;

export function SshFilesSheet({ api, info, connected, close }: {
  api: SshApi; info: TerminalInfo; connected: boolean; close: () => void;
}) {
  useLanguage();
  const styles = useSshStyles();
  const fileStyles = useSshFileStyles();
  const color = useThemeColor();
  const { height } = useWindowDimensions();
  const files = useSshFiles(api, info.id, nativeSshDownload);
  const actions = useSshFileActions(files);
  const editor = useSshFileEditor({ api, id: info.id, download: nativeSshDownload, onSaved: () => files.load() });
  const [address, setAddress] = useState<string>();
  const [filter, setFilter] = useState('');
  const [hidden, setHidden] = useState(true);
  const [context, setContext] = useState<SshEntry>();
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const disabled = files.busy || editor.busy || picking || !connected;
  const load = (path: string) => { setNotice(''); setAddress(undefined); void files.load(path); };
  const upload = async () => {
    if (disabled) return;
    setPicking(true); setError(''); setNotice('');
    try { await pickSshUpload(file => actions.uploadSources([file])); }
    catch (failure) { setError(sshError(failure, 'client.ssh.fileFailed')); }
    finally { setPicking(false); }
  };
  const open = async (entry: SshEntry) => {
    if (disabled) return;
    setNotice(''); setError('');
    if (entry.directory) { load(entry.path); return; }
    const result = await editor.open(entry);
    if (result === 'downloaded') setNotice('downloaded');
  };
  const entries = files.entries.filter(entry => (hidden || !entry.name.startsWith('.'))
    && entry.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return <BottomSheet visible title={t('client.ssh.files')} subtitle={info.ssh?.host} onClose={close}
    onBack={close} tall compactHeader fullWidthContent>
    <View style={[styles.files, { height: height * .7 }]}>
      <SheetFlatList style={styles.fileList} contentContainerStyle={fileStyles.content}
        data={entries} keyExtractor={entry => entry.path}
        ListHeaderComponent={<View style={styles.content}>
          <SshFileToolbar path={files.path} disabled={disabled} navigate={load} refresh={() => load(files.path)}
            createFolder={() => actions.create('createFolder')} upload={() => void upload()} />
          <View style={fileStyles.path}>
            <Feather name="folder" size={16} color={color('#718078', 'muted')} accessible={false} />
            <TextInput style={fileStyles.pathInput} accessibilityLabel={t('client.ssh.path')}
              autoCapitalize="none" autoCorrect={false} value={address ?? files.path} onChangeText={setAddress}
              editable={!disabled} returnKeyType="go" onSubmitEditing={() => load(address ?? files.path)} />
            <SshFileIconButton icon="arrow-right" label={t('client.ssh.go')} disabled={disabled}
              onPress={() => load(address ?? files.path)} />
          </View>
          <View style={fileStyles.search}>
            <Feather name="search" size={17} color={color('#718078', 'muted')} accessible={false} />
            <TextInput style={fileStyles.searchInput} accessibilityLabel={t('client.ssh.filter')}
              placeholder={t('client.ssh.filter')} autoCapitalize="none" autoCorrect={false}
              placeholderTextColor={color('#718078', 'muted')} value={filter} onChangeText={setFilter} />
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: hidden }}
            style={styles.row} onPress={() => setHidden(value => !value)}>
            <Ionicons name={hidden ? 'checkbox-outline' : 'square-outline'} size={22}
              color={color('#14806f', 'accent')} />
            <Text style={styles.label}>{t('client.ssh.hidden')}</Text>
          </Pressable>
          {(files.busy || editor.busy || picking) && <ActivityIndicator />}
          {!!(error || files.error || editor.error) && <Text accessibilityRole="alert" style={styles.error}>
            {displayError(error || files.error || editor.error)}</Text>}
          {!!notice && <Text accessibilityRole="alert" style={styles.hint}>{t('client.ssh.downloaded')}</Text>}
          {files.truncated && <Text style={styles.hint}>{t('client.ssh.truncated')}</Text>}
      </View>}
        keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable accessibilityRole="button"
          accessibilityLabel={item.name} accessibilityState={{ disabled }} disabled={disabled}
          style={styles.file} onPress={() => void open(item)}
          delayLongPress={FILE_LONG_PRESS_MS} onLongPress={() => setContext(item)}
          accessibilityActions={[{ name: 'rename', label: t('client.ssh.rename') },
            { name: 'delete', label: t('client.ssh.delete') }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (disabled) return;
            if (nativeEvent.actionName === 'rename') actions.rename(item);
            if (nativeEvent.actionName === 'delete') actions.remove(item);
          }}>
          <Ionicons name={item.directory ? 'folder-outline' : 'document-outline'} size={20}
            color={color('#718078', 'muted')} />
          <Text style={styles.fileName}>{item.name}</Text>
          {!item.directory && <Text style={styles.hint}>{item.size.toLocaleString()}{' B'}</Text>}
        </Pressable>}
        ListEmptyComponent={!files.busy ? <Text style={styles.hint}>{t('client.ssh.empty')}</Text> : null} />
    </View>
    <SshFileActionsSheet files={files} actions={actions} context={context} closeContext={() => setContext(undefined)} />
    {editor.document && <SshFileEditorSheet key={editor.document.entry.path} editor={editor} connected={connected} />}
  </BottomSheet>;
}
