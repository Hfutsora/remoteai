import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { LoungeController } from './controller';
import type { LoungeAccount, LoungeDraft, LoungeMessage } from './types';
import { quoteMessage } from './reply';

export type LoungeSheet = 'members' | 'about' | 'extras' | undefined;
const EMPTY_DRAFT: LoungeDraft = { text: '', images: [] };

/** Page-local navigation and drafts shared by native and mobile web. No chat content leaves the device. */
export function useMobileLounge(controller: LoungeController) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [chats, setChats] = useState(true);
  const [sheet, setSheet] = useState<LoungeSheet>();
  const [drafts, setDrafts] = useState<Record<string, LoungeDraft>>({});
  const offsets = useRef(new Map<string, number>());
  const scrollPositions = useRef(new Map<string, number>());
  const [history, setHistory] = useState(false);
  const [avatar, setAvatar] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [moderating, setModerating] = useState<LoungeAccount>();
  const [blocking, setBlocking] = useState<LoungeAccount>();
  const [profileUser, setProfile] = useState<LoungeAccount>();
  const profile = profileUser && (state.contacts.find(value => value.user.id === profileUser.id)?.user ?? profileUser);
  const [deleting, changeDeleting] = useState<LoungeAccount>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const setDeleting = (user?: LoungeAccount) => { setDeleteError(false); changeDeleting(user); };
  const [composerOverlay, setComposerOverlay] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [now, setNow] = useState(Date.now);
  const muted = !!state.policy.mutedUntil && Date.parse(state.policy.mutedUntil) > now;
  const conversation = state.conversation;
  const change = (draft: LoungeDraft) => setDrafts(current => ({ ...current, [conversation]: draft }));
  const draft = drafts[conversation] ?? EMPTY_DRAFT;
  const contact = state.contacts.find(value => value.user.id === conversation);
  const select = (user?: LoungeAccount) => {
    controller.setViewing(false);
    controller.selectConversation(user);
    setAtBottom((offsets.current.get(user?.id ?? '') ?? 0) < 48);
    setSheet(undefined); setChats(false); setProfile(undefined); setHistory(false);
  };
  const deleteContact = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setDeleteError(false);
    try {
      await controller.deleteContact(deleting.id);
      setDrafts(current => { const updated = { ...current }; delete updated[deleting.id]; return updated; });
      offsets.current.delete(deleting.id); scrollPositions.current.delete(deleting.id);
      setProfile(undefined); setSheet(undefined); setHistory(false); setChats(true); setDeleting(undefined);
    } catch { setDeleteError(true); }
    finally { setDeleteBusy(false); }
  };
  const quote = (message: LoungeMessage) => { change({ ...draft, reply: quoteMessage(message) }); setHistory(false); };
  const cancelReply = () => change({ ...draft, reply: undefined });
  useEffect(() => {
    controller.setViewing(atBottom && !chats && !sheet && !history && !avatar && !preview
      && !moderating && !blocking && !profile && !deleting && !composerOverlay);
    return () => controller.setViewing(false);
  }, [controller, atBottom, chats, sheet, history, avatar, preview, moderating, blocking,
    profile, deleting, composerOverlay, conversation]);
  useEffect(() => {
    if (!muted) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [muted]);
  return { state, contact, chats, setChats, sheet, setSheet, drafts, draftState: { draft, change },
    offsets, scrollPositions, history, setHistory, avatar, setAvatar, preview, setPreview, moderating, setModerating,
    blocking, setBlocking, profile, setProfile, deleting, setDeleting, deleteBusy, deleteError, deleteContact,
    atBottom, setAtBottom, muted, select, quote, cancelReply, setComposerOverlay };
}

export type MobileLounge = ReturnType<typeof useMobileLounge>;
