import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import type { LoungeController } from '../../../../shared/lounge/controller';
import type { LoungeAccount, LoungeMessage as Message } from '../../../../shared/lounge/types';
import { getLocale, t, useLanguage } from '../i18n';
import { LoungeAvatar, LoungeMessage } from './LoungeMessage';
import { LoungeComposer } from './LoungeComposer';
import { LoungeAvatarSettings, LoungeModeration, LoungePreview } from './LoungeDialogs';
import { LoungeHistory } from './LoungeHistory';
import { useLoungeStyles } from './styles';
import { quoteMessage, type LoungeReply } from '../../../../shared/lounge/reply';
import { contactStatus } from '../../../../shared/lounge/contacts';
import { LoungePeople } from './LoungePeople';
import { LoungeBlockDialog } from './LoungeBlockDialog';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '../theme/store';

export function LoungePage({ controller }: { controller: LoungeController }) {
  useLanguage();
  const styles = useLoungeStyles();
  const color = useThemeColor();
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const list = useRef<FlatList<Message>>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [history, setHistory] = useState(false);
  const [reply, setReply] = useState<LoungeReply>();
  useEffect(() => setReply(undefined), [controller, state.conversation]);
  const [people, setPeople] = useState(false);
  const [blocking, setBlocking] = useState<LoungeAccount>();
  const contact = state.contacts.find(value => value.user.id === state.conversation);
  const select = (user?: LoungeAccount) => { controller.selectConversation(user); setPeople(false); setAtBottom(true); };
  const quote = (message: Message) => { setReply(quoteMessage(message)); setHistory(false); };
  const [avatar, setAvatar] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [moderating, setModerating] = useState<LoungeAccount>();
  const [now, setNow] = useState(Date.now);
  const mutedUntil = state.policy.mutedUntil;
  const muted = !!mutedUntil && Date.parse(mutedUntil) > now;
  useEffect(() => {
    if (!muted) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [muted, mutedUntil]);
  useEffect(() => {
    controller.setViewing(atBottom && !history && !avatar && !preview && !moderating && !people);
    return () => controller.setViewing(false);
  }, [controller, atBottom, history, avatar, preview, moderating, people]);
  // Keep the newest message at offset zero, including when Android resumes a paused layout.
  const scrollBottom = () => { if (atBottom) list.current?.scrollToOffset({ offset: 0, animated: false }); };
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.people')}
        style={styles.iconButton} onPress={() => setPeople(true)}>
        <Ionicons name="people-outline" size={22} color={color('#24262c', 'ink')} /></Pressable>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{contact?.user.account ?? t('client.lounge.title')}</Text>
        <Text style={styles.muted}>{t(`client.lounge.${state.status}`)}</Text>
        {contact && <Text style={styles.muted}>{t(contactStatus(contact))}</Text>}
        {state.policy.moderator && state.onlineCount !== undefined && <Text style={styles.muted}>
          {t('client.lounge.onlineCount', { count: state.onlineCount })}</Text>}
      </View>
      {contact && state.directAvailable && <Pressable accessibilityRole="button" style={styles.iconButton}
        accessibilityLabel={t(state.blocked.includes(contact.user.id) ? 'client.lounge.unblockUser' : 'client.lounge.blockUser')}
        onPress={() => setBlocking(contact.user)}>
        <Ionicons name="ban-outline" size={21} color={color('#24262c', 'ink')} /></Pressable>}
      {state.user && <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.avatarSettings')}
        onPress={() => setAvatar(true)}><LoungeAvatar user={state.user} /></Pressable>}
    </View>
    <FlatList ref={list} inverted data={[...state.messages].reverse()}
      contentContainerStyle={styles.list} style={styles.spacer}
      keyExtractor={item => `${item.sender.id}:${item.id}`} keyboardShouldPersistTaps="handled"
      onLayout={scrollBottom} onContentSizeChange={scrollBottom} scrollEventThrottle={32}
      onScroll={({ nativeEvent: event }) => setAtBottom(event.contentOffset.y < 48)}
      renderItem={({ item }) => <LoungeMessage message={item} own={item.sender.id === state.user?.id}
        reply={quote}
        direct={item.sender.id !== state.user?.id && state.directAvailable ? () => select(item.sender) : undefined}
        block={item.sender.id !== state.user?.id && state.directAvailable ? () => setBlocking(item.sender) : undefined}
        blocked={state.blocked.includes(item.sender.id)}
        manage={state.policy.moderator ? setModerating : undefined} preview={setPreview} onImageLoad={scrollBottom} />}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.title}>
        {t(contact ? 'client.lounge.directEmpty' : 'client.lounge.empty')}</Text>
        <Text style={styles.muted}>{t(contact ? 'client.lounge.directHint' : 'client.lounge.ephemeral')}</Text></View>} />
    {!atBottom && <Pressable accessibilityRole="button" style={styles.iconButton}
      onPress={() => { setAtBottom(true); list.current?.scrollToOffset({ offset: 0, animated: true }); }}>
      <Text style={styles.link}>{t('client.lounge.latest')}{state.unread > 0 ? ` · ${state.unread}` : ''}</Text>
    </Pressable>}
    {muted && <View style={styles.notice}><Text style={styles.muted}>{t('client.lounge.mutedUntil',
      { time: new Date(mutedUntil!).toLocaleString(getLocale()) })}</Text></View>}
    {!!state.conversation && state.status === 'connected' && !state.directAvailable && <View style={styles.notice}>
      <Text style={styles.muted}>{t('client.lounge.directUpgrade')}</Text></View>}
    {state.historyError && <View style={styles.notice}>
      <Text style={styles.muted}>{t('client.lounge.historySaveFailed')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void controller.retryHistory()} style={styles.iconButton}>
        <Text style={styles.link}>{t('client.lounge.historyRetry')}</Text></Pressable></View>}
    <LoungeComposer key={`${state.user?.id ?? 'guest'}:${state.conversation}`}
      connected={state.status === 'connected' && !muted && (!state.conversation || state.directAvailable)}
      reply={reply} cancelReply={sent => setReply(current => !sent || current === sent ? undefined : current)}
      send={draft => controller.send({ ...draft, to: state.conversation || undefined })} onHistory={() => setHistory(true)} />
    {history && <LoungeHistory controller={controller} close={() => setHistory(false)} reply={quote} />}
    {avatar && state.user && <LoungeAvatarSettings user={state.user} controller={controller}
      close={() => setAvatar(false)} />}
    {moderating && state.policy.moderator && <LoungeModeration user={moderating} controller={controller}
      close={() => setModerating(undefined)} />}
    {preview && <LoungePreview uri={preview} close={() => setPreview(undefined)} />}
    {people && <LoungePeople state={state} select={select} block={setBlocking} close={() => setPeople(false)} />}
    {blocking && <LoungeBlockDialog user={blocking} blocked={state.blocked.includes(blocking.id)}
      controller={controller} close={() => setBlocking(undefined)} />}
  </KeyboardAvoidingView>;
}
