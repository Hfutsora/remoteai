import { expect, test } from '@playwright/test';

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: conversation context stays visible while running and follows workspace changes`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/e2e/conversation-workspace-harness.html?mode=${mode}`);
    const worktree = page.getByRole('group', { name: '当前工作树', exact: true });
    const branch = page.getByRole('group', { name: '当前分支', exact: true });
    const project = page.getByRole('button', { name: mode === 'local' ? '选择项目文件夹：codex-switch' : '选择远程项目' });
    await expect(project).toBeVisible();
    await expect(project).toBeDisabled();
    await expect(worktree).toHaveText('主工作树');
    await expect(branch).toHaveText('feature/conversation-context');
    await page.getByRole('textbox', { name: 'Draft' }).fill('保留草稿');
    await page.screenshot({ path: `../../.codex-tmp/conversation-workspace-${mode}.png` });
    await page.getByRole('button', { name: 'Change branch', exact: true }).click();
    await expect(branch).toHaveText('feature/updated');
    await page.getByRole('button', { name: 'Finish turn', exact: true }).click();
    await expect(project).toBeEnabled();
    await expect(branch).toBeVisible();
    await page.getByRole('button', { name: 'Switch conversation', exact: true }).click();
    await expect(worktree).toHaveText('工作树：parallel-worktree-with-a-long-name');
    await worktree.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toContainText('F:/projects/worktrees/parallel-worktree-with-a-long-name');
    expect((await tooltip.boundingBox())!.width).toBeLessThanOrEqual(400);
    await page.getByRole('textbox', { name: 'Draft' }).hover();
    await page.setViewportSize({ width: 920, height: 800 });
    await expect(worktree).toBeVisible();
    await expect(branch).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveValue('保留草稿');
    await page.screenshot({ path: `../../.codex-tmp/conversation-workspace-${mode}-narrow.png` });
    await page.getByRole('button', { name: 'Git unavailable', exact: true }).click();
    await expect(branch).toHaveText('暂不可用');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Current branch', exact: true })).toHaveText('Unavailable');
  });
}
