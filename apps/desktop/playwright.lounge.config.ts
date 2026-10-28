import { defineConfig } from '@playwright/test';
import { testBrowserLaunchOptions } from '../../scripts/test-browser.mjs';

export default defineConfig({
  testDir: './e2e', testMatch: ['lounge.pw.ts', 'lounge-replies.pw.ts', 'lounge-direct.pw.ts', 'lounge-receipts.pw.ts',
    'lounge-mobile-redesign.pw.ts', 'lounge-opening-limit.pw.ts', 'lounge-avatars.pw.ts'],
  workers: 1, timeout: 60_000,
  outputDir: '../../.codex-tmp/lounge-playwright',
  use: { baseURL: 'http://127.0.0.1:1487', launchOptions: testBrowserLaunchOptions(),
    viewport: { width: 1440, height: 900 }, locale: 'zh-CN', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npx vite --host 127.0.0.1 --port 1487 --strictPort', url: 'http://127.0.0.1:1487',
      reuseExistingServer: !process.env.CI },
    { command: 'npx vite --host 127.0.0.1 --port 1486 --strictPort', cwd: '../web',
      url: 'http://127.0.0.1:1486/web/', reuseExistingServer: !process.env.CI },
  ],
});
