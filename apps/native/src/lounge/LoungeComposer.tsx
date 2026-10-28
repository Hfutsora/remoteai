import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_IMAGES, MAX_TEXT, type LoungeDraft } from '../../../../shared/lounge/types';
import { LOUNGE_EMOJI } from '../../../../shared/lounge/emoji';
import { displayText, t } from '../i18n';
import { useLoungeColor } from './theme';
import { pickLoungeImages } from './images';
import { useLoungeStyles } from './styles';
import type { LoungeReply } from '../../../../shared/lounge/reply';
import { LoungeReplyPreview } from './LoungeReplyPreview';
import { sendError } from '../../../../shared/lounge/contacts';
import { useComposerDraft, type ComposerDraftState } from '../../../../shared/lounge/useComposerDraft';
import { LoungeSheet } from './LoungeSheet';

export function LoungeComposer({ connected, send, onHistory, reply, cancelReply, draftState, extraActions,
  onOverlayChange }: {
  connected: boolean; send: (draft: LoungeDraft) => Promise<void>; onHistory: () => void;
  reply?: LoungeReply; cancelReply: (sent?: LoungeReply) => void;
  draftState: ComposerDraftState; extraActions: (close: () => void) => ReactNode;
  onOverlayChange: (open: boolean) => void;
}) {
  const styles = useLoungeStyles();
  const color = useLoungeColor();
  const { text, setText, images, setImages, clearSent } = useComposerDraft(draftState);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [extras, setExtras] = useState(false);
  useEffect(() => {
    onOverlayChange(extras || emojiOpen);
    return () => onOverlayChange(false);
  }, [extras, emojiOpen, onOverlayChange]);
  const [inputHeight, setInputHeight] = useState(44);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(false);
  const locked = useRef(false);
  const input = useRef<TextInput>(null);
  useEffect(() => { if (reply) input.current?.focus(); }, [reply]);
  const selection = useRef({ start: 0, end: 0 });
  const addImages = async () => {
    if (locked.current) return;
    if (images.length >= MAX_IMAGES) { setError('client.lounge.tooManyImages'); return; }
    locked.current = true; setProcessing(true); setError('');
    try {
      const result = await pickLoungeImages({ remaining: MAX_IMAGES - images.length });
      setImages(current => [...current, ...result.images]); setNotice(result.flattened);
    } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith('client.lounge.')
        ? failure.message : 'client.lounge.imageFailed');
    } finally { locked.current = false; setProcessing(false); }
  };
  const submit = async () => {
    if (locked.current || !connected || !text.trim() && !images.length) return;
    if ([...text].length > MAX_TEXT) { setError('client.lounge.tooLong'); return; }
    locked.current = true; setBusy(true); setError('');
    const sent = { text, images, reply };
    try {
      await send(sent); clearSent(sent); setNotice(false);
    }
    catch (failure) {
      setError(sendError(failure));
    } finally { locked.current = false; setBusy(false); }
  };
  return <View style={styles.composer}>
    {reply && <LoungeReplyPreview reply={reply} cancel={() => cancelReply()} />}
    {emojiOpen && <LoungeSheet title={t('client.lounge.emoji')} close={() => setEmojiOpen(false)}>
      <View style={styles.emoji}>{LOUNGE_EMOJI.map(emoji => <Pressable key={emoji}
      accessibilityRole="button" accessibilityLabel={emoji} style={styles.iconButton} onPress={() => {
        const { start, end } = selection.current;
        setText(value => value.slice(0, start) + emoji + value.slice(end));
        setEmojiOpen(false); input.current?.focus();
    }}><Text style={styles.emojiText}>{emoji}</Text></Pressable>)}</View></LoungeSheet>}
    {!!images.length && <View style={styles.attachments}>{images.map((uri, index) => <View key={index}>
      <Image source={{ uri }} style={styles.attachment} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.removeImage')}
        disabled={busy || processing} style={styles.remove}
        onPress={() => setImages(current => current.filter((_, at) => at !== index))}>
        <Ionicons name="close" size={18} color={color('#24262c', 'ink')} /></Pressable>
    </View>)}</View>}
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.emoji')}
        disabled={busy} style={styles.iconButton}
        onPress={() => { Keyboard.dismiss(); setEmojiOpen(true); }}>
        <Ionicons name="happy-outline" size={24} color={color('#687c89', 'muted')} /></Pressable>
    <TextInput ref={input} multiline value={text} onChangeText={setText}
      style={[styles.input, { height: inputHeight }]}
      onContentSizeChange={event => setInputHeight(Math.max(44, Math.min(132, event.nativeEvent.contentSize.height)))}
      onSelectionChange={event => { selection.current = event.nativeEvent.selection; }}
      accessibilityLabel={t('client.lounge.message')} placeholder={t('client.lounge.mobilePlaceholder')}
      placeholderTextColor={color('#838892', 'muted')} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.more')} style={styles.iconButton}
        onPress={() => { Keyboard.dismiss(); setExtras(true); }}>
        <Ionicons name="add" size={24} color={color('#687c89', 'muted')} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t(busy ? 'client.lounge.sending' : 'client.lounge.send')}
        onPress={() => void submit()} disabled={!connected || busy || processing || !text.trim() && !images.length}
        style={[styles.send, (!connected || busy || processing || !text.trim() && !images.length) && styles.disabled]}>
        <Ionicons name="arrow-up" size={22} color={color('#fff', 'canvas')} /></Pressable>
    </View>
    {processing && <Text style={styles.muted}>{t('client.lounge.preparingImage')}</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{displayText(error)}</Text>}
    {notice && <Text style={styles.muted}>{t('client.lounge.stillImage')}</Text>}
    {extras && <LoungeSheet title={t('client.lounge.more')} close={() => setExtras(false)}>
      <View style={styles.extraActions}>
        <Pressable accessibilityRole="button" accessibilityHint={t('client.lounge.mobileImageHint')}
          disabled={busy || processing} style={styles.extraAction}
          onPress={() => { setExtras(false); void addImages(); }}>
          <Ionicons name="image-outline" size={24} color={color('#456c96', 'info')} />
          <Text style={styles.chatsLabel}>{t('client.lounge.addImage')}</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.extraAction}
          onPress={() => { setExtras(false); onHistory(); }}>
          <Ionicons name="time-outline" size={24} color={color('#456c96', 'info')} />
          <Text style={styles.chatsLabel}>{t('client.lounge.history')}</Text></Pressable>
        {extraActions(() => setExtras(false))}
      </View>
    </LoungeSheet>}
  </View>;
}
