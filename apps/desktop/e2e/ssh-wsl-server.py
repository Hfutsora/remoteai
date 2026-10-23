"""Disposable WSL SSH/SFTP fixture. Never changes the machine's SSH configuration."""
import argparse
import asyncio
import fcntl
import json
import os
from pathlib import Path
import pty
import secrets
import signal
import struct
import subprocess
import sys
import tempfile
import termios

if os.environ.get('SSH_FIXTURE_PYTHON'):
    sys.path.insert(0, os.environ['SSH_FIXTURE_PYTHON'])
import asyncssh


def resize(master, width, height):
    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', height or 24, width or 80, 0, 0))


async def copy_output(process, master):
    while True:
        try:
            data = await asyncio.to_thread(os.read, master, 8192)
        except OSError:
            return
        if not data:
            return
        process.stdout.write(data)


async def copy_input(process, master):
    while True:
        try:
            data = await process.stdin.read(8192)
        except asyncssh.TerminalSizeChanged as event:
            resize(master, event.width, event.height)
            continue
        except (asyncssh.BreakReceived, asyncssh.SignalReceived):
            continue
        if not data:
            return
        os.write(master, data)


async def shell(process, root):
    master, slave = pty.openpty()
    width, height, _, _ = process.get_terminal_size()
    resize(master, width, height)
    child = subprocess.Popen(
        ['/bin/bash', '--noprofile', '--norc', '-i'], stdin=slave, stdout=slave, stderr=slave,
        cwd=root, env={**os.environ, 'PS1': 'wsl-ssh> ', 'TERM': 'xterm-256color'}, start_new_session=True)
    os.close(slave)
    tasks = [asyncio.create_task(copy_output(process, master)), asyncio.create_task(copy_input(process, master))]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in tasks:
            task.cancel()
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
        os.close(master)
        await asyncio.to_thread(child.wait)
        await asyncio.gather(*tasks, return_exceptions=True)
        process.exit(0)


class Server(asyncssh.SSHServer):
    def __init__(self, password, key):
        self.password = password
        self.key = key.convert_to_public()

    def begin_auth(self, username):
        return True

    def password_auth_supported(self):
        return True

    def public_key_auth_supported(self):
        return True

    def validate_password(self, username, password):
        return username == 'fixture' and secrets.compare_digest(password, self.password)

    def validate_public_key(self, username, key):
        return username == 'fixture' and key == self.key


async def serve(args, root):
    (root / '中文目录').mkdir()
    (root / 'hello.txt').write_text('Hello from WSL SSH\n你好，远程文件！\n', encoding='utf-8')
    (root / '.hidden').write_text('hidden\n', encoding='utf-8')
    password = secrets.token_urlsafe(24)
    key = asyncssh.generate_private_key('ssh-ed25519')
    async with await asyncssh.create_server(
        lambda: Server(password, key), args.bind, args.port,
        server_host_keys=[asyncssh.generate_private_key('ssh-ed25519')],
        process_factory=lambda process: shell(process, root), encoding=None,
        sftp_factory=lambda channel: asyncssh.SFTPServer(channel, chroot=str(root))):
        host = args.host or subprocess.check_output(['hostname', '-I']).decode().split()[0]
        config = dict(host=host, port=args.port, username='fixture', password=password,
                      privateKey=key.export_private_key().decode())
        args.config.parent.mkdir(parents=True, exist_ok=True)
        args.config.write_text(json.dumps(config), encoding='utf-8')
        args.config.chmod(0o600)
        print('WSL SSH fixture ready', flush=True)
        stopped = asyncio.Event()
        loop = asyncio.get_running_loop()
        for event in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(event, stopped.set)
        try:
            await stopped.wait()
        finally:
            args.config.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path,
                        default=Path(__file__).resolve().parents[3] / '.codex-tmp/ssh-wsl/config.json')
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--host', help='Address reachable by the Windows test client')
    parser.add_argument('--port', type=int, default=22022)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='remoteai-ssh-fixture-') as temporary:
        asyncio.run(serve(args, Path(temporary)))


if __name__ == '__main__':
    main()
