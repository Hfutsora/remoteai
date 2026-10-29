import assert from 'node:assert/strict';

export async function verifyNativeNames({ adb, tap, find, nodes, screenshot, hideKeyboard,
  longPress, scale, names, broadcast, incoming, restart }) {
  async function fill(label, value) {
    await tap(label); await adb('shell', 'input', 'keyevent', '123');
    await adb('shell', 'input', 'keyevent', ...Array(64).fill('67'));
    if (value) await adb('shell', 'input', 'text', value);
  }
  async function save() {
    await hideKeyboard();
    const available = (await nodes()).some(node => node.text === '保存' && node.bounds !== '[0,0][0,0]');
    if (!available) await adb('shell', 'input', 'swipe', '540', '1800', '540', '1000', '350');
    await tap('保存');
  }
  await tap('个人资料'); await find('昵称');
  await fill('昵称', 'Alice'); await screenshot(`names-keyboard-${scale}`); await save();
  await find('已保存'); assert.equal(names.nicknames.get('alice'), 'Alice');
  names.update('nickname', 'alice', '自己的中文昵称'); await find('自己的中文昵称');
  await screenshot(`names-own-${scale}`); await tap('返回');
  broadcast({ ...incoming('备注同步测试'), recipient: { id: 'alice', account: 'alice@example.test' } });
  await find('与 小明 私聊'); await tap('查看 小明 的资料'); await find('备注');
  await fill('备注', 'Colleague'); names.reject(true); await save();
  await find('备注保存失败，请稍后重试。'); await find('Colleague');
  await screenshot(`names-error-${scale}`); names.reject(false); await save();
  await find('已保存'); assert.equal(names.remarks.get('bob'), 'Colleague');
  names.update('remark', 'bob', '另一台设备设置的中文备注'); await find('另一台设备设置的中文备注');
  await screenshot(`names-contact-${scale}`); await tap('返回');
  await longPress('与 另一台设备设置的中文备注 私聊'); await find('发起私聊');
  await screenshot(`names-sheet-${scale}`); await tap('取消');
  await restart();
  broadcast({ ...incoming('重启后恢复资料'), recipient: { id: 'alice', account: 'alice@example.test' } });
  await find('与 另一台设备设置的中文备注 私聊'); await tap('查看 另一台设备设置的中文备注 的资料');
  await fill('备注', ''); await save(); await find('已保存'); assert.equal(names.remarks.get('bob'), '');
  await tap('返回'); await find('与 小明 私聊'); names.update('nickname', 'bob', '');
  await find('与 bob@example.test 私聊');
  await tap('个人资料'); await find('自己的中文昵称'); await tap('返回');
  await tap('返回发现');
  console.log(`PASS native names: saves, failures, private remarks, remote updates, clear and fresh install at ${scale}`);
}
