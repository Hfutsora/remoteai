import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoungeHistory } from '../../../../shared/lounge/useLoungeHistory';
import type { LoungeController } from '../../../../shared/lounge/controller';
import { t } from '../i18n';
import { useThemeColor } from '../theme/store';
import { LoungeMessage } from './LoungeMessage';
import { LoungePreview } from './LoungeDialogs';
import { useLoungeStyles } from './styles';

export function LoungeHistory({ controller, close }: { controller: LoungeController; close: () => void }) {
  const styles = useLoungeStyles();
  const color = useThemeColor();
  const history = useLoungeHistory(controller, true);
  const [preview, setPreview] = useState<string>();
  return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={styles.page}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" style={styles.iconButton} onPress={close}>
        <Text style={styles.link}>{t('client.lounge.backToChat')}</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>{t('client.lounge.history')}</Text>
    </View>
    <View style={styles.composer}>
      <TextInput value={history.query} onChangeText={history.setQuery} style={styles.field}
        accessibilityLabel={t('client.lounge.searchHistory')} placeholder={t('client.lounge.searchHistory')}
        placeholderTextColor={color('#838892', 'muted')} />
      <Text style={styles.muted}>{t('client.lounge.historyHint')}</Text>
      <Text style={styles.muted}>{history.loading ? t('client.lounge.historyLoading')
        : t('client.lounge.historyCount', { count: history.messages.length })}</Text>
      {history.error && <View><Text style={styles.muted}>{t('client.lounge.historyLoadFailed')}</Text>
        <Pressable accessibilityRole="button" onPress={history.retry} style={styles.iconButton}>
          <Text style={styles.link}>{t('client.lounge.historyRetry')}</Text></Pressable></View>}
    </View>
    <FlatList data={history.messages} keyExtractor={item => `${item.sender.id}:${item.id}`}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled" renderItem={({ item }) => <LoungeMessage message={item} preview={setPreview} />}
      ListEmptyComponent={!history.loading && !history.error ? <Text style={styles.muted}>{t(history.query.trim()
        ? 'client.lounge.historyNoResults' : 'client.lounge.historyEmpty')}</Text> : null} />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" disabled={history.loading || !history.hasPrevious}
        accessibilityState={{ disabled: history.loading || !history.hasPrevious }}
        onPress={history.previous} style={styles.iconButton}>
        <Text style={history.hasPrevious ? styles.link : styles.muted}>{t('client.lounge.historyPrevious')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={history.loading || !history.hasNext}
        accessibilityState={{ disabled: history.loading || !history.hasNext }}
        onPress={history.next} style={styles.iconButton}>
        <Text style={history.hasNext ? styles.link : styles.muted}>{t('client.lounge.historyNext')}</Text>
      </Pressable>
    </View>
    {preview && <LoungePreview uri={preview} close={() => setPreview(undefined)} />}
  </SafeAreaView></Modal>;
}
