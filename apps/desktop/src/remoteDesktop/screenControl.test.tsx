// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDeviceScreenRequest } from '../../../../shared/remote-desktop/screenControl';
import { useDesktopLauncher } from '../../../../shared/remote-desktop/useDesktopLauncher';

let root: Root;
let screen: ReturnType<typeof useDeviceScreenRequest>;
let launcher: ReturnType<typeof useDesktopLauncher>;
const device = { deviceId: 'chosen-pc', platform: 'Windows', online: true };
function Harness({ scope = 'account-a', active = true, connected = false }) {
  screen = useDeviceScreenRequest(scope);
  launcher = useDesktopLauncher({ active, connected,
    screenRequest: screen.request, screenRequestHandled: screen.handled });
  return null;
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

it('waits for the chosen computer connection before consuming an explicit screen target', async () => {
  await act(async () => { screen.open(device, false); });
  expect(screen.request).toMatchObject({ deviceId: device.deviceId, enabled: false });
  expect(launcher.opened).toBe(false);
  await act(async () => root.render(<Harness connected active={false} />));
  expect(screen.request).toBeDefined(); expect(launcher.opened).toBe(false);
  await act(async () => root.render(<Harness connected />));
  expect(launcher.opened).toBe(true);
  expect(launcher.privacyRequest).toMatchObject({ deviceId: device.deviceId, enabled: false });
  expect(screen.request).toBeUndefined();
  await act(async () => launcher.close());
  await act(async () => root.render(<Harness connected />));
  expect(launcher.opened).toBe(false);
});

it('discards pending operations when signing out or changing accounts, including signing back in', async () => {
  await act(async () => { screen.open(device, true); });
  await act(async () => root.render(<Harness scope="account-b" connected />));
  expect(screen.request).toBeUndefined(); expect(launcher.opened).toBe(false);
  await act(async () => root.render(<Harness connected />));
  expect(screen.request).toBeUndefined(); expect(launcher.opened).toBe(false);
});

it('rejects unsupported and offline devices and accepts a new target for an existing viewer', async () => {
  await act(async () => {
    expect(screen.open({ ...device, online: false }, true)).toBe(false);
    expect(screen.open({ ...device, platform: 'macOS' }, true)).toBe(false);
    expect(screen.open(device, true)).toBe(true);
  });
  await act(async () => root.render(<Harness connected />));
  const first = launcher.privacyRequest!;
  await act(async () => { launcher.setMinimized(true); screen.open(device, false); });
  expect(launcher.opened).toBe(true); expect(launcher.minimized).toBe(false);
  expect(launcher.privacyRequest).toMatchObject({ deviceId: device.deviceId, enabled: false });
  expect(launcher.privacyRequest!.id).toBeGreaterThan(first.id);
});
