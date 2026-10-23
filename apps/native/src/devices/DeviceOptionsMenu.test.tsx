import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Pressable } from 'react-native';
import { DeviceOptionsMenu } from './DeviceOptionsMenu';
import type { RemoteDevice } from '../types';

const runtime = vi.hoisted(() => ({ confirming: false }));
vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'),
  useState: () => [runtime.confirming, (value: boolean) => { runtime.confirming = value; }],
  useEffect: vi.fn(), useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Platform: { OS: 'android' },
  ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: <T,>(value: T) => value, absoluteFill: {} } }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

interface Props { children?: ReactNode; disabled?: boolean; onPress?: () => void; style?: { maxWidth?: number } }
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap(child => isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children)] : []);
}
function button(tree: ReactNode, label: string) {
  return nodes(tree).find(node => node.type === Pressable
    && nodes(node.props.children).some(child => child.props.children === label));
}
const device: RemoteDevice = { deviceId: 'pc', name: '工作电脑', platform: 'Windows', online: true,
  capabilities: [], localProxyRunning: false, lastSeenAt: '2026-10-23T00:00:00Z' };
const props = { device, deletingDeviceId: null, switchingAuthDeviceId: null,
  onClose: vi.fn(), onDelete: vi.fn(), onRevokeService: vi.fn(), onSelectAuthAccount: vi.fn(), onScreenControl: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); runtime.confirming = false; vi.stubGlobal('React', React); });

it('confirms screen shutdown in a compact panel and sends an explicit target for the chosen computer', () => {
  const menu = DeviceOptionsMenu(props);
  button(menu, '关闭电脑屏幕')!.props.onPress!();
  expect(runtime.confirming).toBe(true);
  expect(props.onScreenControl).not.toHaveBeenCalled();
  const confirmation = DeviceOptionsMenu(props);
  expect(nodes(confirmation).some(node => node.props.style?.maxWidth === 400)).toBe(true);
  expect(nodes(confirmation).some(node => node.props.children === '暂时关闭电脑屏幕？')).toBe(true);
  button(confirmation, '取消')!.props.onPress!();
  expect(runtime.confirming).toBe(false);
  expect(props.onScreenControl).not.toHaveBeenCalled();
  runtime.confirming = true;
  button(DeviceOptionsMenu(props), '关闭电脑屏幕')!.props.onPress!();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.onScreenControl).toHaveBeenCalledExactlyOnceWith(device, true);
});

it('restores screens without a shutdown confirmation', () => {
  button(DeviceOptionsMenu(props), '恢复电脑屏幕')!.props.onPress!();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.onScreenControl).toHaveBeenCalledExactlyOnceWith(device, false);
});

it('disables both actions offline and hides them on unsupported platforms', () => {
  const offline = DeviceOptionsMenu({ ...props, device: { ...device, online: false } });
  expect(button(offline, '关闭电脑屏幕')!.props.disabled).toBe(true);
  expect(button(offline, '恢复电脑屏幕')!.props.disabled).toBe(true);
  for (const platform of ['macOS', 'linux']) {
    const menu = DeviceOptionsMenu({ ...props, device: { ...device, platform } });
    expect(button(menu, '关闭电脑屏幕')).toBeUndefined();
    expect(button(menu, '恢复电脑屏幕')).toBeUndefined();
  }
});
