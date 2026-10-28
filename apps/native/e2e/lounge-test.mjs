import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.codex-tmp/lounge-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to a physical test device');
const app = 'com.codexswitch.mobile.loungetest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();
const image = 'data:image/png;base64,' + (await readFile(path.join(root,
  'apps/desktop/src-tauri/icons/32x32.png'))).toString('base64');
const sent = [];
const moderated = [];
let online = true;
const server = createServer((request, response) => {
  response.writeHead(online ? 200 : 503, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ ticket: 'fixture-ticket' }));
});
const sockets = new WebSocket.Server({ server, path: '/lounge/socket' });
function incoming(text, images = []) {
  return { type: 'message', id: crypto.randomUUID(), text, images,
    sender: { id: 'bob', account: 'bob@example.test' }, sentAt: new Date().toISOString() };
}
function broadcast(frame) { for (const socket of sockets.clients) socket.send(JSON.stringify(frame)); }
sockets.on('connection', socket => socket.on('message', raw => {
  const frame = JSON.parse(String(raw));
  if (frame.type === 'authenticate') {
    socket.send(JSON.stringify({ type: 'ready', user: { id: 'alice', account: 'alice@example.test' },
      policy: { moderator: true, mutedUntil: null } }));
    socket.send(JSON.stringify(incoming('真机中文测试：忙里偷闲，聊点轻松的 ☕', [image])));
  }
  if (frame.type === 'ping') socket.send('{"type":"pong"}');
  if (frame.type === 'message') {
    sent.push(frame);
    socket.send(JSON.stringify({ ...frame, sender: { id: 'alice', account: 'alice@example.test', avatar: frame.avatar },
      sentAt: new Date().toISOString() }));
  }
  if (frame.type === 'moderate') {
    moderated.push(frame); socket.send(JSON.stringify({ type: 'moderated', id: frame.id }));
  }
}));

async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/lounge-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/lounge-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const node = (await nodes()).find(value => value.text === label || value['content-desc'] === label);
    if (node) return node;
    await delay(500);
  }
  assert.fail(`Missing native label: ${label}`);
}
async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
  await delay(350);
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/lounge-result.png');
  await adb('pull', '/sdcard/lounge-result.png', path.join(output, `${name}.png`));
}
async function hideKeyboard() {
  const state = await adb('shell', 'dumpsys', 'input_method');
  if (state.includes('mInputShown=true')) {
    await adb('shell', 'input', 'keyevent', '4'); await delay(500);
  }
}
async function assertEventually(predicate, label) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (predicate()) return;
    await delay(250);
  }
  assert.fail(label);
}

const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await adb('reverse', 'tcp:1497', `tcp:${server.address().port}`);
  await adb('install', '-r', path.join(root, 'apps/native/android/app/build/outputs/apk/release/lounge-fixture.apk'));
  for (const scale of [1, 1.3]) {
    online = true;
    const unique = `Hello-native-${Date.now()}`;
    const sentBefore = sent.length;
    const moderatedBefore = moderated.length;
    await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await find('闲聊摸鱼'); await find('1'); await screenshot(`discovery-${scale}`);
    await tap('闲聊摸鱼'); await find('已连接');
    await find('真机中文测试：忙里偷闲，聊点轻松的 ☕'); await screenshot(`chat-${scale}`);
    await tap('消息'); await adb('shell', 'input', 'text', unique); await screenshot(`keyboard-${scale}`);
    await tap('发送');
    await assertEventually(() => sent.length > sentBefore && sent.at(-1).text === unique, 'Send ack');
    await tap('消息'); await adb('shell', 'input', 'text', 'Draft');
    await hideKeyboard();
    await tap('历史记录'); await tap('搜索消息或账户'); await adb('shell', 'input', 'text', unique);
    await find('本页 1 条记录'); await hideKeyboard(); await screenshot(`history-${scale}`);
    await tap('返回聊天'); await find('Draft');
    await tap('管理 bob@example.test 的发言权限'); await find('禁言时长（分钟）');
    await screenshot(`moderation-${scale}`); await tap('禁言');
    await assertEventually(() => moderated.length > moderatedBefore, 'Moderation ack');
    await tap('设置头像'); await find('选择图片'); await screenshot(`avatar-${scale}`); await tap('取消');
    broadcast({ type: 'policy', policy: { moderator: false, mutedUntil: new Date(Date.now() + 60000).toISOString() } });
    await delay(500); await screenshot(`muted-${scale}`);
    await adb('shell', 'input', 'keyevent', '4'); await find('闲聊摸鱼');
    broadcast(incoming('后台未读消息')); await find('1');
    await tap('闲聊摸鱼'); await find('后台未读消息');
    await adb('shell', 'input', 'keyevent', '3');
    broadcast(incoming('切回应用后收到')); await delay(300);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await find('切回应用后收到');
    await adb('shell', 'input', 'keyevent', '4'); await tap('English'); await tap('Watercooler');
    await find('Chat history'); await screenshot(`english-${scale}`);
    await adb('shell', 'input', 'keyevent', '4'); await tap('Sign out fixture'); await find('Signed out fixture');
    await assertEventually(() => sockets.clients.size === 0, 'Sign out closes socket');
    online = false;
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await find('闲聊摸鱼');
    assert.ok(!(await nodes()).some(node => node.text === '1'), 'Restored messages must not add unread');
    await tap('闲聊摸鱼'); await tap('历史记录'); await tap('搜索消息或账户');
    await adb('shell', 'input', 'text', unique); await find('本页 1 条记录'); await find(unique);
    await hideKeyboard(); await screenshot(`offline-restart-${scale}`);
    assert.equal(sockets.clients.size, 0, 'Search must work without a connection');
    console.log(`PASS native lounge at font scale ${scale}: history survives offline restart; discovery, send, moderation`);
  }
} catch (error) {
  await screenshot('failed');
  throw error;
} finally {
  if (originalScale === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
  await adb('reverse', '--remove', 'tcp:1497');
  for (const socket of sockets.clients) socket.terminate();
  sockets.close(); server.close();
  await adb('shell', 'am', 'start', '-W', '-n', 'com.codexswitch.mobile/com.codexswitch.mobile.MainActivity');
}
