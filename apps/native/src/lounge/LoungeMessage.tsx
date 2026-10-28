import { Image, Pressable, Text, View } from 'react-native';
import { useState, type ReactNode } from 'react';
import { initials, type LoungeAccount, type LoungeMessage as Message } from '../../../../shared/lounge/types';
import { getLocale, t } from '../i18n';
import { useLoungeStyles } from './styles';
import { LoungeReplyPreview } from './LoungeReplyPreview';
import { LoungeMessageActions } from './LoungeMessageActions';
import { LoungeImage } from './LoungeImage';
import { LoungeDeliveryStatus } from './LoungeDeliveryStatus';

export function LoungeAvatar({ user }: { user: LoungeAccount }) {
  const styles = useLoungeStyles();
  return user.avatar ? <Image source={{ uri: user.avatar }} style={styles.avatar} />
    : <View style={styles.avatar}><Text style={styles.initials}>{initials(user.account)}</Text></View>;
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
    <LoungeAvatar user={message.sender} />
    <View style={[styles.messageMain, own && styles.ownMain]}>
      {manage && !own ? <Pressable accessibilityRole="button"
        accessibilityLabel={t('client.lounge.manageUser', { account: message.sender.account })}
        onPress={() => manage(message.sender)}>
        <Text style={styles.link}>{message.sender.account}</Text>
      </Pressable> : <Text style={styles.muted}>{message.sender.account}</Text>}
      <Text style={styles.muted}>{new Date(message.sentAt).toLocaleString(getLocale(),
        { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
      <Pressable onLongPress={openMenu} style={[styles.bubble, own && styles.ownBubble,
        !message.text.trim() && !message.reply && styles.imageOnly]}>
        {message.reply && <LoungeReplyPreview reply={message.reply} />}
        {!!message.text && <Text selectable={!reply} onLongPress={openMenu} style={styles.text}>{message.text}</Text>}
        {message.images.map((uri, index) => <LoungeImage key={index} uri={uri} preview={preview}
          onLongPress={openMenu} onLoad={onImageLoad} />)}
      </Pressable>
      <LoungeDeliveryStatus delivery={message.delivery} />
    </View>
    {menu && reply && <LoungeMessageActions message={message} reply={reply} close={() => setMenu(false)}
      direct={direct} block={block} blocked={blocked} />}
  </View>;
}
