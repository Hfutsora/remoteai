import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchLoungeHistory } from '../../../../shared/lounge/history';
import type { LoungeMessage as Message } from '../../../../shared/lounge/types';
import { t } from '../i18n';
import { useThemeColor } from '../theme/store';
import { LoungeMessage } from './LoungeMessage';
import { LoungePreview } from './LoungeDialogs';
import { useLoungeStyles } from './styles';

export function LoungeHistory({ messages, close }: { messages: Message[]; close: () => void }) {
  const styles = useLoungeStyles();
  const color = useThemeColor();
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<string>();
  const results = useMemo(() => searchLoungeHistory(messages, query), [messages, query]);
  return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={styles.page}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" style={styles.iconButton} onPress={close}>
        <Text style={styles.link}>{t('client.lounge.backToChat')}</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>{t('client.lounge.history')}</Text>
    </View>
    <View style={styles.composer}>
      <TextInput value={query} onChangeText={setQuery} style={styles.field}
        accessibilityLabel={t('client.lounge.searchHistory')} placeholder={t('client.lounge.searchHistory')}
        placeholderTextColor={color('#838892', 'muted')} />
      <Text style={styles.muted}>{t('client.lounge.historyHint')}</Text>
      <Text style={styles.muted}>{t('client.lounge.historyCount', { count: results.length })}</Text>
    </View>
    <FlatList data={results} keyExtractor={item => `${item.sender.id}:${item.id}`} contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled" renderItem={({ item }) => <LoungeMessage message={item} preview={setPreview} />}
      ListEmptyComponent={<Text style={styles.muted}>{t(query.trim()
        ? 'client.lounge.historyNoResults' : 'client.lounge.historyEmpty')}</Text>} />
    {preview && <LoungePreview uri={preview} close={() => setPreview(undefined)} />}
  </SafeAreaView></Modal>;
}
