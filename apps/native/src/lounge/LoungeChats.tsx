import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LoungeController } from '../../../../shared/lounge/controller';
import type { MobileLounge } from '../../../../shared/lounge/useMobileLounge';
import { conversationRows, type ConversationRow } from '../../../../shared/lounge/conversationRows';
import { contactStatus } from '../../../../shared/lounge/contacts';
import { t, getLocale } from '../i18n';
import { LoungeAvatar } from './LoungeMessage';
import { LoungeSheet } from './LoungeSheet';
import { useLoungeStyles } from './styles';
import { useLoungeColor } from './theme';

export function LoungeChats({ model, controller }: { model: MobileLounge; controller: LoungeController }) {
  const styles = useLoungeStyles();
  const color = useLoungeColor();
  const [query, setQuery] = useState('');
  const [actions, setActions] = useState<ConversationRow>();
  const rows = conversationRows({ state: model.state, controller, drafts: model.drafts }).filter(row =>
    (row.user?.account ?? t('client.lounge.groupChat')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <View style={styles.page}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.backToChat')}
        style={styles.iconButton} onPress={model.closeChats}>
        <Ionicons name="chevron-back" size={22} color={color('#202b33', 'ink')} /></Pressable>
      <Text accessibilityRole="header" style={[styles.title, styles.heading]}>{t('client.lounge.chats')}</Text>
      <Pressable accessibilityRole="button" style={styles.iconButton} onPress={() => model.setSheet('members')}>
        <Text style={styles.chatsLabel}>{t('client.lounge.newChat')}</Text></Pressable>
    </View>
    <View style={styles.search}><Ionicons name="search" size={18} color={color('#687c89', 'muted')} />
      <TextInput value={query} onChangeText={setQuery} style={styles.searchInput}
        accessibilityLabel={t('client.lounge.searchChats')} placeholder={t('client.lounge.searchChats')}
        placeholderTextColor={color('#687c89', 'muted')} /></View>
    <FlatList data={rows} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 12 }}
      ListEmptyComponent={<Text style={styles.muted}>{t('client.lounge.noChats')}</Text>}
      renderItem={({ item, index }) => <>
        {(index === 0 || !rows[index - 1].user) && <Text style={styles.sectionLabel}>
          {t(item.user ? 'client.lounge.privateChats' : 'client.lounge.publicRoom')}</Text>}
        <Pressable accessibilityRole="button" style={[styles.chatRow, item.current && styles.selectedRow]}
          accessibilityLabel={item.user ? t('client.lounge.directWith', { account: item.user.account })
            : t('client.lounge.groupChat')} accessibilityState={{ selected: item.current }}
          onPress={() => model.select(item.user)} onLongPress={item.user ? () => setActions(item) : undefined}>
          {item.user ? <LoungeAvatar user={item.user} /> : <View style={styles.avatar}>
            <Ionicons name="chatbubbles-outline" size={22} color={color('#456c96', 'info')} /></View>}
          <View style={styles.heading}>
            <Text style={styles.rowTitle}>{item.user?.account ?? t('client.lounge.groupChat')}</Text>
            <Text numberOfLines={1} style={styles.muted}>{previewText(item)}</Text>
          </View>
          <View style={styles.rowMeta}>
            {item.last && <Text style={styles.messageTime}>{new Date(item.last.sentAt).toLocaleTimeString(getLocale(), {
              hour: '2-digit', minute: '2-digit' })}</Text>}
            {item.unread > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>
              {item.unread > 99 ? '99+' : item.unread}</Text></View>
              : item.current && <Text style={styles.chatsLabel}>{t('client.lounge.current')}</Text>}
          </View>
        </Pressable>
      </>} />
    {actions?.user && <LoungeSheet title={actions.user.account} close={() => setActions(undefined)}>
      <Pressable accessibilityRole="button" style={styles.iconButton}
        onPress={() => { model.select(actions.user); setActions(undefined); }}>
        <Text style={styles.link}>{t('client.lounge.directChat')}</Text></Pressable>
      {model.state.directAvailable && <Pressable accessibilityRole="button" style={styles.iconButton}
        onPress={() => { model.setBlocking(actions.user); setActions(undefined); }}>
        <Text style={styles.link}>{t(model.state.blocked.includes(actions.id)
          ? 'client.lounge.unblockUser' : 'client.lounge.blockUser')}</Text></Pressable>}
    </LoungeSheet>}
  </View>;
}

function previewText(row: ConversationRow) {
  if (row.draft?.text || row.draft?.images.length) return t('client.lounge.draftPreview', {
    text: row.draft.text || t('client.lounge.quotedImages', { count: row.draft.images.length }) });
  if (row.last) return row.last.text || t('client.lounge.quotedImages', { count: row.last.images.length });
  return t(row.user ? 'client.lounge.directEmpty' : 'client.lounge.emptyHint');
}

export function LoungeMembers({ model }: { model: MobileLounge }) {
  const styles = useLoungeStyles();
  const members = model.state.contacts.filter(contact => contact.user.id !== model.state.user?.id);
  return <LoungeSheet title={t('client.lounge.members')} close={() => model.setSheet(undefined)}>
    <Text style={styles.muted}>{t('client.lounge.membersHint')}</Text>
    {!members.length && <Text style={styles.muted}>{t('client.lounge.noMembers')}</Text>}
    {members.map(contact => <Pressable key={contact.user.id} accessibilityRole="button"
      accessibilityLabel={t('client.lounge.directWith', { account: contact.user.account })}
      style={styles.chatRow} disabled={!model.state.directAvailable} onPress={() => model.select(contact.user)}>
      <LoungeAvatar user={contact.user} /><View style={styles.heading}>
        <Text style={styles.rowTitle}>{contact.user.account}</Text>
        {contact.direct && <Text style={styles.muted}>{t(contactStatus(contact))}</Text>}</View>
      <Text style={styles.chatsLabel}>{t('client.lounge.privateChats')}</Text>
    </Pressable>)}
  </LoungeSheet>;
}
