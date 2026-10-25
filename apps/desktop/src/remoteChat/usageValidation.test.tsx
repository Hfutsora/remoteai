// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatUsage as NativeChatUsage } from '../../../native/src/chat/ChatUsage';
import { ChatUsage as WebChatUsage } from '../../../web/src/chat/ChatUsage';
import { USAGE_REFRESH_INTERVAL_MS, type ReadUsage } from '../../../../shared/remote-chat/usage';

vi.mock('../../../native/node_modules/react-native/index.js', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children, accessibilityLabel }: { children: ReactNode; accessibilityLabel?: string }) =>
    <span aria-label={accessibilityLabel}>{children}</span>,
  Pressable: ({ children, onPress }: { children: ReactNode; onPress?: () => void }) =>
    <button onClick={onPress}>{children}</button>,
  Platform: { OS: 'android' },
  StyleSheet: { hairlineWidth: 1 },
}));
vi.mock('../../../native/node_modules/@expo/vector-icons/Feather.js', () => ({ default: () => null }));
vi.mock('../../../native/src/theme/styles', () => ({ createThemedStyles: () => () => ({}) }));
vi.mock('../../../native/src/theme/store', () => ({ useThemeColor: () => (value: string) => value }));
vi.mock('../../../native/src/i18n', async () => ({
  ...await vi.importActual<typeof import('../../../native/src/i18n')>('../../../native/src/i18n'),
  useLanguage: () => 'zh',
}));
vi.mock('../../../native/src/chat/styles', () => ({ palette: {} }));
vi.mock('../../../native/src/chat/ConversationPerformance', () => ({ ConversationPerformance: () => null }));

const usage = { totalTokens: 1_520, estimatedCostUsd: 2.5, primaryRemainingPercent: null,
  primaryRemainingAggregated: false, providerEstimatedCost: null };
const views = [
  { name: 'native settings', render: (read: ReadUsage) => <NativeChatUsage read={read} active ready threadId={null}
    readConversationMetrics={vi.fn()} /> },
  { name: 'web mobile settings', render: (read: ReadUsage) => <WebChatUsage read={read} active ready /> },
  { name: 'web and desktop remote composer', render: (read: ReadUsage) =>
    <WebChatUsage read={read} active ready inline /> },
];
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers(); vi.unstubAllGlobals();
});

it.each(views)('$name survives missing totals and recovers on the next refresh', async ({ render }) => {
  const read = vi.fn().mockResolvedValueOnce({}).mockResolvedValue(usage);
  await act(async () => root.render(render(read)));
  expect(container.textContent).not.toContain('NaN');
  expect(container.textContent).not.toContain('0USD');
  expect(container.textContent).not.toContain('1.5K');
  expect(container.childElementCount).toBeGreaterThan(0);
  await act(async () => vi.advanceTimersByTimeAsync(USAGE_REFRESH_INTERVAL_MS));
  expect(container.textContent).toContain('1.5K');
  expect(container.textContent).toContain('2.5USD');
  expect(read).toHaveBeenCalledTimes(2);
});

it.each(views)('$name ignores malformed optional API estimates', async ({ render }) => {
  const read = vi.fn().mockResolvedValue({ ...usage, providerEstimatedCost: {} });
  await act(async () => root.render(render(read)));
  expect(container.textContent).toContain('1.5K');
  expect(container.textContent).toContain('2.5USD');
  expect(container.textContent).not.toContain('API');
});

it('preserves the native accessibility summary for valid usage', async () => {
  await act(async () => root.render(views[0].render(vi.fn().mockResolvedValue(usage))));
  expect(container.querySelector('[aria-label*="1,520"]')?.getAttribute('aria-label')).toContain('2.5USD');
});

it.each(views)('$name separates quota from today’s usage and displays the PC estimates', async ({ render }) => {
  const read = vi.fn().mockResolvedValue({ ...usage, primaryRemainingPercent: 20,
    estimatedQuota: { remainingUsd: 25, capacityUsd: 125 } });
  await act(async () => root.render(render(read)));
  expect(container.textContent).toContain('20% · 25USD 剩余额度 · 125USD 总额度');
  expect(container.textContent).toContain('2.5USD');
  read.mockResolvedValue({ ...usage, primaryRemainingPercent: 20 });
  await act(async () => vi.advanceTimersByTimeAsync(USAGE_REFRESH_INTERVAL_MS));
  expect(container.textContent).toContain('20% · — 剩余额度 · — 总额度');
  expect(container.textContent).not.toContain('25USD');
});
