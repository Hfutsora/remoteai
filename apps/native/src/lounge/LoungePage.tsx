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

export function LoungePage({ controller }: { controller: LoungeController }) {
  useLanguage();
  const styles = useLoungeStyles();
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const list = useRef<FlatList<Message>>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [history, setHistory] = useState(false);
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
    controller.setViewing(atBottom && !history && !avatar && !preview && !moderating);
    return () => controller.setViewing(false);
  }, [controller, atBottom, history, avatar, preview, moderating]);
  // Keep the newest message at offset zero, including when Android resumes a paused layout.
  const scrollBottom = () => { if (atBottom) list.current?.scrollToOffset({ offset: 0, animated: false }); };
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{t('client.lounge.title')}</Text>
        <Text style={styles.muted}>{t(`client.lounge.${state.status}`)}</Text>
      </View>
      {state.user && <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.avatarSettings')}
        onPress={() => setAvatar(true)}><LoungeAvatar user={state.user} /></Pressable>}
    </View>
    <FlatList ref={list} inverted data={[...state.messages].reverse()}
      contentContainerStyle={styles.list} style={styles.spacer}
      keyExtractor={item => `${item.sender.id}:${item.id}`} keyboardShouldPersistTaps="handled"
      onLayout={scrollBottom} onContentSizeChange={scrollBottom} scrollEventThrottle={32}
      onScroll={({ nativeEvent: event }) => setAtBottom(event.contentOffset.y < 48)}
      renderItem={({ item }) => <LoungeMessage message={item} own={item.sender.id === state.user?.id}
        manage={state.policy.moderator ? setModerating : undefined} preview={setPreview} onImageLoad={scrollBottom} />}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.title}>{t('client.lounge.empty')}</Text>
        <Text style={styles.muted}>{t('client.lounge.ephemeral')}</Text></View>} />
    {!atBottom && <Pressable accessibilityRole="button" style={styles.iconButton}
      onPress={() => { setAtBottom(true); list.current?.scrollToOffset({ offset: 0, animated: true }); }}>
      <Text style={styles.link}>{t('client.lounge.latest')}{state.unread > 0 ? ` · ${state.unread}` : ''}</Text>
    </Pressable>}
    {muted && <View style={styles.notice}><Text style={styles.muted}>{t('client.lounge.mutedUntil',
      { time: new Date(mutedUntil!).toLocaleString(getLocale()) })}</Text></View>}
    {state.historyError && <View style={styles.notice}>
      <Text style={styles.muted}>{t('client.lounge.historySaveFailed')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void controller.retryHistory()} style={styles.iconButton}>
        <Text style={styles.link}>{t('client.lounge.historyRetry')}</Text></Pressable></View>}
    <LoungeComposer key={state.user?.id ?? 'guest'} connected={state.status === 'connected' && !muted}
      send={draft => controller.send(draft)} onHistory={() => setHistory(true)} />
    {history && <LoungeHistory controller={controller} close={() => setHistory(false)} />}
    {avatar && state.user && <LoungeAvatarSettings user={state.user} controller={controller}
      close={() => setAvatar(false)} />}
    {moderating && state.policy.moderator && <LoungeModeration user={moderating} controller={controller}
      close={() => setModerating(undefined)} />}
    {preview && <LoungePreview uri={preview} close={() => setPreview(undefined)} />}
  </KeyboardAvoidingView>;
}
