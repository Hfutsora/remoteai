import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LoungeReply } from '../../../../shared/lounge/reply';
import { t } from '../i18n';
import { useThemeColor } from '../theme/store';
import { useLoungeStyles } from './styles';

export function LoungeReplyPreview({ reply, cancel }: { reply: LoungeReply; cancel?: () => void }) {
  const styles = useLoungeStyles();
  const color = useThemeColor();
  return <View style={styles.reply}><View style={styles.spacer}>
    <Text style={styles.muted}>{t('client.lounge.replyingTo', { account: reply.account })}</Text>
    {!!reply.text && <Text style={styles.muted} numberOfLines={2}>{reply.text}</Text>}
    {reply.imageCount > 0 && <Text style={styles.muted}>
      {t('client.lounge.quotedImages', { count: reply.imageCount })}</Text>}
  </View>{cancel && <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.cancelReply')}
    style={styles.iconButton} onPress={cancel}>
    <Ionicons name="close" size={20} color={color('#838892', 'muted')} /></Pressable>}</View>;
}
