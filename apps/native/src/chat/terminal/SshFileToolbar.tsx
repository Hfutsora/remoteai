import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { sshParent } from '../../../../../shared/terminal/useSshFiles';
import { t } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { useSshFileStyles } from './sshFileStyles';

export function SshFileIconButton({ icon, label, onPress, disabled, primary }: {
  icon: ComponentProps<typeof Feather>['name']; label: string; onPress: () => void;
  disabled?: boolean; primary?: boolean;
}) {
  const styles = useSshFileStyles();
  const color = useThemeColor();
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.iconButton, primary && styles.primaryButton,
      pressed && styles.pressed, disabled && styles.disabled]}>
    <Feather name={icon} size={20}
      color={primary ? color('#fff', 'canvas') : color('#52645b', 'ink')} accessible={false} />
  </Pressable>;
}

export function SshFileToolbar({ path, disabled, navigate, refresh, createFolder, upload }: {
  path: string; disabled: boolean; navigate: (path: string) => void; refresh: () => void;
  createFolder: () => void; upload: () => void;
}) {
  const styles = useSshFileStyles();
  return <View style={styles.toolbar}>
    <View style={styles.navigation}>
      <SshFileIconButton icon="home" label={t('client.ssh.home')} disabled={disabled}
        onPress={() => navigate('.')} />
      <SshFileIconButton icon="arrow-up" label={t('client.ssh.parent')} disabled={disabled || path === '/'}
        onPress={() => navigate(sshParent(path))} />
      <SshFileIconButton icon="refresh-cw" label={t('client.ssh.refresh')} disabled={disabled} onPress={refresh} />
    </View>
    <View style={styles.actions}>
      <SshFileIconButton icon="folder-plus" label={t('client.ssh.newFolder')} disabled={disabled}
        onPress={createFolder} />
      <SshFileIconButton icon="upload" label={t('client.ssh.upload')} disabled={disabled} primary onPress={upload} />
    </View>
  </View>;
}
