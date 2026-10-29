import { Modal, Pressable, Text, View } from 'react-native';
import type { LoungeMessage } from '../../../../shared/lounge/types';
import { t } from '../i18n';
import { useLoungeStyles } from './styles';

export function LoungeMessageActions({ message, reply, close, direct, block, blocked }: {
  message: LoungeMessage; reply: (message: LoungeMessage) => void; close: () => void;
  direct?: () => void; block?: () => void; blocked?: boolean;
}) {
  const styles = useLoungeStyles();
  return <Modal transparent animationType="fade" onRequestClose={close}>
    <Pressable style={styles.overlay} onPress={close}><View style={styles.dialog}>
      <Text style={styles.title}>{t('client.lounge.messageActions')}</Text>
      <Pressable accessibilityRole="button" style={styles.iconButton} onPress={() => { close(); reply(message); }}>
        <Text style={styles.link}>{t('client.lounge.quoteReply')}</Text></Pressable>
      {direct && <Pressable accessibilityRole="button" style={styles.iconButton} onPress={() => { close(); direct(); }}>
        <Text style={styles.link}>{t('client.lounge.directChat')}</Text></Pressable>}
      {block && <Pressable accessibilityRole="button" style={styles.iconButton} onPress={() => { close(); block(); }}>
        <Text style={styles.link}>{t(blocked ? 'client.lounge.unblockUser' : 'client.lounge.blockUser')}</Text></Pressable>}
      <Pressable accessibilityRole="button" style={styles.iconButton} onPress={close}>
        <Text style={styles.link}>{t('client.lounge.cancel')}</Text></Pressable>
    </View></Pressable>
  </Modal>;
}
