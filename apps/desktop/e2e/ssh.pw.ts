import { expect, test, type Page } from '@playwright/test';

interface Fixture { host: string; port: number; username: string; password: string; privateKey: string }
test.skip(!process.env.SSH_FIXTURE_CONFIG, 'Requires the disposable WSL SSH fixture and Rust bridge');
test.use({ actionTimeout: 15_000, screenshot: 'only-on-failure' });

async function connect(page: Page, fixture: Fixture, key = false) {
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '新建 SSH 连接…' }).click();
  await page.getByLabel('连接名称（可选）').fill('WSL test');
  await page.getByLabel('IP 或主机名').fill(fixture.host);
  await page.getByLabel('端口').fill(String(fixture.port));
  await page.getByLabel('用户名').fill(fixture.username);
  if (key) {
    await page.getByLabel('登录方式').press('ArrowDown');
    await page.getByTitle('私钥', { exact: true }).click();
    await page.getByRole('textbox', { name: /私钥$/ }).fill(fixture.privateKey);
  } else await page.getByLabel('密码', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: '连接并保存' }).click();
  await expect(page.getByText('首次连接，请核对服务器指纹')).toBeVisible();
  await page.getByRole('button', { name: '信任并连接' }).click();
  await expect(page.getByRole('dialog', { name: 'SSH 连接' })).toBeHidden();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: live WSL SSH terminal and SFTP drawer`, async ({ page, request }, testInfo) => {
    test.setTimeout(90_000);
    const fixture = await (await request.get('http://127.0.0.1:1498/config')).json() as Fixture;
    await request.post('http://127.0.0.1:1498/reset');
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    await connect(page, fixture, mode === 'remote');
    await expect(page.locator('.xterm-rows').getByText('wsl-ssh>', { exact: false })).toBeVisible();
    const terminal = page.locator('[role="tabpanel"]:visible .xterm-helper-textarea');
    await terminal.focus();
    await page.keyboard.type("printf 'SSH-OK\\n'; stty size"); await page.keyboard.press('Enter');
    await expect(page.locator('.xterm-rows').getByText('SSH-OK', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: '聊天输入' }).fill('SSH 运行时可以继续输入');
    await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
    await expect(page.getByRole('tab', { name: `${fixture.host} 远程文件浏览` })).toBeVisible();
    await expect(page.getByRole('button', { name: /hello.txt/ })).toBeVisible();
    await page.getByRole('button', { name: /中文目录/ }).dblclick();
    await expect(page.getByRole('textbox', { name: '远程路径' })).toHaveValue('/中文目录');
    const fileName = `ssh-${mode}-${Date.now()}.txt`;
    await page.locator('input[type="file"]').setInputFiles({ name: fileName,
      mimeType: 'text/plain', buffer: Buffer.from('WSL upload 中文\n') });
    const file = page.getByRole('button', { name: new RegExp(fileName) });
    await expect(file).toBeVisible(); await file.click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载', exact: true }).click();
    const downloaded = await download;
    expect(downloaded.suggestedFilename()).toBe(fileName);
    const data: Buffer[] = [];
    for await (const chunk of (await downloaded.createReadStream())!) data.push(Buffer.from(chunk));
    expect(Buffer.concat(data).toString()).toBe('WSL upload 中文\n');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('tab', { name: `${fixture.host} Remote files` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload file', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect(page.getByRole('tab', { name: `${fixture.host} 远程文件浏览` })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ssh-${mode}.png`) });
    if (mode !== 'web') {
      await page.getByRole('button', { name: '切换主题' }).click();
      await expect(page.getByRole('textbox', { name: '远程路径' }))
        .toHaveCSS('background-color', 'rgb(20, 20, 20)');
      await page.screenshot({ path: testInfo.outputPath(`ssh-${mode}-dark.png`) });
    }
    await page.setViewportSize({ width: 900, height: 700 });
    await expect(page.getByRole('button', { name: '上传文件', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '下载', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ssh-${mode}-narrow.png`) });
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.getByRole('button', { name: '重命名', exact: true }).click();
    await page.getByRole('textbox', { name: '文件名' }).fill(`renamed-${fileName}`);
    await page.getByRole('button', { name: /^确\s*定$/ }).click();
    await page.getByRole('button', { name: new RegExp(`renamed-${fileName}`) }).click();
    await page.getByRole('button', { name: /^删\s*除$/ }).click();
    await page.getByRole('tooltip').getByRole('button', { name: /^删\s*除$/ }).click();
    await expect(page.getByRole('button', { name: new RegExp(`renamed-${fileName}`) })).toBeHidden();
    const stored = await page.evaluate(() => localStorage.getItem('remoteai.ssh.profiles.v1'));
    expect(stored).toContain(fixture.host); expect(stored).not.toContain(fixture.password);
    expect(stored).not.toContain('PRIVATE KEY');
    await page.getByRole('button', { name: '关闭终端 2' }).click();
    await expect(page.getByRole('tab', { name: `${fixture.host} 远程文件浏览` })).toBeHidden();
  });
}
