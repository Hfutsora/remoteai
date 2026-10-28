import { Image, Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { initials, type LoungeAccount, type LoungeMessage as Message } from '../../../../shared/lounge/types';
import { getLocale, t } from '../i18n';
import { useLoungeStyles } from './styles';

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
}
export function LoungeMessage({ message, own, manage, preview, onImageLoad }: Props) {
  const styles = useLoungeStyles();
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
      <View style={[styles.bubble, own && styles.ownBubble]}>
        {!!message.text && <Text selectable style={styles.text}>{message.text}</Text>}
        {message.images.map((uri, index) => <Pressable key={index} accessibilityRole="button"
          accessibilityLabel={t('client.lounge.previewImage')} onPress={() => preview(uri)}>
          <Image source={{ uri }} resizeMode="contain" style={styles.image} onLoad={onImageLoad} />
        </Pressable>)}
      </View>
    </View>
  </View>;
}
