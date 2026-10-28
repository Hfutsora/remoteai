import { Image, Pressable, Text, View } from 'react-native';
import { useState, type ReactNode } from 'react';
import { initials, type LoungeAccount, type LoungeMessage as Message } from '../../../../shared/lounge/types';
import { getLocale, t } from '../i18n';
import { useLoungeStyles } from './styles';
import { LoungeReplyPreview } from './LoungeReplyPreview';
import { LoungeMessageActions } from './LoungeMessageActions';
import { LoungeImage } from './LoungeImage';
import { LoungeDeliveryStatus } from './LoungeDeliveryStatus';

const MESSAGE_AVATAR_TOUCH_PADDING = 7;

export function LoungeAvatar({ user, small = false, onDirect }: {
  user: LoungeAccount; small?: boolean; onDirect?: () => void;
}) {
  const styles = useLoungeStyles();
  const avatar = user.avatar ? <Image source={{ uri: user.avatar }}
    style={[styles.avatar, small && styles.messageAvatar]} />
    : <View style={[styles.avatar, small && styles.messageAvatar]}>
      <Text style={small ? styles.messageName : styles.initials}>{initials(user.account)}</Text></View>;
  return onDirect ? <Pressable accessibilityRole="button" onPress={onDirect}
    hitSlop={small ? MESSAGE_AVATAR_TOUCH_PADDING : 0}
    accessibilityLabel={t('client.lounge.directWith', { account: user.account })}>{avatar}</Pressable> : avatar;
}

export function LoungeUnread({ count, children }: { count: number; children: ReactNode }) {
  const styles = useLoungeStyles();
  return <View style={styles.badgeWrap}>{children}{count > 0 && <View style={styles.badge}>
    <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
  </View>}</View>;
}

interface Props {
  message: Message; own?: boolean; manage?: (user: LoungeAccount) => void;
  preview: (uri: string) => void; onImageLoad?: () => void;
  reply?: (message: Message) => void;
  direct?: () => void; block?: () => void; blocked?: boolean;
}
export function LoungeMessage({ message, own, manage, preview, onImageLoad, reply, direct, block, blocked }: Props) {
  const styles = useLoungeStyles();
  const [menu, setMenu] = useState(false);
  const openMenu = reply ? () => setMenu(true) : undefined;
  return <View style={[styles.message, own && styles.own]}>
    {!own && <LoungeAvatar user={message.sender} small onDirect={direct} />}
    <View style={[styles.messageMain, own && styles.ownMain]}>
      {!own && (manage ? <Pressable accessibilityRole="button"
        accessibilityLabel={t('client.lounge.manageUser', { account: message.sender.account })}
        onPress={() => manage(message.sender)}>
        <Text style={styles.messageName}>{message.sender.account}</Text>
      </Pressable> : <Text style={styles.messageName}>{message.sender.account}</Text>)}
      <Pressable onLongPress={openMenu} style={[styles.bubble, own && styles.ownBubble,
        !message.text.trim() && !message.reply && styles.imageOnly]}>
        {message.reply && <LoungeReplyPreview reply={message.reply} />}
        {!!message.text && <Text selectable={!reply} onLongPress={openMenu} style={styles.messageText}>{message.text}</Text>}
        {message.images.map((uri, index) => <LoungeImage key={index} uri={uri} preview={preview}
          onLongPress={openMenu} onLoad={onImageLoad} />)}
      </Pressable>
      <Text style={styles.messageTime}>{new Date(message.sentAt).toLocaleTimeString(getLocale(),
        { hour: '2-digit', minute: '2-digit' })}</Text>
      <LoungeDeliveryStatus delivery={message.delivery} />
    </View>
    {menu && reply && <LoungeMessageActions message={message} reply={reply} close={() => setMenu(false)}
      direct={direct} block={block} blocked={blocked} />}
  </View>;
}
