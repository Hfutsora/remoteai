import { expect, test, type Page } from '@playwright/test';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';

const saved: SshProfile = { id: 'saved', name: 'Desktop server', host: 'saved.test', port: 22,
  username: 'user', auth: 'password', fingerprint: 'SHA256:fixture', revision: 1 };
const profiles: SshProfile[] = [saved, { ...saved, id: 'password', name: 'Password server', host: 'password.test' },
  { ...saved, id: 'key', name: 'Key server', auth: 'key' }];
const connectButton = (page: Page) => page.getByRole('button', { name: /^连\s*接$/ });
async function choose(page: Page, name: string) {
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

for (const scenario of ['local', 'remote', 'web', 'web-phone']) {
  test(`${scenario}: saved entries connect while management remains an explicit action`, async ({ page }, info) => {
    const writes: unknown[] = [];
    await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
      if (route.request().url().endsWith('/credentials')) {
        const credentials = route.request().url().includes('/saved/') ? { password: 'saved-password' } : null;
        await route.fulfill({ json: { credentials } }); return;
      }
      if (route.request().method() === 'PUT') writes.push(route.request().postDataJSON());
      await route.fulfill({ json: profiles });
    });
    const mode = scenario === 'web-phone' ? 'web' : scenario;
    await page.setViewportSize({ width: scenario === 'web-phone' ? 390 : 1440, height: 844 });
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    await expect(page.getByRole('tab')).toHaveCount(1);
    const tabs = await page.getByRole('tab').count();
    await choose(page, 'Desktop server');
    await expect(page.getByRole('tab')).toHaveCount(tabs + 1);
    await expect(page.getByLabel('IP 或主机名')).toHaveCount(0);
    await expect(page.locator('.ssh-quick-connect')).toHaveCount(0);
    expect(writes).toHaveLength(0);
    await choose(page, 'Password server');
    await expect(page.getByLabel('密码', { exact: true })).toBeVisible();
    await expect(page.getByLabel('IP 或主机名')).toHaveCount(0);
    await expect(page.getByLabel('连接名称（可选）')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${scenario}-login.png`), animations: 'disabled' });
    for (const [language, label] of [['English', 'Connect'], ['Русский', 'Подключиться'],
      ['日本語', /^接\s*続$/], ['中文', /^连\s*接$/]] as const) {
      await page.getByRole('button', { name: language, exact: true }).evaluate(element => element.click());
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await page.getByLabel('密码', { exact: true }).fill('fixture-password');
    await connectButton(page).click();
    await expect(page.getByRole('tab')).toHaveCount(tabs + 2);
    await choose(page, 'Key server');
    await expect(page.getByLabel('私钥', { exact: true })).toBeVisible();
    await expect(connectButton(page)).toBeDisabled();
    await page.screenshot({ path: info.outputPath(`${scenario}-key.png`), animations: 'disabled' });
    await page.getByRole('button', { name: /^取\s*消$/ }).click();
    await choose(page, '管理 SSH 连接');
    await page.getByRole('button', { name: /Desktop server/ }).click();
    await expect(page.getByLabel('IP 或主机名')).toHaveValue('saved.test');
    expect(writes).toEqual([expect.objectContaining({ id: 'password',
      credentials: { password: 'fixture-password' } })]);
  });
}
