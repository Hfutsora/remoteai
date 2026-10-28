import { useSyncExternalStore } from 'react';
import { Modal } from 'antd';
import { ArrowDown, Ban, ChevronLeft, Info, MessagesSquare, UserRound } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { getInterfaceLanguage, subscribeInterfaceLanguage } from '../localization/interfaceLanguage';
import type { LoungeController } from './controller';
import { useMobileLounge, type MobileLounge } from './useMobileLounge';
import { contactStatus } from './contacts';
import { LoungeComposer } from './LoungeComposer';
import { LoungeHistory } from './LoungeHistory';
import { LoungeAvatarSettings } from './LoungeAvatarSettings';
import { LoungeModeration } from './LoungeModeration';
import { LoungeBlockDialog } from './LoungeBlockDialog';
import { LoungeAbout } from './MobileLoungeSheet';
import { MobileLoungeChats, MobileLoungeMembers } from './MobileLoungeChats';
import { MobileLoungeThread } from './MobileLoungeThread';
import './mobile.css';

export function MobileLoungePage({ controller, onBack }: { controller: LoungeController; onBack?: () => void }) {
  useSyncExternalStore(subscribeInterfaceLanguage, getInterfaceLanguage);
  const model = useMobileLounge(controller);
  const { state, contact } = model;
  return <section className="lounge-page lounge-mobile">
    {model.chats ? <MobileLoungeChats model={model} controller={controller} /> : <>
      <MobileHeading model={model} onBack={onBack} />
      <MobileLoungeThread key={`thread:${state.conversation}`} model={model} />
      {!model.atBottom && <button className="lounge-jump" type="button" onClick={() => model.setAtBottom(true)}>
        <ArrowDown size={16} />{t('client.lounge.latest')}</button>}
      {model.muted && <p className="lounge-mute-notice" role="status">{t('client.lounge.mutedUntil', {
        time: new Date(state.policy.mutedUntil!).toLocaleString(),
      })}</p>}
      {!!state.conversation && state.status === 'connected' && !state.directAvailable
        && <p className="lounge-mute-notice">{t('client.lounge.directUpgrade')}</p>}
      {state.historyError && <p className="lounge-history-warning" role="alert">{t('client.lounge.historySaveFailed')}
        <button type="button" onClick={() => void controller.retryHistory()}>{t('client.lounge.historyRetry')}</button></p>}
      <button type="button" className="lounge-retention" onClick={() => model.setSheet('about')}>
        <Info size={13} />{t(contact ? 'client.lounge.directRetention' : 'client.lounge.retention')}</button>
      <LoungeComposer key={`composer:${state.conversation}`} mobile draftState={model.draftState}
        onOverlayChange={model.setComposerOverlay}
        reply={model.draftState.draft.reply} cancelReply={model.cancelReply}
        connected={state.status === 'connected' && !model.muted && (!state.conversation || state.directAvailable)}
        send={draft => controller.send({ ...draft, to: state.conversation || undefined })}
        onHistory={() => model.setHistory(true)} extraActions={close => <>
          <button type="button" onClick={() => { close(); model.setAvatar(true); }}>
            <UserRound size={24} />{t('client.lounge.avatarSettings')}</button>
          {contact && state.directAvailable && <button type="button" onClick={() => {
            close(); model.setBlocking(contact.user);
          }}><Ban size={24} />{t(state.blocked.includes(contact.user.id)
              ? 'client.lounge.unblockUser' : 'client.lounge.blockUser')}</button>}
        </>} />
    </>}
    {model.sheet === 'members' && <MobileLoungeMembers model={model} />}
    {model.sheet === 'about' && <LoungeAbout direct={!!contact} close={() => model.setSheet(undefined)} />}
    <LoungeHistory open={model.history} close={() => model.setHistory(false)} controller={controller}
      preview={model.setPreview} reply={model.quote} direct={model.select} />
    {model.avatar && state.user && <LoungeAvatarSettings user={state.user} controller={controller}
      close={() => model.setAvatar(false)} />}
    {model.moderating && <LoungeModeration user={model.moderating} controller={controller}
      close={() => model.setModerating(undefined)} />}
    {model.blocking && <LoungeBlockDialog user={model.blocking} blocked={state.blocked.includes(model.blocking.id)}
      controller={controller} close={() => model.setBlocking(undefined)} />}
    <Modal open={!!model.preview} footer={null} centered title={t('client.lounge.previewImage')}
      onCancel={() => model.setPreview(undefined)}>
      {model.preview && <img className="lounge-preview" src={model.preview} alt={t('client.lounge.image')} />}
    </Modal>
  </section>;
}

function MobileHeading({ model, onBack }: { model: MobileLounge; onBack?: () => void }) {
  const { state, contact } = model;
  const status = state.status !== 'connected' ? t(`client.lounge.${state.status}`)
    : contact ? t(contactStatus(contact)) : state.onlineCount !== undefined
      ? t('client.lounge.mobileOnlineCount', { count: state.onlineCount }) : t('client.lounge.membersShort');
  return <header className="lounge-mobile-heading lounge-heading">
    <button type="button" aria-label={t(model.fromChats ? 'client.lounge.backToChats' : 'client.discovery.back')}
      onClick={() => model.fromChats ? model.setChats(true) : onBack?.()}><ChevronLeft size={22} /></button>
    <div className={`lounge-heading-identity${contact ? ' is-private' : ''}`}>
      <h1>{contact?.user.account ?? t('client.lounge.title')}</h1>
      <button type="button" className="lounge-members-trigger" onClick={() => model.setSheet('members')}>
        <i className={state.status === 'connected' && (!contact || contact.online === true) ? 'is-online' : ''} />
        <span className={contact ? 'lounge-peer-status' : state.onlineCount !== undefined
          ? 'lounge-online-count' : undefined}>{status}</span></button>
    </div>
    <button type="button" className="lounge-chats-trigger" aria-label={t('client.lounge.chats')}
      onClick={() => model.setChats(true)}>
      <MessagesSquare size={17} />{t('client.lounge.chats')}
      {state.unread > 0 && <span className="lounge-chat-badge">{state.unread > 99 ? '99+' : state.unread}</span>}
    </button>
  </header>;
}
