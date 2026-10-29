import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { MobileLounge } from '../../../../shared/lounge/useMobileLounge';
import { contactStatus } from '../../../../shared/lounge/contacts';
import { t } from '../i18n';
import { textMetrics } from '../theme/text';
import { LoungeAvatar } from './LoungeMessage';
import { useLoungeStyles } from './styles';
import { createLoungeStyles, useLoungeColor } from './theme';

const useProfileStyles = createLoungeStyles(color => ({
  cover: { height: 100, backgroundColor: color('#deebf7', 'infoSoft') },
  details: { marginTop: -24, paddingHorizontal: 24, paddingBottom: 32 },
  account: { ...textMetrics(20, 30), color: color('#202b33', 'ink'), fontWeight: '600', marginTop: 20, marginBottom: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusText: { ...textMetrics(14, 21), color: color('#687c89', 'muted'), flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  delete: { borderWidth: 1, borderColor: color('#d5dfe6', 'border'), borderRadius: 14, padding: 12,
    minHeight: 48, justifyContent: 'center' },
  deleteText: { ...textMetrics(16, 24), color: color('#d34f55', 'danger') },
  send: { flex: 1, borderRadius: 14, backgroundColor: color('#456c96', 'info'), minHeight: 48,
    padding: 12, justifyContent: 'center', alignItems: 'center' },
  sendText: { ...textMetrics(16, 24), color: color('#f5f7f8', 'canvas') },
}));

export function LoungeProfile({ model }: { model: MobileLounge }) {
  const styles = useLoungeStyles(); const profileStyles = useProfileStyles(); const color = useLoungeColor();
  const user = model.profile;
  if (!user) return null;
  const contact = model.state.contacts.find(value => value.user.id === user.id);
  const canDelete = model.state.directResetAvailable && model.state.status === 'connected';
  return <Modal animationType="slide" onRequestClose={() => model.setProfile(undefined)}>
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.profileBack')}
          style={styles.iconButton} onPress={() => model.setProfile(undefined)}>
          <Ionicons name="chevron-back" size={22} color={color('#202b33', 'ink')} /></Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('client.lounge.profile')}</Text>
      </View>
      <ScrollView style={styles.spacer}>
        <View style={profileStyles.cover} />
        <View style={profileStyles.details}><LoungeAvatar user={user} size="profile" />
          <Text style={profileStyles.account}>{user.account}</Text>
          {contact?.direct && <View style={profileStyles.status}>
            <View style={[styles.onlineDot, (model.state.status !== 'connected' || contact.online !== true)
              && styles.offlineDot]} /><Text style={profileStyles.statusText}>{t(contactStatus(contact))}</Text></View>}
        </View>
      </ScrollView>
      <View style={profileStyles.actions}>
        <Pressable accessibilityRole="button" disabled={!canDelete} onPress={() => model.setDeleting(user)}
          style={[profileStyles.delete, !canDelete && styles.disabled]}>
          <Text style={profileStyles.deleteText}>{t('client.lounge.deleteChat')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!model.state.directAvailable} onPress={() => model.select(user)}
          style={[profileStyles.send, !model.state.directAvailable && styles.disabled]}>
          <Text style={profileStyles.sendText}>{t('client.lounge.sendMessage')}</Text></Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}
