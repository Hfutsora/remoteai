import { expect, type Page } from '@playwright/test';

/** Mobile keeps secondary actions in the compact composer menu. */
export async function openLoungeAction(page: Page, name: string) {
  if (await page.locator('.lounge-mobile').count()) {
    await page.getByRole('button', { name: '添加内容', exact: true }).click();
  }
  await page.getByRole('button', { name, exact: true }).click();
}

export async function expectLoungeAction(page: Page, name: string) {
  const mobile = await page.locator('.lounge-mobile').count();
  if (mobile) await page.getByRole('button', { name: '添加内容', exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  if (mobile) await page.locator('.ant-drawer-close:visible').click();
}
