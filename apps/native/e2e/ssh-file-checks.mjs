import assert from 'node:assert/strict';

export async function checkSshFiles(ui, scale) {
  const { tap, wait, find, input, screenshot, longPress, back } = ui;
  await tap('远程文件浏览'); await wait('hello.txt');
  for (const label of ['打开文件夹', '重命名', '删除']) {
    assert.equal(await find(label), undefined, `${label} must not appear in a persistent footer`);
  }
  await screenshot(`files-${scale}`);
  await tap('中文目录'); await wait('没有匹配的文件');
  await tap('新建文件夹'); await input('文件名', 'phone-folder'); await tap('确定'); await wait('phone-folder');
  await longPress('phone-folder'); await wait('重命名'); await screenshot(`file-menu-${scale}`);
  await tap('重命名'); await input('文件名', 'renamed'); await tap('确定'); await wait('renamed');
  await longPress('renamed'); await tap('删除'); await wait('删除“renamed”？');
  await screenshot(`delete-${scale}`); await tap('删除'); await wait('没有匹配的文件');
  await tap('上一级'); await wait('hello.txt');
  await checkEditor(ui, { name: 'hello.txt', content: `edited-text-${scale}`, scale });
  await checkEditor(ui, { name: 'app.ts', content: `const%sversion=${scale}`, scale });
  await tap('hello.txt'); await wait('文件内容'); await input('文件内容', 'unsaved-draft');
  await back(); await wait('放弃修改'); await screenshot(`unsaved-${scale}`);
  await tap('取消'); await wait('文件内容');
  assert.equal((await find('文件内容')).text, 'unsaved-draft');
  await back(); await tap('放弃修改'); await wait('hello.txt');
  await tap('hello.txt'); await wait('文件内容');
  assert.equal((await find('文件内容')).text, `edited-text-${scale}`);
  await tap('关闭文件'); await wait('hello.txt');
  await tap('返回上一层'); await wait('远程文件浏览');
  await tap('切换横屏'); await wait('切换竖屏');
  await tap('远程文件浏览'); await tap('hello.txt', true); await wait('文件内容');
  await screenshot(`file-editor-landscape-${scale}`); await tap('关闭文件');
  await tap('返回上一层'); await tap('切换竖屏'); await wait('切换横屏');
}

async function checkEditor(ui, { name, content, scale }) {
  const { tap, wait, find, input, screenshot } = ui;
  await tap(name, true); await wait('文件内容'); await screenshot(`file-editor-${name}-${scale}`);
  await input('文件内容', content); await tap('保存文件'); await wait('文件已保存。');
  await screenshot(`file-saved-${name}-${scale}`);
  await tap('关闭文件'); await wait(name); await tap(name); await wait('文件内容');
  assert.equal((await find('文件内容')).text, content.replaceAll('%s', ' '), `${name} must save bytes and reopen`);
  await tap('关闭文件'); await wait(name);
}
