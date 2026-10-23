import { useState } from 'react';
import { DeviceManagementList } from '../src/devices/DeviceManagementList';
import { ChatTools } from '../src/chat/ChatTools';
import { GuiRemoteDesktop } from '../../desktop/src/pages/codexGui/GuiRemoteDesktop';
import { useDeviceScreenRequest } from '../../../shared/remote-desktop/screenControl';
import { useDesktopLayout } from '../src/useDesktopLayout';
import { client } from './remote-desktop-fixture';
import type { RemoteDevice } from '../src/types';

const devices: RemoteDevice[] = [
  { deviceId: 'computer', name: '工作电脑', platform: 'Windows', online: true },
  { deviceId: 'offline', name: '离线电脑', platform: 'Windows', online: false },
  { deviceId: 'mac', name: 'Mac', platform: 'macOS', online: true },
].map(device => ({ ...device, capabilities: [], localProxyRunning: false, lastSeenAt: '2026-10-23T00:00:00Z' }));

export function DeviceScreenHarness() {
  const [active, setActive] = useState(false);
  const [cwd, setCwd] = useState('C:/workspace');
  const screen = useDeviceScreenRequest('fixture');
  const desktop = useDesktopLayout();
  return <main>
    <button onClick={() => setActive(false)}>设备管理</button>
    <button id="change-project" onClick={() => setCwd('C:/another')}>切换项目</button>
    {!active && <DeviceManagementList devices={devices} accounts={[]} providers={[]} refreshing={false}
      deletingDeviceId={null} switchingModelDeviceId={null} switchingAuthDeviceId={null}
      onRefresh={async () => {}} onSwitchModel={() => {}} onSelectAuthAccount={() => {}}
      onDelete={() => {}} onRevokeService={() => {}} onScreenControl={(device, enabled) => {
        if (screen.open(device, enabled)) setActive(true);
      }} />}
    <ChatTools client={client} active={active} connected cwd={cwd}
      screenRequest={!desktop ? screen.request : undefined} screenRequestHandled={screen.handled}
      desktopActions={<GuiRemoteDesktop client={client.desktop} active={active} connected
        screenRequest={desktop ? screen.request : undefined} screenRequestHandled={screen.handled} />} />
  </main>;
}
