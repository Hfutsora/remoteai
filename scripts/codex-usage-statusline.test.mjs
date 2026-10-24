import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";

const base = new URL("../apps/desktop/src-tauri/src/dream_skin_native/", import.meta.url);
const read = name => readFileSync(new URL(name, base), "utf8");
const metrics = readFileSync(new URL("../shared/context-usage/metrics.js", import.meta.url), "utf8");
const expression = [read("native_registry_reader.js"), read("context_usage_reader.js"),
  metrics.replaceAll("export ", ""), read("usage_statusline.js")
    .replace("__USAGE_STATUSLINE_CSS__", JSON.stringify(read("usage_statusline.css")))].join("\n");
const drain = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function setup(autoRespond = true) {
  const dom = new JSDOM(`<div data-codex-composer-root data-composer-placement="thread">
    <div data-above-composer-conversation-id="one"></div><section>
    <div data-composer-surface-variant="default"><div contenteditable="true"></div></div></section></div>`);
  const { window } = dom;
  const document = window.document;
  Object.defineProperty(document, "hidden", { value: false });
  window.HTMLElement.prototype.getClientRects = () => [{}];
  const conversations = new Map(["one", "two"].map(id => [id, {
    resumeState: "resumed", threadRuntimeStatus: { type: "active" },
    latestTokenUsageInfo: { total: { outputTokens: 100, inputTokens: 1000, cachedInputTokens: 999 },
      last: { inputTokens: 1000, cachedInputTokens: 999, totalTokens: 1900 }, modelContextWindow: 10000 },
  }]));
  const manager = { getConversation: id => conversations.get(id), requestClient: { sendRequest() {
    throw new Error("The usage statusline must never send an app-server request");
  } } };
  const registry = { getImplForHostId: host => host === "local" ? manager : null, addRegistryCallback() {} };
  window.__codexRoot = { _internalRoot: { current: { memoizedProps: { value: registry } } } };
  window.__CODEX_SWITCH_COMPOSER_STATUS_ALLOWED__ = true;
  window.__CODEX_SWITCH_SPEED_SELECTOR__ = { installed: true, language: "zh", usage: { enabled: true } };
  const timing = { totalOutputTokens: 102, totalOutputTimeMs: 2000, outputRequestCount: 1 };
  const requests = [];
  const respond = (request, value = timing) => window.__CODEX_SWITCH_USAGE_STATUSLINE__
    .receiveTiming(request.conversationId, request.requestId, value);
  window.codexSwitchRequestConversationMetrics = payload => {
    const request = JSON.parse(payload); requests.push(request);
    if (autoRespond) respond(request);
  };
  let now = 1000;
  const timers = new Set();
  const context = { window, document, Element: window.Element, Date: { now: () => now }, setTimeout,
    setInterval(fn) { timers.add(fn); return fn; }, clearInterval(fn) { timers.delete(fn); } };
  const run = () => runInNewContext(`(() => { ${expression} })()`, context);
  run();
  return { window, document, conversations, timers, run, requests, respond, timing,
    setNow(value) { now = value; }, refresh: () => window.__CODEX_SWITCH_USAGE_STATUSLINE__.refresh() };
}

test("mounts below the active input and reuses proxy timings without app-server requests", async () => {
  const h = setup(); await drain();
  const bar = h.document.querySelector("[data-codex-switch-usage-statusline]");
  assert.equal(bar.previousElementSibling.getAttribute("data-composer-surface-variant"), "default");
  assert.equal(bar.textContent, "51.0 tok/s缓存命中 99.9%19.0%");
  assert.equal(h.requests.length, 1);
  h.conversations.get("one").latestTokenUsageInfo.total.outputTokens = 202;
  h.setNow(3000); await h.refresh();
  assert.equal(bar.textContent, "51.0 tok/s缓存命中 99.9%19.0%");
  assert.equal(h.requests.length, 2);
  h.run(); await drain();
  assert.equal(h.document.querySelectorAll("[data-codex-switch-usage-statusline]").length, 1);
  assert.equal(h.timers.size, 1, "reinjection reuses one timer");
  h.window.__CODEX_SWITCH_USAGE_STATUSLINE__.dispose();
  assert.equal(h.timers.size, 0);
});

