import { expect, test } from '@playwright/test';
import { pixel, setupLounge } from './lounge-support';
import type {} from './lounge-harness';
import type {} from './lounge-admin-harness';

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: background connection, unread badge, mixed content and recovery`, async ({ page }) => {
    const relay = await setupLounge(page, mode === 'web');
    await page.goto(mode === 'web' ? 'http://127.0.0.1:1486/web/' : `/e2e/lounge-harness.html?mode=${mode}`);
    await relay.ready();
    relay.push('先收到的消息');
    await expect(page.locator('.lounge-nav-badge')).toHaveText('1');
    const menu = page.getByRole('button', { name: '闲聊摸鱼', exact: true });
    const downloads = page.getByRole('button', { name: '下载管理', exact: true }).first();
    const menuBox = await menu.boundingBox();
    const downloadBox = await downloads.boundingBox();
    expect(menuBox!.y).toBeLessThan(downloadBox!.y);
    await page.bringToFront(); await menu.click();
    await expect(page.getByText('先收到的消息')).toBeVisible();
    await expect(page.locator('.lounge-nav-badge')).toHaveCount(0);
    relay.push('今天也要记得休息 ☕', [pixel]);
    await expect(page.locator('.lounge-message')).toHaveCount(2);
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    await input.fill('文字和图片一起发送 ');
    await page.locator('.lounge-composer input[type=file]').setInputFiles({ name: 'picture.png', mimeType: 'image/png',
      buffer: Buffer.from(pixel.split(',')[1], 'base64') });
    await expect(page.locator('.lounge-attachments img')).toHaveCount(1);
    await page.getByRole('button', { name: '表情', exact: true }).click();
    await page.getByRole('button', { name: '😀', exact: true }).click();
    await expect(page.locator('.lounge-emoji-picker')).toBeHidden();
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(input).toHaveValue('');
    expect(relay.sent[0].images).toHaveLength(1);
    expect(relay.sent[0].text).toContain('😀');
    expect(relay.sent[0].text).toContain('文字和图片一起发送');
    await expect(page.locator('.lounge-message.is-own')).toHaveCount(1);
    await expect(page.locator('.lounge-avatar').last()).toHaveText('AL');
    await page.screenshot({ path: `../../.codex-tmp/lounge-${mode}.png` });
    await relay.close();
    await expect.poll(relay.count).toBe(2);
    relay.push('重新连接后收到的新消息');
    await expect(page.getByText('重新连接后收到的新消息')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('compresses photos larger than 1 MB before sending, and switches offline translations in dark mode', async ({ page }) => {
  const relay = await setupLounge(page);
  await page.goto('/e2e/lounge-harness.html?dark'); await relay.ready();
  await page.getByRole('button', { name: '闲聊摸鱼', exact: true }).click();
  const data = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1200;
    const context = canvas.getContext('2d')!;
    const pixels = context.createImageData(1200, 1200);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = Math.random() * 255; pixels.data[i + 1] = Math.random() * 255;
      pixels.data[i + 2] = Math.random() * 255; pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0); return canvas.toDataURL('image/png').split(',')[1];
  });
  const original = Buffer.from(data, 'base64'); expect(original.byteLength).toBeGreaterThan(1024 * 1024);
  await page.locator('input[type=file]').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: original });
  await expect(page.locator('.lounge-attachments img')).toHaveCount(1);
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect.poll(() => relay.sent.length).toBe(1);
  expect(Buffer.from(relay.sent[0].images[0].split(',')[1], 'base64').byteLength).toBeLessThanOrEqual(1024 * 1024);
  await page.context().setOffline(true);
  for (const language of ['en', 'ja', 'ru', 'zh'] as const) {
    await page.evaluate(value => window.loungeFixture.setLanguage(value), language);
    await expect(page.locator('.lounge-heading')).not.toContainText('client.lounge');
    await page.screenshot({ path: `../../.codex-tmp/lounge-dark-${language}.png` });
  }
});

test('moderators can mute and unmute an account; mute updates disable sending without adding unread messages',
  async ({ page }) => {
    const relay = await setupLounge(page);
    await page.goto('/e2e/lounge-harness.html'); await relay.ready();
    relay.policy(true);
    relay.push('可以管理这位用户');
    await page.getByRole('button', { name: '闲聊摸鱼', exact: true }).click();
    await page.getByRole('button', { name: '管理 bob@example.test 的发言权限' }).click();
    await page.getByRole('spinbutton', { name: '禁言时长（分钟）' }).fill('30');
    await page.getByRole('button', { name: /^禁\s*言$/ }).click();
    await expect.poll(() => relay.moderation).toEqual([{ type: 'moderate', id: expect.any(String),
      userId: 'bob', minutes: 30 }]);
    await page.getByRole('button', { name: '管理 bob@example.test 的发言权限' }).click();
    await page.getByRole('button', { name: '解除禁言' }).click();
    await expect.poll(() => relay.moderation.length).toBe(2);
    expect(relay.moderation[1].minutes).toBe(0);
    await page.getByRole('textbox', { name: '消息', exact: true }).fill('保留草稿');
    relay.policy(false, new Date(Date.now() + 60_000).toISOString());
    await expect(page.getByText(/^禁言至 /)).toBeVisible();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    await expect(page.locator('.lounge-nav-badge')).toHaveCount(0);
    relay.policy(false);
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    await expect(page.getByRole('textbox', { name: '消息', exact: true })).toHaveValue('保留草稿');
  });

test('admin user settings grant lounge moderation and save an explicit mute duration', async ({ page }) => {
  await page.goto('/e2e/lounge-admin-harness.html');
  await page.getByRole('switch', { name: '闲聊管理员' }).click();
  await page.getByRole('spinbutton', { name: '禁言时长（分钟）' }).fill('120');
  await page.screenshot({ path: '../../.codex-tmp/lounge-admin.png' });
  await page.getByRole('button', { name: /^保\s*存$/ }).click();
  await expect.poll(() => page.evaluate(() => window.loungeAdminFixture.writes))
    .toEqual([{ moderator: true, minutes: 120 }]);
});
