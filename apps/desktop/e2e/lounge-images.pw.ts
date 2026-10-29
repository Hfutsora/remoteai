import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLoungeAction } from './lounge-mobile-actions';
import { pixel, setupLounge } from './lounge-support';

async function pinchAndPan(page: Page, stage: Locator) {
  await expect(page.locator('.ant-modal')).not.toHaveClass(/ant-zoom/);
  const bounds = (await stage.boundingBox())!;
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const client = await page.context().newCDPSession(page);
  const fingers = (spread: number) => [-1, 1].map((direction, id) => ({ id,
    x: center.x + direction * spread, y: center.y }));
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(30) });
  for (const spread of [40, 50, 60]) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(spread) });
  }
  await expect(page.locator('.lounge-preview-tools')).toContainText('200%');
  const image = stage.locator('img');
  const before = (await image.boundingBox())!;
  // Continue dragging with the remaining finger after a pinch without jumping or dismissing the preview.
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [fingers(60)[1]] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ ...fingers(60)[0], x: center.x - 30, y: center.y + 35 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Math.round((await image.boundingBox())!.x - before.x)).toBe(30);
  await expect.poll(async () => Math.round((await image.boundingBox())!.y - before.y)).toBe(35);
  await expect(stage).toBeVisible();
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(60) });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(30) });
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('.lounge-preview-tools')).toContainText('100%');
  await client.detach();
}

for (const mode of ['local', 'remote', 'web', 'mobile']) {
  test(`${mode}: sent images support pinch, pan, reset and history preview`, async ({ page }) => {
    const mobile = mode === 'mobile';
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const relay = await setupLounge(page, mode === 'web' || mobile);
    await page.goto(mode === 'web' || mobile ? 'http://127.0.0.1:1486/web/' : `/e2e/lounge-harness.html?mode=${mode}`);
    await relay.ready();
    if (mobile) {
      await page.locator('.mobile-tabbar').getByText('发现', { exact: true }).click();
      await page.locator('.discovery-lounge').click();
      await page.getByRole('button', { name: '群聊', exact: true }).click();
    } else await page.getByRole('button', { name: '在线交流', exact: true }).click();
    await page.locator('.lounge-composer input[type=file]').setInputFiles({
      name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(pixel.split(',')[1], 'base64'),
    });
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect.poll(() => relay.sent.length).toBe(1);
    await page.locator('.lounge-message.is-own').getByRole('button', { name: '查看图片' }).click();
    const preview = page.getByRole('dialog', { name: '查看图片' });
    const stage = preview.locator('.lounge-preview-stage');
    await expect(stage.locator('img')).toBeVisible();
    await stage.hover();
    await pinchAndPan(page, stage);
    await preview.getByRole('button', { name: '放大图片', exact: true }).click();
    await expect(preview.locator('.lounge-preview-tools')).toContainText('150%');
    await page.screenshot({ path: test.info().outputPath(`${mode}-image-preview.png`) });
    await preview.getByRole('button', { name: '还原图片', exact: true }).click();
    await expect(preview.locator('.lounge-preview-tools')).toContainText('100%');
    await stage.hover(); await page.mouse.wheel(0, -100);
    await expect(preview.locator('.lounge-preview-tools')).toContainText('120%');
    await page.keyboard.press('Escape'); await expect(preview).toBeHidden();
    await openLoungeAction(page, '历史记录');
    await page.locator('.lounge-history').getByRole('button', { name: '查看图片' }).click();
    await expect(stage).toBeVisible(); await stage.hover();
    await pinchAndPan(page, stage);
    await preview.locator('.ant-modal-close').click();
    await expect(preview).toBeHidden();
    await expect(page.locator('.lounge-history')).toBeVisible();
  });
}
