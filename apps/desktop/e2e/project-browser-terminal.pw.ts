import { expect, test, type Page } from '@playwright/test';

async function openTerminal(page: Page, entry: string) {
  await page.getByRole('treeitem', { name: entry, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: '打开位置', exact: true }).hover();
  await page.getByRole('menuitem', { name: '终端', exact: true }).click();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: file browser adds and selects bottom terminal tabs in the chosen directory`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 960 });
    if (mode === 'local') await page.addInitScript(() => Object.assign(window, { __TAURI_INTERNALS__: {} }));
    await page.goto(`/e2e/project-browser-terminal-harness.html?mode=${mode}`);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    const panel = page.getByRole('region', { name: '终端', exact: true });
    await openTerminal(page, 'src');
    await expect(panel.locator('.xterm:visible')).toContainText('PS C:/project/src>');
    const tabs = panel.getByRole('tab');
    await expect(tabs).toHaveCount(1);
    const firstId = await tabs.first().getAttribute('id');
    await openTerminal(page, 'src');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.first()).toHaveAttribute('id', firstId!);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'false');
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await panel.getByRole('button', { name: '收起终端', exact: true }).click();
    await expect(panel).toBeHidden();
    await openTerminal(page, 'README.md');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.last()).toHaveText('C:/project');
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('body')).toHaveAttribute('data-terminal-opens', '3');
    await expect(panel.locator('.xterm:visible')).toContainText('PS C:/project>');
    const bounds = (await panel.boundingBox())!;
    expect(Math.round(bounds.y + bounds.height)).toBe(960);
    expect(bounds.height).toBeGreaterThan(200);
    expect(await page.getByRole('tab', { name: '文件浏览', exact: true }).isVisible()).toBe(true);
    await page.screenshot({ path: info.outputPath(`file-browser-terminal-${mode}.png`) });
    expect(errors).toEqual([]);
  });
}
