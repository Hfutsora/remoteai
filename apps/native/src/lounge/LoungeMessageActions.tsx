import { Modal, Pressable, Text, View } from 'react-native';
import type { LoungeMessage } from '../../../../shared/lounge/types';
import { t } from '../i18n';
import { useLoungeStyles } from './styles';

export function LoungeMessageActions({ message, reply, close }: {
  message: LoungeMessage; reply: (message: LoungeMessage) => void; close: () => void;
}) {
  const styles = useLoungeStyles();
  return <Modal transparent animationType="fade" onRequestClose={close}>
    <Pressable style={styles.overlay} onPress={close}><View style={styles.dialog}>
      <Text style={styles.title}>{t('client.lounge.messageActions')}</Text>
      <Pressable accessibilityRole="button" style={styles.iconButton} onPress={() => { close(); reply(message); }}>
        <Text style={styles.link}>{t('client.lounge.quoteReply')}</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.iconButton} onPress={close}>
        <Text style={styles.link}>{t('client.lounge.cancel')}</Text></Pressable>
    </View></Pressable>
  </Modal>;
}