test("switches identities, clears drafts, follows language and hides with the original toggle", async () => {
  const h = setup(); await drain();
  const bar = h.document.querySelector("[data-codex-switch-usage-statusline]");
  h.document.querySelector("[data-above-composer-conversation-id]")
    .setAttribute("data-above-composer-conversation-id", "two");
  h.conversations.get("two").latestTokenUsageInfo.total.cachedInputTokens = 500;
  await h.refresh(); assert.match(bar.textContent, /50.0%/);
  h.window.__CODEX_SWITCH_SPEED_SELECTOR__.language = "en";
  await h.refresh(); assert.match(bar.textContent, /Cache hit/);
  h.document.querySelector("[data-codex-composer-root]").setAttribute("data-composer-placement", "home");
  await h.refresh(); assert.equal(bar.textContent, "— tok/sCache hit ——");
  h.window.__CODEX_SWITCH_SPEED_SELECTOR__.usage.enabled = false;
  await h.refresh(); assert.equal(bar.hidden, true);
  h.window.__CODEX_SWITCH_USAGE_STATUSLINE__.dispose();
  assert.equal(h.document.querySelector("[data-codex-switch-usage-statusline]"), null);
});

test("ambiguous editor identities and missing registries cannot leak another conversation", async () => {
  const h = setup(); await drain();
  delete h.window.__codexRoot;
  h.document.querySelector("[data-above-composer-conversation-id]").remove();
  await h.refresh();
  const bar = h.document.querySelector("[data-codex-switch-usage-statusline]");
  assert.equal(bar.textContent, "— tok/s缓存命中 ——");
  h.window.__CODEX_SWITCH_USAGE_STATUSLINE__.dispose();
});

test("context ring follows the displayed percentage instead of remaining full", async () => {
  const h = setup(); await drain();
  const bar = h.document.querySelector("[data-codex-switch-usage-statusline]");
  const progress = bar.querySelector("[data-context-progress]");
  const usage = h.conversations.get("one").latestTokenUsageInfo;
  for (const [used, label, arc] of [[0, "0.0%", "0"], [2910, "29.1%", "29.1"], [10000, "100.0%", "100"]]) {
    usage.last.totalTokens = used;
    await h.refresh();
    assert.equal(bar.querySelector('[data-usage-metric="2"]').textContent, label);
    assert.equal(progress.getAttribute("stroke-dasharray"), `${arc} 100`);
  }
  delete usage.modelContextWindow;
  await h.refresh();
  assert.equal(progress.getAttribute("stroke-dasharray"), "0 100");
  assert.equal(bar.querySelector('[data-usage-metric="2"]').textContent, "—");
  h.window.__CODEX_SWITCH_USAGE_STATUSLINE__.dispose();
});

test("late timing replies cannot overwrite a new request for the same conversation", async () => {
  const h = setup(false); await drain();
  const identity = h.document.querySelector("[data-above-composer-conversation-id]");
  const bar = h.document.querySelector("[data-codex-switch-usage-statusline]");
  identity.setAttribute("data-above-composer-conversation-id", "two"); await h.refresh();
  identity.setAttribute("data-above-composer-conversation-id", "one"); await h.refresh();
  assert.equal(h.requests.length, 3);
  h.respond(h.requests[0]); await drain();
  h.respond(h.requests[1]); await drain();
  assert.match(bar.textContent, /^— tok\/s/);
  h.respond(h.requests[2]); await drain();
  assert.match(bar.textContent, /^51.0 tok\/s/);
  h.window.__CODEX_SWITCH_USAGE_STATUSLINE__.dispose();
});

test("timing polls are single-flight, retry after timeout and clear unknown measurements", async () => {
  const h = setup(false); await drain();
  h.setNow(3000); await h.refresh(); assert.equal(h.requests.length, 1);
  h.setNow(12000); await h.refresh(); assert.equal(h.requests.length, 2);
  h.respond(h.requests[1], null); await drain();
  const bar = h.document.querySelector("[data-codex-switch-usage-statusline]");
  assert.match(bar.textContent, /^— tok\/s/);
  h.window.__CODEX_SWITCH_USAGE_STATUSLINE__.dispose();
});
