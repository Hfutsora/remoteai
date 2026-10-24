import { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GuiToolsClient } from '../../../../../shared/remote-chat/guiTools';
import type { useRemoteTerminalLauncher } from '../../../../../shared/remote-chat/useRemoteTerminalLauncher';
import { MAX_REMOTE_TERMINALS } from '../../../../../shared/remote-chat/useRemoteTerminalPanel';
import { sshLabel } from '../../../../../shared/terminal/sshProfiles';
import { t, useLanguage } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { useTerminalStyles } from './styles';
import { SshConnectionSheet } from './SshConnectionSheet';
import { SshFilesSheet } from './SshFilesSheet';

export function TerminalTabs({ panel, client, cwd, connected, active }: {
  panel: ReturnType<typeof useRemoteTerminalLauncher>; client: GuiToolsClient['terminal'];
  cwd: string; connected: boolean; active: boolean;
}) {
  useLanguage();
  const styles = useTerminalStyles();
  const color = useThemeColor();
  const [tool, setTool] = useState<'ssh' | 'files'>();
  useEffect(() => { if (!active) setTool(undefined); }, [active]);
  useEffect(() => { setTool(undefined); }, [client, cwd]);
  const selected = panel.tabs.find(tab => tab.id === panel.selected);
  const disabled = panel.busy || !connected || panel.tabs.length >= MAX_REMOTE_TERMINALS;
  return <View>
    <View style={styles.tabsRow}>
      <ScrollView horizontal style={styles.tabs} contentContainerStyle={styles.tabItems}>
        {panel.tabs.map((tab, index) => {
          const label = tab.session.ssh ? sshLabel(tab.session.ssh)
            : t('client.mobile.terminal', { value1: index + 1 });
          return <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={label}
            accessibilityState={{ selected: tab.id === panel.selected }}
            style={[styles.tab, tab.id === panel.selected && styles.selected]} onPress={() => panel.select(tab.id)}>
            <Text style={styles.tabLabel}>{label}</Text>
          </Pressable>;
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.chat.newTerminal')}
        style={[styles.button, disabled && styles.disabled]} disabled={disabled} onPress={panel.add}>
        <Ionicons name="add-outline" size={22} color={color('#17211b', 'ink')} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.ssh.menu')}
        style={[styles.button, disabled && styles.disabled]} disabled={disabled}
        onPress={() => { Keyboard.dismiss(); setTool('ssh'); }}>
        <Ionicons name="server-outline" size={21} color={color('#17211b', 'ink')} />
      </Pressable>
      {selected?.session.ssh && <Pressable accessibilityRole="button" accessibilityLabel={t('client.ssh.files')}
        style={styles.button} onPress={() => { Keyboard.dismiss(); setTool('files'); }}>
        <Ionicons name="folder-open-outline" size={22} color={color('#17211b', 'ink')} />
      </Pressable>}
    </View>
    {tool === 'ssh' && active && <SshConnectionSheet api={client.ssh} cwd={cwd} connected={panel.adopt}
      dispose={client.close} close={() => setTool(undefined)} />}
    {tool === 'files' && active && selected?.session.ssh && <SshFilesSheet key={selected.id} api={client.ssh}
      info={selected.session} connected={connected} close={() => setTool(undefined)} />}
  </View>;
}
