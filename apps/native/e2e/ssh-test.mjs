import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hierarchy, prepareHierarchy } from '../../desktop/e2e/android-hierarchy.mjs';

const exec = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
if (!serial) throw new Error('Set ANDROID_SERIAL to the test device.');
const packageName = 'com.codexswitch.mobile.terminaltest';
const output = fileURLToPath(new URL('../../../.codex-tmp/mobile-ssh-android/', import.meta.url));
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  timeout: 30_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', windowsHide: true,
})).stdout.trim();
const pause = () => new Promise(resolve => setTimeout(resolve, 400));
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>').replaceAll('&apos;', "'");
async function nodes() {
  let xml = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    xml = await hierarchy(adb);
    if (xml.includes(`package="${packageName}"`)) break;
    await pause();
  }
  await writeFile(`${output}/latest.xml`, xml);
  if (!xml.includes(`package="${packageName}"`)) throw new Error('Another app is using the test device.');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => {
    const value = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(item => [item[1], decode(item[2])]));
    value.rect = [...value.bounds.matchAll(/\d+/g)].map(item => Number(item[0]));
    return value;
  });
}
async function find(label) {
  const matches = (await nodes()).filter(node => (node.text === label || node['content-desc'] === label)
    && node.rect[2] > node.rect[0] && node.rect[3] > node.rect[1]);
  return matches.find(node => node.clickable === 'true') ?? matches[0];
}
async function wait(label) {
  for (let attempt = 0; attempt < 12; attempt++) { if (await find(label)) return; await pause(); }
  throw new Error(`Missing ${label}`);
}
async function tap(label, scroll = false) {
  for (let attempt = 0; attempt < (scroll ? 8 : 1); attempt++) {
    const node = await find(label);
    if (node) {
      const [left, top, right, bottom] = node.rect;
      await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1)); return;
    }
    const view = (await nodes()).filter(node => node.scrollable === 'true').at(-1);
    if (!view) break;
    const [left, top, right, bottom] = view.rect;
    await adb('shell', 'input', 'swipe', String((left + right) >> 1), String(bottom - 30),
      String((left + right) >> 1), String(top + 30), '300');
  }
  throw new Error(`Cannot tap ${label}`);
}
async function input(label, text) {
  await wait(label);
  const node = (await nodes()).find(item => item.class === 'android.widget.EditText'
    && item['content-desc'] === label);
  assert.ok(node, label);
  const [left, top, right, bottom] = node.rect;
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
  await adb('shell', 'input', 'keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_A');
  await adb('shell', 'input', 'text', text);
  await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
}
async function screenshot(name) {
  const { stdout } = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer', maxBuffer: 16 * 1024 * 1024, windowsHide: true,
  });
  await writeFile(`${output}/${name}.png`, stdout);
}
async function launch(scale) {
  await adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  await adb('shell', 'settings', 'put', 'system', 'user_rotation', '0');
  await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
  await adb('shell', 'am', 'force-stop', packageName);
  await adb('shell', 'am', 'start', '-n', `${packageName}/com.codexswitch.mobile.MainActivity`);
  await wait('打开远程终端'); await tap('打开远程终端'); await wait('终端连接选项');
}
async function verify(scale) {
  if (process.env.SSH_CLOUD_FIXTURE) {
    const headers = { Authorization: 'Bearer ssh-fixture', 'Content-Type': 'application/json' };
    assert.equal((await fetch('http://127.0.0.1:1499/fixture/reset', { method: 'POST', headers })).ok, true);
    assert.equal((await fetch('http://127.0.0.1:1499/sync/ssh-profiles/saved', { method: 'PUT', headers,
      body: JSON.stringify({ id: 'saved', name: 'Saved on Office', host: 'fixture.test', port: 22,
        username: 'fixture', auth: 'password', fingerprint: 'SHA256:fixture' }),
    })).ok, true);
  }
  await launch(scale);
  await screenshot(`terminal-${scale}`);
  await tap('终端连接选项'); await wait('Saved on Office');
  await screenshot(`connections-${scale}`);
  await tap('Saved on Office');
  await tap('连接并保存'); await wait('远程文件浏览');
  await tap('远程文件浏览'); await wait('hello.txt');
  await screenshot(`files-${scale}`);
  await tap('中文目录'); await tap('打开文件夹'); await wait('没有匹配的文件');
  await tap('新建文件夹'); await input('文件名', 'phone-folder'); await tap('确定'); await wait('phone-folder');
  await tap('phone-folder'); await tap('重命名'); await input('文件名', 'renamed'); await tap('确定');
  await wait('renamed'); await tap('renamed'); await tap('删除');
  await wait('删除“renamed”？'); await screenshot(`delete-${scale}`); await tap('删除');
  await wait('没有匹配的文件'); await tap('返回上一层'); await wait('远程文件浏览');
  await tap('终端连接选项'); await wait('Saved on Office'); await tap('新建 SSH 连接…');
  await input('连接名称（可选）', 'Phone-added'); await input('IP 或主机名', 'phone.test');
  await input('用户名', 'fixture'); await tap('连接并保存'); await tap('信任并连接');
  await wait('远程文件浏览');
  await tap('终端连接选项'); await wait('Phone-added'); await screenshot(`saved-${scale}`);
  await tap('关闭SSH 连接');
  await tap('切换横屏'); await wait('切换竖屏');
  await tap('远程文件浏览'); await tap('hello.txt', true);
  await wait('下载'); await screenshot(`files-landscape-${scale}`);
  await tap('返回上一层'); await tap('切换竖屏'); await wait('切换横屏');
  if (process.env.SSH_CLOUD_FIXTURE) {
    const profiles = await (await fetch('http://127.0.0.1:1499/sync/ssh-profiles', {
      headers: { Authorization: 'Bearer ssh-fixture' },
    })).json();
    assert.ok(profiles.some(profile => profile.name === 'Phone-added' && profile.revision > 0));
    assert.ok(profiles.every(profile => !('password' in profile) && !('privateKey' in profile)));
  }
  for (let index = 0; index < 5; index++) { await tap('新建终端'); await pause(); }
  await wait('更多终端');
  assert.equal(await find('关闭终端'), undefined, 'No shared delete button');
  await screenshot(`tabs-overflow-${scale}`);
  await tap('更多终端'); await wait('终端 1');
  await screenshot(`tabs-menu-${scale}`);
  await tap('关闭终端 1');
  await tap('fixture@fixture.test:22');
  await screenshot(`tabs-selected-${scale}`);
  await tap('关闭终端 1');
  await tap('切换横屏'); await wait('切换竖屏');
  await screenshot(`tabs-landscape-${scale}`);
  await tap('切换竖屏'); await wait('切换横屏');
  console.log(`PASS SSH native workflow at font scale ${scale}`);
}
await mkdir(output, { recursive: true });
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
const originalRotation = await adb('shell', 'settings', 'get', 'system', 'user_rotation');
const originalAutoRotation = await adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation');
try {
  await prepareHierarchy({ adb, output });
  for (const scale of [1, 1.3]) await verify(scale);
} catch (error) { await screenshot('failure'); throw error; }
finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'settings', 'put', 'system', 'user_rotation', originalRotation);
  await adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', originalAutoRotation);
  await adb('shell', 'am', 'force-stop', packageName);
}
