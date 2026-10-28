import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from 'react';
import { ArrowUp, History, ImagePlus, Plus, Send, X } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { MAX_IMAGES, MAX_TEXT, type LoungeDraft } from './types';
import { prepareImage } from './images';
import { LoungeEmojiPicker } from './LoungeEmojiPicker';
import { sendError } from './contacts';
import type { LoungeReply } from './reply';
import { LoungeReplyPreview } from './LoungeReplyPreview';
import { useComposerDraft, type ComposerDraftState } from './useComposerDraft';
import { MobileLoungeSheet } from './MobileLoungeSheet';

export function LoungeComposer({ connected, send, onHistory, mobile = false, reply, cancelReply,
  draftState, extraActions, onOverlayChange }: {
  connected: boolean; send: (draft: LoungeDraft) => Promise<void>; onHistory: () => void; mobile?: boolean;
  reply?: LoungeReply; cancelReply: (sent?: LoungeReply) => void;
  draftState?: ComposerDraftState; extraActions?: (close: () => void) => ReactNode;
  onOverlayChange?: (open: boolean) => void;
}) {
  const { text, setText, images, setImages, clearSent } = useComposerDraft(draftState);
  const [extras, setExtras] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  useEffect(() => {
    onOverlayChange?.(extras || emojiOpen);
    return () => onOverlayChange?.(false);
  }, [extras, emojiOpen, onOverlayChange]);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const adding = useRef(false);
  const submitting = useRef(false);
  const selection = useRef({ start: 0, end: 0 });
  useEffect(() => { if (reply) textarea.current?.focus(); }, [reply]);
  useEffect(() => {
    if (!mobile || !textarea.current) return;
    textarea.current.style.height = '0px';
    textarea.current.style.height = `${Math.min(132, Math.max(44, textarea.current.scrollHeight))}px`;
  }, [mobile, text]);

  const addImages = async (files: File[]) => {
    if (!files.length || adding.current || submitting.current) return;
    if (images.length + files.length > MAX_IMAGES) { setError('client.lounge.tooManyImages'); return; }
    adding.current = true; setProcessing(true); setError(''); setNotice('');
    try {
      const prepared: string[] = [];
      let flattened = false;
      for (const file of files) {
        const result = await prepareImage(file);
        prepared.push(result.data); flattened ||= result.flattened;
      }
      setImages(current => [...current, ...prepared]);
      if (flattened) setNotice('client.lounge.stillImage');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'client.lounge.imageFailed'); }
    finally { adding.current = false; setProcessing(false); }
  };
  const submit = async () => {
    if (!connected || submitting.current || adding.current || !text.trim() && !images.length) return;
    if ([...text].length > MAX_TEXT) { setError('client.lounge.tooLong'); return; }
    submitting.current = true; setBusy(true); setError('');
    const sent = { text, images, reply };
    try {
      await send(sent); clearSent(sent); setNotice('');
      if (reply && !draftState) cancelReply(reply);
    }
    catch (failure) {
      setError(sendError(failure));
    }
    finally { submitting.current = false; setBusy(false); }
  };
  const insertEmoji = (emoji: string) => {
    const { start, end } = selection.current;
    setText(value => value.slice(0, start) + emoji + value.slice(end));
    selection.current = { start: start + emoji.length, end: start + emoji.length };
    requestAnimationFrame(() => {
      textarea.current?.focus(); textarea.current?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };
  const paste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text/plain');
    if (pastedText) setText(value => value + pastedText);
    void addImages(files);
  };

  return <section className="lounge-composer" onDragOver={event => event.preventDefault()}
    onDrop={event => { event.preventDefault(); void addImages(Array.from(event.dataTransfer.files)); }}>
    <div className="lounge-toolbar">
      <LoungeEmojiPicker disabled={busy} insert={insertEmoji} onOpenChange={setEmojiOpen} />
      {!mobile && <button type="button" disabled={busy || processing} aria-label={t('client.lounge.addImage')}
        title={t(mobile ? 'client.lounge.mobileImageHint' : 'client.lounge.imageHint')}
        onClick={() => picker.current?.click()}><ImagePlus size={22} /></button>}
      <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden
        onChange={event => { void addImages(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      {processing && <span role="status">{t('client.lounge.preparingImage')}</span>}
      {!mobile && <button type="button" className="lounge-history-button" onClick={onHistory}
        aria-label={t('client.lounge.history')} title={t('client.lounge.history')}><History size={22} /></button>}
    </div>
    {reply && <LoungeReplyPreview reply={reply} cancel={() => cancelReply()} />}
    {!!images.length && <div className="lounge-attachments">{images.map((image, index) => <div key={index}>
      <img src={image} alt={t('client.lounge.image')} />
      <button type="button" disabled={busy || processing} aria-label={t('client.lounge.removeImage')}
        onClick={() => setImages(value => value.filter((_, position) => position !== index))}><X size={14} /></button>
    </div>)}</div>}
    <textarea ref={textarea} rows={mobile ? 1 : undefined} value={text}
      aria-label={t('client.lounge.message')}
      placeholder={t(mobile ? 'client.lounge.mobilePlaceholder' : 'client.lounge.placeholder')}
      onChange={event => setText(event.target.value)}
      onSelect={event => { selection.current = { start: event.currentTarget.selectionStart,
        end: event.currentTarget.selectionEnd }; }} onPaste={paste}
      onKeyDown={event => {
        if (!mobile && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault(); void submit();
        }
      }} />
    {error && <p className="lounge-composer-error" role="alert">{t(error)}</p>}
    {notice && <p className="lounge-composer-notice">{t(notice)}</p>}
    {mobile && <button type="button" className="lounge-more" aria-label={t('client.lounge.more')}
      onClick={() => setExtras(true)}><Plus size={24} /></button>}
    <footer>{!mobile && <small>{t('client.lounge.sendHint')}</small>}
      <button className="lounge-send" type="button" onClick={() => void submit()}
        onPointerDown={event => {
          if (event.button === 0 && document.activeElement === textarea.current) event.preventDefault();
        }}
        aria-label={t(busy ? 'client.lounge.sending' : 'client.lounge.send')}
        disabled={!connected || busy || processing || !text.trim() && !images.length}>
        {mobile ? <ArrowUp size={22} /> : <><Send size={16} />{t(busy ? 'client.lounge.sending' : 'client.lounge.send')}</>}
      </button></footer>
    {mobile && extras && <MobileLoungeSheet title={t('client.lounge.more')} close={() => setExtras(false)}>
      <div className="lounge-extra-actions">
        <button type="button" disabled={busy || processing} onClick={() => {
          setExtras(false); picker.current?.click();
        }}><ImagePlus size={24} />{t('client.lounge.addImage')}</button>
        <button type="button" onClick={() => { setExtras(false); onHistory(); }}>
          <History size={24} />{t('client.lounge.history')}</button>
        {extraActions?.(() => setExtras(false))}
      </div>
    </MobileLoungeSheet>}
  </section>;
}
