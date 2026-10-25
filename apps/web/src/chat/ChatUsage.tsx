import { displayError, displayText } from '../i18n/index';
import { t, useLanguage } from '../i18n';
import { useEffect, useState, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { Tooltip } from 'antd';
import { useChatUsage } from '../../../../shared/remote-chat/client/useChatUsage';
import { formatCost, formatThreadTokens, formatTokens, usageTrailing,
  type ReadUsage } from '../../../../shared/remote-chat/usage';
import './chatUsage.css';
import { contextUsageLabel } from './formatters';
import type { ThreadTokenUsage } from './types';
import type { ReadConversationMetrics } from '../../../../shared/remote-chat/conversationMetrics';
import { ConversationPerformance } from './ConversationPerformance';
import { QuotaProgress } from '../../../../shared/chat/QuotaProgress';

export function ChatUsage({ read, active, ready, tokenUsage, onContextSettings, inline = false, contextControl,
  quotaProgress = false,
  readConversationMetrics, threadId }: {
  read: ReadUsage; active: boolean; ready: boolean; tokenUsage?: ThreadTokenUsage;
  onContextSettings?: () => void; inline?: boolean; contextControl?: ReactNode;
  quotaProgress?: boolean;
  readConversationMetrics?: ReadConversationMetrics; threadId?: string | null;
}) {
  useLanguage();
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const { usage, error } = useChatUsage(read, active && ready && visible);
  const trailing = usageTrailing(usage, displayText, formatCost, { compactQuota: quotaProgress && !inline });
  const notice = ready ? (error ? displayError(error) : t("client.chat.loadingTodaySUsage")) : t("client.chat.connectToViewTodaySUsage");
  if (inline) return <InlineUsage usage={usage} notice={notice} contextControl={contextControl} />;
  return <div className="chat-usage" role="group" aria-label={t("client.chat.todaySUsage")}>
    <span className="chat-usage-context chat-row"><span className="chat-grow">{contextUsageLabel(tokenUsage)}</span>
      {onContextSettings && <button type="button" className="chat-back" aria-label={t("client.chat.conversationContext")}
        disabled={!ready || !active} onClick={onContextSettings}><Settings size={18} /></button>}</span>
    {usage ? <>
      <span>{t("client.chat.today")} <strong className="chat-usage-tokens">{formatTokens(usage.totalTokens)} Token</strong></span>
      <span>{t("client.chat.estimated")} <strong className="chat-usage-cost">{formatCost(usage.estimatedCostUsd)}</strong></span>
      {trailing && <QuotaLine trailing={trailing}
        remaining={quotaProgress ? usage.primaryRemainingPercent ?? undefined : undefined} />}
    </> : <span>{notice}</span>}
    <span className="chat-usage-thread">{t("client.shared.currentChat")}{' '}
      <strong className="chat-usage-tokens">{formatThreadTokens(tokenUsage?.total.totalTokens)} Token</strong>
      {readConversationMetrics && <> · <ConversationPerformance read={readConversationMetrics} threadId={threadId ?? null}
        active={active && ready && visible} /></>}
    </span>
  </div>;
}

const USAGE_TOOLTIP_STYLES = { root: { maxWidth: 400 }, body: { fontSize: 12, overflowWrap: 'anywhere' } } as const;

function QuotaLine({ trailing, remaining }: {
  trailing: NonNullable<ReturnType<typeof usageTrailing>>; remaining?: number;
}) {
  const content = <>
    <Tooltip title={trailing.description} styles={USAGE_TOOLTIP_STYLES}>
      <strong className={`chat-usage-${trailing.tone}`} tabIndex={0}>{trailing.text}</strong>
    </Tooltip>
    {trailing.quota && <Tooltip title={trailing.quota.description} styles={USAGE_TOOLTIP_STYLES}>
      <span tabIndex={0}> · {trailing.quota.remaining} · {trailing.quota.total}</span>
    </Tooltip>}
  </>;
  return <span className="chat-usage-quota-line">{remaining === undefined ? content
    : <QuotaProgress trailing={trailing} remaining={remaining}>{content}</QuotaProgress>}</span>;
}

function InlineUsage({ usage, notice, contextControl }: {
  usage: ReturnType<typeof useChatUsage>['usage']; notice: string; contextControl?: ReactNode;
}) {
  const trailing = usageTrailing(usage, displayText);
  return <div className="chat-composer-usage" role="group" aria-label={t("client.chat.todaySUsage")}>
    {contextControl}
    <span>{t("client.chat.today")}</span>
    <Tooltip title={usage ? `${usage.totalTokens.toLocaleString()} Token` : notice} styles={USAGE_TOOLTIP_STYLES}>
      <strong className="chat-usage-tokens" tabIndex={0}>{usage ? formatTokens(usage.totalTokens) : '—'}</strong>
    </Tooltip>
    <span>·</span>
    <Tooltip title={usage ? t("client.chat.estimatedCost") : notice} styles={USAGE_TOOLTIP_STYLES}>
      <strong className="chat-usage-cost" tabIndex={0}>{usage ? formatCost(usage.estimatedCostUsd) : '—'}</strong>
    </Tooltip>
    {trailing && <QuotaLine trailing={trailing} />}
  </div>;
}
