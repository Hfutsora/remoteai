import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { chromium, expect } from "@playwright/test";

const base = new URL("../apps/desktop/src-tauri/src/dream_skin_native/", import.meta.url);
const read = name => readFile(new URL(name, base), "utf8");
const [registry, identity, metrics, overlay, css] = await Promise.all([
  read("native_registry_reader.js"), read("context_usage_reader.js"),
  readFile(new URL("../shared/context-usage/metrics.js", import.meta.url), "utf8"),
  read("usage_statusline.js"), read("usage_statusline.css"),
]);
const script = `(() => { ${registry}\n${identity}\n${metrics.replaceAll("export ", "")}\n`
  + `${overlay.replace("__USAGE_STATUSLINE_CSS__", JSON.stringify(css))} })()`;
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function setup(page, dark) {
  await page.setContent(`<style>
    body { margin:24px; font:14px system-ui; background:${dark ? "#171819" : "#fff"};
      color:${dark ? "#eee" : "#222"}; --text-primary:${dark ? "#eee" : "#222"};
      --text-secondary:${dark ? "#c4c4c7" : "#5d5d62"};
      --text-tertiary:${dark ? "#a8aaaf" : "#6b7279"}; }
    [data-codex-composer-root] { max-width:780px; margin:auto; }
    [data-composer-surface-variant] { padding:16px; border:1px solid ${dark ? "#46474a" : "#d8dade"};
      border-radius:22px; background:${dark ? "#303134" : "#f5f6f8"}; }
    [contenteditable] { min-height:50px; opacity:.6; outline:none; }
    #toolbar { display:flex; justify-content:space-between; align-items:center; color:var(--text-primary); }
    .csw-context-button svg { width:16px; height:16px; color:var(--text-tertiary); fill:none;
      stroke:currentColor; stroke-width:2; stroke-linecap:butt; }
  </style><main data-codex-composer-root data-composer-placement="thread">
    <div data-above-composer-conversation-id="local:fixture"></div>
    <div data-composer-surface-variant="default"><div contenteditable="true">与 Codex 协作</div>
    <div id="toolbar"><span>＋</span><span class="csw-context-button"><svg viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6" opacity=".2"/><circle cx="8" cy="8" r="6" pathLength="100"
    stroke-dasharray="29.1 100" transform="rotate(-90 8 8)"/></svg></span>
    <span>GPT-6.1-Sol　 ▴</span></div></div></main>`);
  await page.evaluate(() => {
    window.fixtureNow = 1000;
    Date.now = () => window.fixtureNow;
    window.fixtureConversation = { resumeState: "resumed", threadRuntimeStatus: { type: "active" },
      latestTokenUsageInfo: { total: { outputTokens: 100, inputTokens: 1000, cachedInputTokens: 999 },
        last: { inputTokens: 1000, cachedInputTokens: 999, totalTokens: 1900 }, modelContextWindow: 10000 } };
    const manager = { getConversation: id => id === "local:fixture" ? window.fixtureConversation : null };
    const registry = { getImplForHostId: () => manager, addRegistryCallback() {} };
    window.__codexRoot = { _internalRoot: { current: { memoizedProps: { value: registry } } } };
    window.__CODEX_SWITCH_COMPOSER_STATUS_ALLOWED__ = true;
    window.__CODEX_SWITCH_SPEED_SELECTOR__ = { installed: true, language: "zh", usage: { enabled: true } };
    window.codexSwitchRequestConversationMetrics = payload => {
      const request = JSON.parse(payload);
      window.__CODEX_SWITCH_USAGE_STATUSLINE__.receiveTiming(request.conversationId, request.requestId,
        { totalOutputTokens: 102, totalOutputTimeMs: 2000, outputRequestCount: 1 });
    };
  });
  await page.evaluate(script);
  await expect(page.locator("[data-codex-switch-usage-statusline]")).toContainText("99.9%");
  await page.evaluate(async () => {
    window.fixtureNow = 3000;
    window.fixtureConversation.latestTokenUsageInfo.total.outputTokens = 202;
    await window.__CODEX_SWITCH_USAGE_STATUSLINE__.refresh();
  });
}

for (const dark of [false, true]) {
  test(`statusline follows the composer and fits a narrow ${dark ? "dark" : "light"} window`, async () => {
    const page = await browser.newPage({ viewport: { width: 860, height: 210 }, deviceScaleFactor: 2 });
    try {
      await setup(page, dark);
      const bar = page.getByRole("status", { name: "会话用量统计" });
      await expect(bar).toHaveText("51.0 tok/s缓存命中 99.9%19.0%");
      const card = await page.locator("[data-composer-surface-variant]").boundingBox();
      const box = await bar.boundingBox();
      assert.ok(box.y >= card.y + card.height, "bar must be outside and below the input card");
      const appearance = await bar.evaluate(element => {
        const style = getComputedStyle(element);
        const modelStyle = getComputedStyle(document.querySelector("#toolbar > span:last-child"));
        const iconStyle = getComputedStyle(element.querySelector("svg"));
        const ringStyle = getComputedStyle(element.querySelector('[data-usage-metric="2"] svg'));
        const upperRing = getComputedStyle(document.querySelector(".csw-context-button svg"));
        const ringAppearance = value => [value.width, value.height, value.color, value.strokeWidth, value.strokeLinecap];
        return { color: style.color, modelColor: modelStyle.color, font: style.fontSize,
          iconWidth: iconStyle.width, iconHeight: iconStyle.height,
          ring: ringAppearance(ringStyle), upperRing: ringAppearance(upperRing) };
      });
      assert.equal(appearance.color, dark ? "rgb(196, 196, 199)" : "rgb(93, 93, 98)");
      assert.notEqual(appearance.color, appearance.modelColor, "statistics use the softer secondary text color");
      assert.equal(appearance.font, "13px");
      assert.equal(appearance.iconWidth, "14px");
      assert.equal(appearance.iconHeight, "14px");
      assert.equal(appearance.ring[0], "14px");
      assert.equal(appearance.ring[1], "14px");
      assert.equal(appearance.ring[2], appearance.upperRing[2], "keep the upper ring's color");
      assert.equal(appearance.ring[3], "1.4px");
      await page.evaluate(async () => {
        window.fixtureConversation.latestTokenUsageInfo.last.totalTokens = 2910;
        await window.__CODEX_SWITCH_USAGE_STATUSLINE__.refresh();
      });
      await expect(bar).toHaveText("51.0 tok/s缓存命中 99.9%29.1%");
      await expect(bar.locator("[data-context-progress]")).toHaveAttribute("stroke-dasharray", "29.1 100");
      if (dark && process.env.CODEX_USAGE_STATUSLINE_SCREENSHOT) {
        await page.screenshot({ path: process.env.CODEX_USAGE_STATUSLINE_SCREENSHOT });
      }
      if (!dark && process.env.CODEX_USAGE_STATUSLINE_LIGHT_SCREENSHOT) {
        await page.screenshot({ path: process.env.CODEX_USAGE_STATUSLINE_LIGHT_SCREENSHOT });
      }
      await page.setViewportSize({ width: 350, height: 260 });
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      assert.equal(fits, true);
      await page.evaluate(() => { window.__CODEX_SWITCH_COMPOSER_STATUS_ALLOWED__ = false; });
      await expect(bar).toBeHidden();
    } finally { await page.close(); }
  });
}
