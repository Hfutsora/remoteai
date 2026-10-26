// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { petDockApi } from '../../api/petDock';
import { translate } from '../../i18n';
import { PetDockSettingsCard } from './PetDockSettingsCard';
import type { PetDockStatus } from '../../../../../shared/pet-dock/types';

vi.mock('../../api/petDock', () => ({ petDockApi: { load: vi.fn(), save: vi.fn() } }));
let root: Root;
let container: HTMLDivElement;
const checked = () => container.querySelector('[role="switch"]')?.getAttribute('aria-checked');
const t = (key: Parameters<typeof translate>[1]) => translate('zh', key);
const click = () => act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(petDockApi.load).mockReset().mockResolvedValue({ enabled: false, state: 'disabled' });
  vi.mocked(petDockApi.save).mockReset().mockResolvedValue({ enabled: true, state: 'waitingForCodex' });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shows the saved preference, enables it, and displays the actual connection state', async () => {
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  expect(checked()).toBe('false');
  await click();
  expect(petDockApi.save).toHaveBeenCalledWith(true);
  expect(checked()).toBe('true');
  expect(container.textContent).toContain(t('settings.petDock.waitingForCodex'));
});

it('keeps the previous setting and offers retry if saving fails', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: true, state: 'active' });
  vi.mocked(petDockApi.save).mockRejectedValue(new Error('service unavailable'));
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  await click();
  expect(petDockApi.save).toHaveBeenCalledWith(false);
  expect(checked()).toBe('true');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(t('settings.petDock.saveError'));
});

it('does not overlap status polling, and stops polling after unmount', async () => {
  let resolve!: (status: PetDockStatus) => void;
  vi.mocked(petDockApi.load).mockImplementation(() => new Promise((done) => { resolve = done; }));
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(petDockApi.load).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ enabled: true, state: 'active' }));
  await act(async () => root.render(null));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(petDockApi.load).toHaveBeenCalledTimes(1);
});

it('honors a switch click during polling and ignores the earlier status response', async () => {
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  let resolve!: (status: PetDockStatus) => void;
  vi.mocked(petDockApi.load).mockImplementation(() => new Promise((done) => { resolve = done; }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });
  await click();
  expect(checked()).toBe('true');
  await act(async () => resolve({ enabled: false, state: 'disabled' }));
  expect(checked()).toBe('true');
});

it('shows platform limits and disables the switch on unsupported hosts', async () => {
  vi.mocked(petDockApi.load).mockResolvedValue({ enabled: false, state: 'unsupported' });
  await act(async () => root.render(<PetDockSettingsCard t={t} />));
  expect(container.querySelector<HTMLButtonElement>('[role="switch"]')?.disabled).toBe(true);
  expect(container.textContent).toContain(t('settings.petDock.unsupported'));
});
