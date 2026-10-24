import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { t, useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { colors, useStyles } from './styles';

export function DownloadTaskHeading({ count, selected, busy, remove }: {
  count: number; selected: number; busy: boolean; remove: () => void;
}) {
  useLanguage();
  const styles = useStyles();
  const color = useThemeColor();
  const disabled = !selected || busy;
  const label = selected ? t('client.downloads.deleteSelectedCount', { count: selected })
    : t('client.downloads.deleteSelected');
  return <View style={styles.sectionHeading}>
    <Text style={styles.sectionTitle}>{t('client.downloads.downloads.ea215a')}</Text>
    <View style={styles.sectionActions}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
        disabled={disabled} onPress={remove}
        style={({ pressed }) => [styles.batchDelete, disabled && styles.disabled, pressed && styles.pressed]}>
        <Ionicons name="trash-outline" size={15} color={color(colors.danger, 'danger')} />
        <Text style={styles.batchDeleteText}>{label}</Text>
      </Pressable>
      <Text style={styles.count}>{t('client.downloads.tasks', { count })}</Text>
    </View>
  </View>;
}
