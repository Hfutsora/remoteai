import { expect, test, type Page } from '@playwright/test';
import type { desktopTest } from './remote-desktop-fixture';

declare global { interface Window { desktopTest: typeof desktopTest } }
const openMenu = (page: Page, name = '工作电脑') => page.getByRole('button', { name: `${name} 的更多操作` }).click();
const changes = (page: Page) => page.evaluate(() => window.desktopTest.privacyChanges);

test('device management turns off and restores screens while keeping remote video usable', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('e2e/remote-desktop-harness.html?device-screen&privacy&security&displays');
  await openMenu(page);
  await page.getByRole('menuitem', { name: '关闭电脑屏幕' }).click();
  await expect(page.getByText('暂时关闭电脑屏幕？')).toBeVisible();
  await expect(page.getByRole('menu')).not.toBeVisible();
  expect(await page.locator('.adm-dialog-body').evaluate(element => element.getBoundingClientRect().width))
    .toBeLessThanOrEqual(400);
  const box = (await page.locator('.adm-dialog-body').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(16);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width - 16);
  await page.screenshot({ path: info.outputPath('screen-confirmation.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(await changes(page)).toEqual([]);
  await openMenu(page);
  await page.getByRole('menuitem', { name: '关闭电脑屏幕' }).click();
  await page.getByRole('button', { name: '关闭电脑屏幕', exact: true }).click();
  await expect.poll(() => changes(page)).toEqual([true]);
  await expect.poll(() => page.locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
  const restore = page.getByRole('button', { name: '恢复电脑屏幕', exact: true });
  await expect(restore).toBeEnabled();
  await restore.click();
  await expect.poll(() => changes(page)).toEqual([true, false]);
  const captureCount = await page.evaluate(() => window.desktopTest.captures);
  await page.locator('#change-project').evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole('dialog', { name: '远程桌面', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.desktopTest.captures)).toBe(captureCount);
  await page.screenshot({ path: info.outputPath('screen-restored.png') });
  await page.getByRole('button', { name: /^(关闭|关闭远程桌面)$/ }).click();
  await page.getByRole('button', { name: '设备管理', exact: true }).click();
  await page.evaluate(() => { window.desktopTest.security.privacyScreen = true; });
  await openMenu(page);
  await page.getByRole('menuitem', { name: '恢复电脑屏幕' }).click();
  await expect.poll(() => changes(page)).toEqual([true, false, false]);
  await expect.poll(() => page.locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('screen actions are disabled offline and hidden for unsupported computers', async ({ page }) => {
  await page.goto('e2e/remote-desktop-harness.html?device-screen&privacy&security');
  await openMenu(page, '离线电脑');
  await expect(page.getByRole('menuitem', { name: '关闭电脑屏幕' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menuitem', { name: '恢复电脑屏幕' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('heading', { name: '设备管理', exact: true }).click();
  await openMenu(page, 'Mac');
  await expect(page.getByRole('menuitem', { name: '关闭电脑屏幕' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '恢复电脑屏幕' })).toHaveCount(0);
  expect(await changes(page)).toEqual([]);
});

test('first-use setup failure leaves the viewer available and allows retry after setup', async ({ page }) => {
  await page.goto('e2e/remote-desktop-harness.html?device-screen&privacy&privacy-install&security');
  await openMenu(page);
  await page.getByRole('menuitem', { name: '关闭电脑屏幕' }).click();
  await page.getByRole('button', { name: '关闭电脑屏幕', exact: true }).click();
  await expect(page.getByText('请在电脑上确认安装，完成后再点一次隐私屏。')).toBeVisible();
  await expect.poll(() => page.locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
  expect(await changes(page)).toEqual([]);
  await page.evaluate(() => { window.desktopTest.privacyInstallationRequired = false; });
  await page.getByRole('button', { name: '关闭电脑屏幕', exact: true }).click();
  await expect.poll(() => changes(page)).toEqual([true]);
  await expect(page.getByRole('button', { name: '恢复电脑屏幕', exact: true })).toBeEnabled();
});
