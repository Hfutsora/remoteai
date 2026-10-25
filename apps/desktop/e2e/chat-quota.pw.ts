import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`PC and Web quota rows wrap independently at ${width}px`, async ({ page }) => {
    let requests = 0;
    const releases: (() => void)[] = [];
    await page.route('**/__codex_switch__/api/invoke', async route => {
      const { command } = route.request().postDataJSON() as { command: string };
      if (command === 'codex_gui_usage_summary' && ++requests > 3) {
        await new Promise<void>(resolve => releases.push(resolve));
      }
      await route.fulfill({ json: { ok: true, result: { totalTokens: 417630000, estimatedCostUsd: 614.85,
        primaryRemainingPercent: 20, primaryRemainingAggregated: false, providerEstimatedCost: null,
        estimatedQuota: { remainingUsd: 25, capacityUsd: 125 } } } });
    });
    await page.setViewportSize({ width, height: 900 });
    try {
      await page.goto('/e2e/chat-quota-harness.html', { waitUntil: 'domcontentloaded' });
      for (const name of ['local', 'remote', 'settings']) {
        const section = page.getByTestId(name);
        const quota = section.locator('[class*="quotaLine"], .chat-usage-quota-line');
        await expect(quota).toHaveText(/20% · 25(?:\.00)?\s?USD 剩余额度 · 125(?:\.00)?\s?USD 总额度/);
        const cost = section.getByText(/614\.85/);
        const costBox = (await cost.boundingBox())!;
        const quotaBox = (await quota.boundingBox())!;
        expect(quotaBox.y).toBeGreaterThanOrEqual(costBox.y + costBox.height);
        expect(quotaBox.x + quotaBox.width).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `../../.codex-tmp/chat-quota-${width}.png` });
      await page.getByTestId('remote').getByText('· 25USD 剩余额度 · 125USD 总额度').hover();
      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible();
      expect((await tooltip.boundingBox())!.width).toBeLessThanOrEqual(400);
      for (const [language, text] of [['en', 'total quota'], ['ru', 'общий лимит'], ['ja', '利用枠合計']]) {
        await page.getByLabel('Language').selectOption(language);
        for (const name of ['local', 'remote', 'settings']) {
          await expect(page.getByTestId(name)).toContainText(text);
        }
      }
      await expect.poll(() => requests, { timeout: 10_000 }).toBeGreaterThan(3);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByTestId('local')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
    } finally { releases.forEach(release => release()); }
  });
}
