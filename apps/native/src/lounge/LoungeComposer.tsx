import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_IMAGES, MAX_TEXT, type LoungeDraft } from '../../../../shared/lounge/types';
import { LOUNGE_EMOJI } from '../../../../shared/lounge/emoji';
import { displayText, t } from '../i18n';
import { useThemeColor } from '../theme/store';
import { pickLoungeImages } from './images';
import { useLoungeStyles } from './styles';
import type { LoungeReply } from '../../../../shared/lounge/reply';
import { LoungeReplyPreview } from './LoungeReplyPreview';
import { sendError } from '../../../../shared/lounge/contacts';

export function LoungeComposer({ connected, send, onHistory, reply, cancelReply }: {
  connected: boolean; send: (draft: LoungeDraft) => Promise<void>; onHistory: () => void;
  reply?: LoungeReply; cancelReply: (sent?: LoungeReply) => void;
}) {
  const styles = useLoungeStyles();
  const color = useThemeColor();
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
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
    try {
      await send({ text, images, reply }); setText(''); setImages([]); setNotice(false);
      if (reply) cancelReply(reply);
    }
    catch (failure) {
      setError(sendError(failure));
    } finally { locked.current = false; setBusy(false); }
  };
  return <View style={styles.composer}>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.emoji')}
        disabled={busy} style={styles.iconButton}
        onPress={() => { Keyboard.dismiss(); setEmojiOpen(value => !value); }}>
        <Ionicons name="happy-outline" size={24} color={color('#838892', 'muted')} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.addImage')}
        accessibilityHint={t('client.lounge.mobileImageHint')}
        disabled={busy || processing} style={styles.iconButton} onPress={() => void addImages()}>
        <Ionicons name="image-outline" size={24} color={color('#838892', 'muted')} /></Pressable>
      <View style={styles.spacer} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.history')}
        style={styles.iconButton} onPress={onHistory}>
        <Ionicons name="time-outline" size={24} color={color('#838892', 'muted')} /></Pressable>
    </View>
    {reply && <LoungeReplyPreview reply={reply} cancel={() => cancelReply()} />}
    {emojiOpen && <View style={styles.emoji}>{LOUNGE_EMOJI.map(emoji => <Pressable key={emoji}
      accessibilityRole="button" accessibilityLabel={emoji} style={styles.iconButton} onPress={() => {
        const { start, end } = selection.current;
        setText(value => value.slice(0, start) + emoji + value.slice(end));
        setEmojiOpen(false); input.current?.focus();
      }}><Text style={styles.emojiText}>{emoji}</Text></Pressable>)}</View>}
    {!!images.length && <View style={styles.attachments}>{images.map((uri, index) => <View key={index}>
      <Image source={{ uri }} style={styles.attachment} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.removeImage')}
        disabled={busy || processing} style={styles.remove}
        onPress={() => setImages(current => current.filter((_, at) => at !== index))}>
        <Ionicons name="close" size={18} color={color('#24262c', 'ink')} /></Pressable>
    </View>)}</View>}
    <TextInput ref={input} multiline value={text} onChangeText={setText} editable={!busy} style={styles.input}
      onSelectionChange={event => { selection.current = event.nativeEvent.selection; }}
      accessibilityLabel={t('client.lounge.message')} placeholder={t('client.lounge.mobilePlaceholder')}
      placeholderTextColor={color('#838892', 'muted')} />
    {processing && <Text style={styles.muted}>{t('client.lounge.preparingImage')}</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{displayText(error)}</Text>}
    {notice && <Text style={styles.muted}>{t('client.lounge.stillImage')}</Text>}
    <View style={styles.sendRow}><Pressable accessibilityRole="button" onPress={() => void submit()}
      disabled={!connected || busy || processing || !text.trim() && !images.length}
      style={[styles.button, (!connected || busy || processing || !text.trim() && !images.length) && styles.disabled]}>
      <Text style={styles.buttonText}>{t(busy ? 'client.lounge.sending' : 'client.lounge.send')}</Text>
    </Pressable></View>
  </View>;
}
