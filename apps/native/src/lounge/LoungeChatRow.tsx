import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ConversationRow } from '../../../../shared/lounge/conversationRows';
import type { MobileLounge } from '../../../../shared/lounge/useMobileLounge';
import { contactStatus } from '../../../../shared/lounge/contacts';
import { t, getLocale } from '../i18n';
import { LoungeAvatar } from './LoungeMessage';
import { LoungeSwipeRow } from './LoungeSwipeRow';
import { useLoungeStyles } from './styles';
import { useLoungeColor } from './theme';

export function LoungeChatRow({ row, model, actions }: {
  row: ConversationRow; model: MobileLounge; actions: () => void;
}) {
  const styles = useLoungeStyles(); const color = useLoungeColor();
  return <LoungeSwipeRow enabled={!!row.user && !!model.state.directResetAvailable && model.state.status === 'connected'}
    remove={() => model.setDeleting(row.user)}>
    <View style={[styles.chatRow, row.current && styles.selectedRow]}>
      {row.user ? <View style={styles.chatAvatar}>
        <LoungeAvatar user={row.user} onProfile={() => model.setProfile(row.user)} onLongPress={actions} />
        <View pointerEvents="none" style={[styles.avatarPresence, !row.online && styles.offlineDot]} />
      </View> : <Pressable accessible={false} style={styles.avatar} onPress={() => model.select()}>
        <Ionicons name="chatbubbles-outline" size={22} color={color('#456c96', 'info')} /></Pressable>}
      <Pressable accessibilityRole="button" style={styles.chatRowMain}
        accessibilityLabel={row.user ? t('client.lounge.directWith', { account: row.user.account })
          : t('client.lounge.groupChat')} accessibilityState={{ selected: row.current }}
        accessibilityHint={row.contact ? t(contactStatus(row.contact)) : undefined}
        onPress={() => model.select(row.user)} onLongPress={row.user ? actions : undefined}>
        <View style={styles.heading}>
          <Text style={styles.rowTitle}>{row.user?.account ?? t('client.lounge.groupChat')}</Text>
          <Text numberOfLines={1} style={styles.muted}>{previewText(row)}</Text>
        </View>
        <View style={styles.rowMeta}>
          {row.last && <Text style={styles.messageTime}>{new Date(row.last.sentAt).toLocaleTimeString(getLocale(), {
            hour: '2-digit', minute: '2-digit' })}</Text>}
          {row.unread > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>
            {row.unread > 99 ? '99+' : row.unread}</Text></View>
            : row.current && <Text style={styles.chatsLabel}>{t('client.lounge.current')}</Text>}
        </View>
      </Pressable>
    </View>
  </LoungeSwipeRow>;
}

function previewText(row: ConversationRow) {
  if (row.draft?.text || row.draft?.images.length) return t('client.lounge.draftPreview', {
    text: row.draft.text || t('client.lounge.quotedImages', { count: row.draft.images.length }) });
  if (row.last) return row.last.text || t('client.lounge.quotedImages', { count: row.last.images.length });
  return t(row.user ? 'client.lounge.directEmpty' : 'client.lounge.emptyHint');
}
