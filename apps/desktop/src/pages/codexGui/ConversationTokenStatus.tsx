import { Tooltip } from 'antd';
import { useMemo } from 'react';
import { CONVERSATION_TSR_DESCRIPTION, formatConversationTsr, summarizeCommands, type CommandMetricTurn }
  from '../../../../../shared/remote-chat/commandMetrics';
import { loadConversationMetrics } from '../../api/conversationMetrics';
import { uiText } from "../../i18n/uiText";
import { useConversationMetrics } from '../../../../../shared/remote-chat/client/useConversationMetrics';
import { CONVERSATION_TPS_DESCRIPTION, CONVERSATION_TTFT_DESCRIPTION, formatConversationTps, formatConversationTtft }
  from '../../../../../shared/remote-chat/conversationMetrics';
import { formatConversationTokens } from '../../../../../shared/remote-chat/usage';
import styles from './ConversationTokenStatus.module.less';

export function ConversationTokenStatus({ threadId, tokens, active, turns }: {
  threadId: string | null; tokens: number; active: boolean; turns?: readonly CommandMetricTurn[];
}) {
  const metrics = useConversationMetrics(loadConversationMetrics, threadId, active);
  const commands = useMemo(() => turns ? summarizeCommands(turns) : null, [turns]);
  const success = `${formatConversationTsr(active ? commands : null)} TSR`;
  const speed = `${formatConversationTps(metrics)} TPS`;
  const firstToken = `${formatConversationTtft(metrics)} TTFT`;
  if (!threadId) return null;
  return <span className={styles.status}>
    <Tooltip title={uiText(CONVERSATION_TSR_DESCRIPTION)}
      styles={{ root: { maxWidth: 'min(400px, calc(100vw - 16px))' } }}>
      <span aria-label={uiText('client.chat.commandSuccessRateValue', { value: success })}>{success}</span>
    </Tooltip>
    <span aria-hidden="true"> · </span>
    <Tooltip title={uiText(CONVERSATION_TPS_DESCRIPTION)} styles={{ root: { maxWidth: 400 } }}>
      <span aria-label={`${uiText("client.mobile.conversationOutputSpeed")} ${speed}`}>{speed}</span>
    </Tooltip>
    <span aria-hidden="true"> · </span>
    <Tooltip title={uiText(CONVERSATION_TTFT_DESCRIPTION)} styles={{ root: { maxWidth: 400 } }}>
      <span aria-label={`${uiText("client.mobile.timeToFirstToken")} ${firstToken}`}>{firstToken}</span>
    </Tooltip>
    {tokens > 0 && <>
      <span aria-hidden="true"> · </span>
      <span>{formatConversationTokens(tokens)} tokens</span>
    </>}
  </span>;
}
