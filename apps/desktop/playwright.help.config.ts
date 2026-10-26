import { defineConfig } from '@playwright/test';

const port = process.env.HELP_TEST_PORT ?? '1509';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e', testMatch: '**/help-*.pw.ts', workers: 1, timeout: 45_000,
  outputDir: '../../.codex-tmp/help-playwright',
  use: { baseURL, channel: process.env.CHAT_TEST_BROWSER ?? 'msedge',
    locale: 'zh-CN', headless: true, screenshot: 'only-on-failure' },
  projects: [
    { name: 'hosted' },
    { name: 'desktop', testMatch: '**/help-position.pw.ts' },
  ],
  webServer: { command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL, reuseExistingServer: !process.env.CI },
});
