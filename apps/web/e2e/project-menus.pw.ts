import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, mode: string) {
  const calls: { operation: string; cwd?: string; pinned?: boolean; threadId?: string; name?: string }[] = [];
  const threads = [{ id: 'one', name: '项目对话', cwd: '/project', preview: '', updatedAt: 1 },
    { id: 'two', name: '其他项目对话', cwd: '/other', preview: '', updatedAt: 2 }];
  let revision = 0;
  let pinnedProjects: string[] = [];
  let pins: string[] = [];
  const sidebar = () => ({ revision: ++revision, pinnedProjects, pins, readState: {},
    threads: Object.fromEntries(threads.map(thread => [thread.id,
      { cwd: thread.cwd, projectName: thread.cwd.split('/').at(-1), title: thread.name, running: false }])) });
  await page.route('**/thread-action', async route => {
    const input = route.request().postDataJSON() as typeof calls[number]; calls.push(input);
    if (input.operation === 'list') return route.fulfill({ json: { data: threads, nextCursor: null, sidebar: sidebar() } });
    if (input.operation === 'guiProjectPin') pinnedProjects = input.pinned ? [input.cwd!] : [];
    if (input.operation === 'guiProjectRemove') {
      pinnedProjects = [];
      threads.forEach(thread => { if (thread.cwd === input.cwd) thread.cwd = ''; });
    }
    if (input.operation === 'threadPin') pins = input.pinned ? [input.threadId!] : [];
    if (input.operation === 'forkLatest') {
      const fork = { ...threads[0], id: 'fork', name: '新的分支' }; threads.push(fork);
      return route.fulfill({ json: { thread: fork } });
    }
    return route.fulfill({ json: sidebar() });
  });
  await page.goto(`./e2e/thread-actions-harness.html?sidebar=${mode}`);
  await expect(page.getByRole('button', { name: '项目对话', exact: true })).toBeVisible();
  return calls;
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode} project and thread context menus match and preserve conversations`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop sidebar menus');
    const calls = await setup(page, mode);
    const project = page.locator('section[aria-label="project"]');
    const heading = project.locator('button[aria-expanded]').first();
    await heading.click({ button: 'right' });
    await expect(page.getByRole('menuitem')).toHaveText(['置顶', '移除项目']);
    await expect(heading).toHaveAttribute('aria-expanded', 'true');
    expect((await page.getByRole('menu').boundingBox())!.width).toBeLessThanOrEqual(400);
    await page.screenshot({ path: `../../.codex-tmp/project-menu-${mode}.png` });
    await page.getByRole('menuitem', { name: '置顶', exact: true }).click();
    await expect(project.getByLabel('已置顶', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '管理项目：project', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '取消置顶', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: '取消置顶', exact: true }).click();
    await expect(project.getByLabel('已置顶', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '项目对话', exact: true }).click({ button: 'right' });
    await expect(page.getByRole('menuitem')).toHaveText(['置顶', '重命名', '创建分支', '归档', '删除']);
    await expect(page.getByTestId('selected')).toHaveText('none');
    await page.screenshot({ path: `../../.codex-tmp/thread-menu-${mode}.png` });
    await page.keyboard.press('Escape');
    await heading.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: '移除项目', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: '移除项目', exact: true }).click();
    await expect(project).toHaveCount(0);
    await expect(page.locator('section[aria-label="最近"]').getByRole('button', { name: '项目对话' })).toBeVisible();
    await expect(page.getByRole('button', { name: '其他项目对话', exact: true })).toBeVisible();
    expect(calls.some(call => call.operation === 'delete')).toBe(false);
    if (mode !== 'local') expect(calls.filter(call => call.operation === 'guiProjectRemove'))
      .toEqual([{ operation: 'guiProjectRemove', cwd: '/project' }]);
  });
}

for (const mode of ['remote', 'web']) {
  test(`${mode} pins a thread and branches the clicked conversation without preselecting`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop sidebar menus');
    const calls = await setup(page, mode);
    const row = page.getByRole('button', { name: '项目对话', exact: true });
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: '置顶', exact: true }).click();
    await row.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: '取消置顶', exact: true })).toBeVisible();
    await expect(page.getByTestId('selected')).toHaveText('none');
    await page.getByRole('menuitem', { name: '创建分支', exact: true }).click();
    await expect(page.getByTestId('selected')).toHaveText('fork');
    expect(calls.filter(call => call.operation === 'forkLatest'))
      .toEqual([{ operation: 'forkLatest', threadId: 'one' }]);
    expect(calls.filter(call => call.operation === 'threadPin'))
      .toEqual([{ operation: 'threadPin', threadId: 'one', pinned: true }]);
  });
}
