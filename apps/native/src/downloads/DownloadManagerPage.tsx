import { displayError } from '../i18n/index';
import { t, useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { BackHandler, FlatList, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import type { AuthSession } from '../types';
import { DownloadBrowser } from './DownloadBrowser';
import { DownloadCard } from './DownloadCard';
import { DownloadEmptyState } from './DownloadEmptyState';
import { DownloadPageHeader } from './DownloadPageHeader';
import { DownloadSources } from './DownloadSources';
import { useDownloadTasks } from './useDownloadTasks';
import { useStyles } from './styles';

export function DownloadManagerPage({ session, onBack }: { session: AuthSession; onBack: () => void }) {
  const styles = useStyles();
  useLanguage();
  const state = useDownloadTasks(session);
  const [view, setView] = useState<'tasks' | 'project' | 'computer'>('tasks');
  const { tasks, connection, busy, deleting, error, run, setDeleting } = state;
  const browsing = view !== 'tasks' && !!connection;
  useEffect(() => {
    if (browsing) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => subscription.remove();
  }, [browsing, onBack]);

  if (view !== 'tasks' && connection) return <DownloadBrowser
    key={`${connection.deviceId}:${view}:${connection.threadId ?? connection.cwd ?? ''}`}
    connection={connection} scope={view} back={() => setView('tasks')} />;

  return <View style={styles.page}>
    <DownloadPageHeader title={t("client.downloads.downloads")} back={onBack} backLabel={t("client.discovery.back")} />
    <FlatList data={tasks} keyExtractor={task => task.id} style={styles.list}
      contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
      ListHeaderComponent={<>
        <DownloadSources connection={connection} browse={setView} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{displayError(error)}</Text>}
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t("client.downloads.downloads.ea215a")}</Text>
          <Text style={styles.count}>{tasks.length}{' '}{t("client.mobile.items")}</Text>
        </View>
      </>}
      renderItem={({ item }) => <DownloadCard task={item} busy={busy === item.id}
        connected={!!connection?.ready && connection.deviceId === item.source.deviceId}
        action={() => { void run(item, 'action'); }} share={() => { void run(item, 'share'); }}
        remove={() => setDeleting(item)} />}
      ListEmptyComponent={<DownloadEmptyState />} />
    <BottomSheet visible={!!deleting} title={t("client.mobile.deleteDownload")} dismissible={!busy}
      onClose={() => { if (!busy) setDeleting(undefined); }} actions={[
        { label: t("client.downloads.keep"), disabled: !!busy, onPress: () => setDeleting(undefined) },
        { label: t("client.projectBrowser.deleted"), tone: 'danger', disabled: !!busy,
          onPress: () => { if (deleting) void run(deleting, 'delete'); } },
      ]}>
      <Text style={styles.text}>{t("client.mobile.deletesThePhoneSFileAndDownloadRecordTheOriginal")}</Text>
      {!!error && <Text style={styles.error}>{displayError(error)}</Text>}
    </BottomSheet>
  </View>;
}
