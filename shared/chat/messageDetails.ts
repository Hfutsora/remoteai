import type { Item, Turn } from '../remote-chat/client/types';
import { changedFiles, parseDiff } from './diff';
import { visibleUserContent } from './conversationContext';

const LABELS: Record<string, string> = {
  userMessage: "client.shared.message", agentMessage: "client.shared.reply", commandExecution: "client.chat.runCommand", fileChange: "client.shared.fileChanges",
  reasoning: "client.shared.reasoning", webSearch: "client.shared.searchTheWeb", mcpToolCall: "client.shared.useTool", dynamicToolCall: "client.shared.useTool",
  functionCallOutput: "client.shared.toolOutput", collabAgentToolCall: "client.chat.collaboration", collabToolCall: "client.chat.collaboration", plan: "client.shared.plan",
  imageView: "client.shared.viewImage", imageGeneration: "client.shared.generateImage", sleep: "client.shared.wait", contextCompaction: "client.shared.compactConversation",
  enteredReviewMode: "client.shared.startCodeReview", exitedReviewMode: "client.shared.codeReviewResults", hookPrompt: "client.shared.taskDetails",
};
export const messageLabel = (item: Item) => LABELS[item.type] ?? "client.shared.taskActivity";

export function messageContent(item: Item) {
  if (item.type === 'userMessage') {
    return visibleUserContent(item.text ? [item.text] : item.content)
      .filter(part => part.type === 'text').map(part => part.text ?? '').filter(Boolean).join('\n');
  }
  return item.text || (item.content ?? [])
    .map((entry) => typeof entry === 'string' ? entry : entry.text ?? '').filter(Boolean).join('\n');
}

export interface DetailSection { title: string; text: string }
function format(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/** Keep independent tool fields visible; output must not hide errors, arguments or reasoning. */
export function messageSections(item: Item): DetailSection[] {
  const sections: DetailSection[] = [];
  const add = (title: string, value: unknown) => {
    const text = format(value);
    if (text && !sections.some((section) => section.text === text)) sections.push({ title, text });
  };
  add('命令', item.command);
  add('工作目录', item.cwd);
  add('摘要', item.summary?.join('\n'));
  add('内容', messageContent(item));
  add('输出', item.aggregatedOutput);
  add('参数', item.arguments);
  add('输出', item.output);
  add('结果', item.result);
  add('内容', item.contentItems);
  add('进度', item.progress?.join('\n'));
  add('搜索', item.action ?? item.query);
  add('搜索结果', item.results);
  add('任务', item.prompt);
  add('任务状态', item.agentsStates ?? item.agentStatus);
  add('评审', item.review);
  add('错误', item.error ?? item.failure?.message);
  if (item.exitCode != null) add('退出码', String(item.exitCode));
  return sections;
}

export function turnFiles(turn: Turn) {
  if (turn.diff?.trim()) return parseDiff(turn.diff);
  return changedFiles(turn.items.flatMap((item) => item.changes ?? []));
}
