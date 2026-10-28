import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import type { LoungeAccount, LoungeSnapshot } from '../../../../shared/lounge/types';
import { contactStatus } from '../../../../shared/lounge/contacts';
import { t } from '../i18n';
import { LoungeAvatar } from './LoungeMessage';
import { useLoungeStyles } from './styles';

export function LoungePeople({ state, select, block, close }: {
  state: LoungeSnapshot; select: (user?: LoungeAccount) => void;
  block: (user: LoungeAccount) => void; close: () => void;
}) {
  const styles = useLoungeStyles();
  const [query, setQuery] = useState('');
  const [actions, setActions] = useState<LoungeAccount>();
  const contacts = state.contacts.filter(contact => contact.user.id !== state.user?.id
    && contact.user.account.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const choose = (user?: LoungeAccount) => { close(); select(user); };
  return <Modal transparent animationType="fade" onRequestClose={close}>
    <View style={styles.overlay}><View style={styles.dialog}>
      <Text style={styles.title}>{t('client.lounge.people')}</Text>
      {actions ? <>
        <Text style={styles.text}>{actions.account}</Text>
        <Pressable accessibilityRole="button" style={styles.iconButton} onPress={() => choose(actions)}>
          <Text style={styles.link}>{t('client.lounge.directChat')}</Text></Pressable>
        {state.directAvailable && <Pressable accessibilityRole="button" style={styles.iconButton}
          onPress={() => { close(); block(actions); }}>
          <Text style={styles.link}>{t(state.blocked.includes(actions.id)
            ? 'client.lounge.unblockUser' : 'client.lounge.blockUser')}</Text></Pressable>}
        <Pressable accessibilityRole="button" style={styles.iconButton} onPress={() => setActions(undefined)}>
          <Text style={styles.link}>{t('client.lounge.cancel')}</Text></Pressable>
      </> : <>
        <TextInput value={query} onChangeText={setQuery} style={styles.field}
          accessibilityLabel={t('client.lounge.peopleSearch')} placeholder={t('client.lounge.peopleSearch')} />
        <Pressable accessibilityRole="button" style={styles.person} onPress={() => choose()}>
          <Text style={styles.link}>{t('client.lounge.groupChat')}</Text>
          {!!state.unreadByConversation[''] && <Text style={styles.muted}>{state.unreadByConversation['']}</Text>}
        </Pressable>
        <FlatList data={contacts} keyExtractor={item => item.user.id} keyboardShouldPersistTaps="handled"
          style={styles.peopleList} ListEmptyComponent={<Text style={styles.muted}>{t('client.lounge.noPeople')}</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="button"
            accessibilityLabel={t('client.lounge.directWith', { account: item.user.account })} style={styles.person}
            onPress={() => choose(item.user)} onLongPress={() => setActions(item.user)}>
            <LoungeAvatar user={item.user} /><View style={styles.heading}>
              <Text style={styles.text}>{item.user.account}</Text>
              {item.direct && <Text style={styles.muted}>{t(contactStatus(item))}</Text>}
              {state.blocked.includes(item.user.id) && <Text style={styles.muted}>{t('client.lounge.blocked')}</Text>}
            </View>{!!state.unreadByConversation[item.user.id] && <Text style={styles.muted}>
              {state.unreadByConversation[item.user.id]}</Text>}
          </Pressable>} />
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.closePeople')}
        style={styles.iconButton} onPress={close}><Text style={styles.link}>{t('client.lounge.closePeople')}</Text></Pressable>
    </View></View>
  </Modal>;
}
