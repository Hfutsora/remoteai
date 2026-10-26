import { testBrowserChannel, testBrowserLaunchOptions } from './test-browser.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { chromium } from '@playwright/test';

const renderer = await readFile(new URL('../apps/desktop/src-tauri/src/dream_skin_native/pet_dock.js', import.meta.url), 'utf8');
const image = `data:image/png;base64,${(await readFile(new URL('../apps/desktop/src-tauri/src/dream_skin_native/pet_dock/platform.png', import.meta.url))).toString('base64')}`;
const fixture = `<!doctype html><style>
  body { margin:0; background:#18202b; }
  [data-avatar-overlay-content-frame] { position:relative; width:500px; height:600px; }
  .group.absolute { position:absolute; left:140px; top:90px; width:80px; height:100px; }
  [data-avatar-mascot] { width:80px; height:100px; background:#799de1; border-radius:45%; }
  [data-quick-chat-presentation] { width:130px; height:25px; background:#888; }
  #tray-host { position:absolute; top:225px; left:105px; }
  [data-avatar-overlay-size] { width:220px; height:100px; background:#293b50; }
</style><div data-avatar-overlay-content-frame>
  <div class="group absolute"><div data-avatar-mascot="true"></div>
    <div data-quick-chat-presentation><button id="native-action">Native action</button></div></div>
  <div id="tray-host"><div data-avatar-overlay-size="notification-tray"><button id="card-action">Card</button></div></div>
</div>`;
let browser, page;
const update = (snapshot) => page.evaluate(({ snapshot, image }) => window.__remoteAiPetDock.update(snapshot, image), { snapshot, image });
const inspect = () => page.evaluate(() => window.__remoteAiPetDock.inspect());
const official = { language: 'zh', kind: 'official', fiveHour: { remaining: 81 }, weekly: { remaining: 62 } };

before(async () => {
  browser = await chromium.launch(testBrowserLaunchOptions({
    channel: testBrowserChannel(process.env.PLAYWRIGHT_CHANNEL),
  }));
});
after(async () => { await browser?.close(); });
beforeEach(async () => {
  await page?.close();
  page = await browser.newPage({ viewport: { width: 600, height: 700 } });
  await page.setContent(fixture);
  await page.clock.install();
  await page.evaluate(renderer);
  await update(official);
});

test('keeps the pet size, scales the base to 1.75, and places live cards below it', async () => {
  const state = await inspect();
  assert.equal(state.mascot.width, 80);
  assert.equal(state.dock.width, 140);
  assert.equal(state.dock.height, 45);
  assert.equal(state.sameMovingParent, true);
  assert.equal(state.toolbarHidden, true);
  assert.ok(state.tray.top > state.dock.bottom);
  assert.equal(await page.locator('[data-side="left"]').textContent(), '81%');
  assert.equal(await page.locator('[data-side="right"]').textContent(), '62%');
});

test('moves the dock in the exact same frame as a dragged native parent', async () => {
  const delta = await page.evaluate(() => {
    const before = window.__remoteAiPetDock.inspect();
    document.querySelector('.group.absolute').style.transform = 'translate(63px, 41px)';
    const after = window.__remoteAiPetDock.inspect();
    return { petX: after.mascot.x - before.mascot.x, dockX: after.dock.x - before.dock.x,
      petY: after.mascot.y - before.mascot.y, dockY: after.dock.y - before.dock.y };
  });
  assert.deepEqual(delta, { petX: 63, dockX: 63, petY: 41, dockY: 41 });
});

test('adapts to another pet size and does not add duplicate docks', async () => {
  await page.evaluate(() => {
    document.querySelector('[data-avatar-mascot]').style.width = '128px';
    window.__remoteAiPetDock.update({ language: 'en' });
  });
  await page.evaluate(renderer);
  const state = await inspect();
  assert.equal(state.dock.width, 224);
  assert.equal(state.mascot.width, 128);
  assert.equal(state.dockCount, 1);
});

test('switches official/API values and localizes labels without copying provider data', async () => {
  await update({ language: 'zh', kind: 'api', remaining: { amount: 1545.42, unit: 'USD' }, totalTokens: 55910000 });
  assert.equal(await page.locator('[data-side="left"]').textContent(), '$1545.42');
  assert.equal(await page.locator('[data-side="right"]').textContent(), '55.91M');
  await update({ language: 'ja', kind: 'api', remaining: { unlimited: true }, totalTokens: null });
  assert.equal(await page.locator('[data-side="left"]').textContent(), '無制限');
  assert.equal(await page.locator('[data-side="right"]').textContent(), '--');
  await update(official);
  assert.equal(await page.locator('[data-side="left"]').textContent(), '81%');
});

test('restores native attributes and card positions when disabled', async () => {
  await page.evaluate(() => window.__remoteAiPetDock.destroy());
  assert.equal(await page.locator('#remoteai-pet-dock').count(), 0);
  assert.equal(await page.locator('[data-remoteai-dock-toolbar]').count(), 0);
  assert.equal(await page.locator('[inert]').count(), 0);
  assert.equal(await page.locator('#tray-host').evaluate((node) => node.style.getPropertyValue('--remoteai-dock-tray-shift')), '');
  await page.locator('#native-action').click();
  await page.locator('#card-action').click();
});

test('restores the native layout if the host stops supplying heartbeats', async () => {
  await page.clock.fastForward(21_000);
  assert.equal(await page.locator('#remoteai-pet-dock').count(), 0);
  assert.equal(await page.locator('[data-remoteai-dock-toolbar]').count(), 0);
});

test('reattaches when the native pet host is recreated', async () => {
  await page.evaluate(() => {
    const host = document.querySelector('.group.absolute');
    const next = host.cloneNode(true);
    next.querySelector('#remoteai-pet-dock')?.remove();
    host.replaceWith(next);
    window.__remoteAiPetDock.update({ language: 'en', kind: 'official' });
  });
  assert.equal((await inspect()).sameMovingParent, true);
  assert.equal(await page.locator('#remoteai-pet-dock').count(), 1);
});
