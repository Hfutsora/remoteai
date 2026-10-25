import { displayText } from '../i18n/index';
import { displayError } from '../i18n/index';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { textMetrics } from '../theme/text';
import { t, useLanguage } from '../i18n';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useChatUsage } from '../../../../shared/remote-chat/client/useChatUsage';
import { formatCost, formatThreadTokens, formatTokens, usageTrailing,
  type ReadUsage } from '../../../../shared/remote-chat/usage';
import { palette } from './styles';
import { contextUsageLabel } from '../../../../shared/remote-chat/contextUsage';
import type { ThreadTokenUsage } from './types';
import { formatConversationCost, type ReadConversationMetrics } from '../../../../shared/remote-chat/conversationMetrics';
import { useConversationMetrics } from '../../../../shared/remote-chat/client/useConversationMetrics';
import { ConversationPerformanceValues } from './ConversationPerformance';
import { ChatQuotaProgress } from './ChatQuotaProgress';

export function ChatUsage({ read, active, ready, tokenUsage, onContextSettings, readConversationMetrics, threadId }: {
  read: ReadUsage; active: boolean; ready: boolean; tokenUsage?: ThreadTokenUsage;
  readConversationMetrics: ReadConversationMetrics; threadId: string | null;
  onContextSettings?: () => void;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  const language = useLanguage();
  const { usage, error } = useChatUsage(read, active && ready);
  const metrics = useConversationMetrics(readConversationMetrics, threadId, active && ready);
  const trailing = usageTrailing(usage, displayText, formatCost, { compactQuota: true });
  const notice = ready ? (error ? displayError(error) : t("client.chat.loadingTodaySUsage")) : t("client.chat.connectToViewTodaySUsage");
  return <View style={styles.container}>
    <View style={styles.context}>
      <Text style={[styles.row, styles.contextText]}>{contextUsageLabel(tokenUsage, language)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.setContextCapacityForThisChat")}
        accessibilityState={{ disabled: !onContextSettings }} disabled={!onContextSettings}
        style={({ pressed }) => [styles.settings, pressed && styles.pressed, !onContextSettings && styles.disabled]}
        onPress={onContextSettings}>
        <Feather name="settings" size={16} color={color(palette.muted, 'muted')} />
      </Pressable>
    </View>
    {trailing && <ChatQuotaProgress trailing={trailing} remaining={usage?.primaryRemainingPercent ?? 0} />}
    <Text style={styles.row}>{t("client.shared.currentChat")}{' '}
      <Text style={styles.tokens}>{formatThreadTokens(tokenUsage?.total.totalTokens)} Token</Text>
      {' · '}<Text style={styles.cost}>{formatConversationCost(metrics)}</Text>
    </Text>
    {usage ? <Text style={styles.row} accessibilityLabel={[
      t("client.mobile.todaySTokenUsage", { value1: usage.totalTokens.toLocaleString('en-US') }),
      t("client.mobile.todaySEstimatedCost", { value1: formatCost(usage.estimatedCostUsd) }),
    ].filter(Boolean).join('，')}>
      {t("client.chat.today")}{' '}<Text style={styles.tokens}>{formatTokens(usage.totalTokens)} Token</Text>
      {t("client.mobile.estimated")}<Text style={styles.cost}>{formatCost(usage.estimatedCostUsd)}</Text>
    </Text> : <Text style={styles.row}>{notice}</Text>}
    <Text style={styles.row}><ConversationPerformanceValues metrics={metrics} /></Text>
  </View>;
}

const useStyles = createThemedStyles((color) => ({
  context: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contextText: { flex: 1 },
  settings: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  pressed: { backgroundColor: color(palette.pale, 'accentSoft') },
  disabled: { opacity: 0.4 },
  container: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color(palette.border, 'border'), paddingTop: 14, gap: 4 },
  row: { color: color(palette.muted, 'muted'), ...textMetrics(12, 20), flexShrink: 1 },
  tokens: { color: color(palette.green, 'accent'), fontWeight: '600' },
  cost: { color: color('#b45d00', 'warning'), fontWeight: '600' },
}));
