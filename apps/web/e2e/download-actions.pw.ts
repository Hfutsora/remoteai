import { expect, test, type Page } from '@playwright/test';

const card = (page: Page) => page.getByRole('article', { name: 'sample.md', exact: true });
async function enqueue(page: Page) {
  await page.getByRole('button', { name: '当前项目', exact: true }).click();
  await page.getByRole('button', { name: '下载：sample.md', exact: true }).click();
  await page.getByRole('button', { name: '下载列表', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('e2e/downloads-harness.html');
  await page.evaluate(() => { window.downloadFixture.size = 512; window.downloadFixture.delay = 0; });
});

test('automatically retries exactly five times and a manual resume starts a fresh run', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => { window.downloadFixture.openFailures = 6; });
  await enqueue(page);
  for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
    await expect(card(page)).toContainText('正在重试');
    await page.clock.runFor(delay);
    await expect.poll(() => page.evaluate(() => window.downloadFixture.opens)).toBe(index + 2);
  }
  await expect(card(page)).toContainText('下载失败');
  await page.clock.runFor(60_000);
  expect(await page.evaluate(() => window.downloadFixture.opens)).toBe(6);
  await card(page).getByRole('button', { name: '继续下载' }).click();
  await page.clock.runFor(1000);
  await expect(card(page)).toContainText('文件已就绪');
  expect(await page.evaluate(() => window.downloadFixture.opens)).toBe(7);
});

test('opens verified cached text offline without executing HTML and keeps Save available', async ({ page }, info) => {
  const content = '<script>document.body.textContent="unsafe"</script>\nDownloaded document';
  await page.evaluate(content => Object.assign(window.downloadFixture,
    { textContent: content, size: content.length, mimeType: 'text/html' }), content);
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  await page.getByRole('button', { name: '断开电脑', exact: true }).click();
  const opened = page.waitForEvent('popup');
  await card(page).getByRole('button', { name: '打开', exact: true }).click();
  const popup = await opened;
  await expect(popup.locator('body')).toContainText(content);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(card(page).getByRole('button', { name: '保存到设备' })).toBeEnabled();
  expect(await page.evaluate(() => window.downloadFixture.opens)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `../../.codex-tmp/download-actions-${info.project.name}.png` });
  await popup.close();
});

test('a blocked popup leaves the file ready and shows an actionable message', async ({ page }) => {
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  await page.evaluate(() => { window.open = () => null; });
  await card(page).getByRole('button', { name: '打开', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('允许弹出窗口');
  await expect(card(page)).toContainText('文件已就绪');
});

test('missing cached bytes cannot be opened or marked as saved', async ({ page }) => {
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('codex-switch.web.downloads.v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction('chunks', 'readwrite');
      tx.objectStore('chunks').clear();
      tx.oncomplete = () => { request.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await card(page).getByRole('button', { name: '打开', exact: true }).click();
  await expect(card(page)).toContainText('下载失败');
  await expect(card(page).getByRole('button', { name: '打开', exact: true })).toHaveCount(0);
  await expect(card(page)).not.toContainText('已保存到设备');
});

test('selects cards, cancels confirmation and deletes only selected downloads offline', async ({ page }, info) => {
  await page.getByRole('button', { name: '当前项目', exact: true }).click();
  for (const name of ['sample.md', 'sample.bin', 'empty.txt']) {
    await page.getByRole('button', { name: `下载：${name}`, exact: true }).click();
  }
  await page.getByRole('button', { name: '下载列表', exact: true }).click();
  const batch = page.getByRole('button', { name: /^批量删除/ });
  const first = card(page);
  const second = page.getByRole('article', { name: 'sample.bin', exact: true });
  await expect(batch).toBeDisabled();
  await expect(first).toContainText('文件已就绪');
  await first.locator('strong').click();
  await expect(first.getByRole('checkbox')).toBeChecked();
  await first.locator('strong').click();
  await expect(batch).toBeDisabled();
  await first.getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await second.locator('.download-path').click();
  await expect(batch).toHaveText('批量删除（2）');
  await first.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('button', { name: '保留', exact: true }).click();
  await expect(first.getByRole('checkbox')).toBeChecked();
  await batch.click();
  await expect(page.getByText('删除这 2 项下载？')).toBeVisible();
  await page.getByRole('button', { name: '保留', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.getByRole('button', { name: '断开电脑', exact: true }).click();
  await page.screenshot({ path: `../../.codex-tmp/download-selection-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await batch.click();
  await page.getByRole('button', { name: '删除', exact: true }).last().click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(batch).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toHaveAttribute('aria-label', 'empty.txt');
});

test('keeps selection and wraps translated controls when switching languages offline', async ({ page }) => {
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  await card(page).locator('strong').click();
  await page.context().setOffline(true);
  const cases = [
    ['en', 'Delete selected (1)'], ['ru', 'Удалить выбранное (1)'],
    ['ja', '選択した項目を削除（1）'], ['zh', '批量删除（1）'],
  ] as const;
  for (const [language, label] of cases) {
    await page.evaluate(language => window.downloadFixture.setLanguage(language), language);
    await expect(page.getByRole('button', { name: label, exact: true })).toBeEnabled();
    await expect(card(page).getByRole('checkbox')).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
