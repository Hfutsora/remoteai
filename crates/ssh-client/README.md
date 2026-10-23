# SSH terminal and SFTP

This crate is used by desktop local terminals and by the authenticated PC host for
desktop remote and Web PC terminals. It supports password or pasted private-key
authentication, SHA256 host-key pinning, terminal input/resize, and SFTP browsing,
upload, download, mkdir, rename, and deletion of files or empty directories.

Connections are limited to eight. Transfers are limited to 4 MiB per file to fit
the existing remote relay. Upload and rename do not overwrite existing files.
Profiles retain only connection metadata and the accepted host fingerprint;
passwords, private keys and passphrases are never persisted. SSH agents, jump
hosts, tunnels, recursive transfers and remote editing are outside this version.

## Automated checks

From the repository root, with Cargo on PATH:

```powershell
$env:CARGO_TARGET_DIR = "$PWD/.codex-tmp/ssh-target"
cargo test --locked --manifest-path crates/ssh-client/Cargo.toml
cargo clippy --locked --manifest-path crates/ssh-client/Cargo.toml --all-targets -- -D warnings
```

## Live WSL validation

The optional fixture creates random disposable credentials, a real Bash PTY and
an SFTP directory in a temporary WSL directory. It does not change users, sshd,
authorized keys or system configuration. Its shell runs as the WSL user, so run
it only for local tests and stop it afterward. SFTP is confined to the temporary
directory. Configuration is written under ignored `.codex-tmp`; never commit it.

Install `asyncssh==2.24.1` in a disposable WSL virtual environment, then run the
tracked server in WSL from the repository root (keep it running):

```sh
python3 -m venv /tmp/remoteai-ssh-fixture-env
/tmp/remoteai-ssh-fixture-env/bin/pip install asyncssh==2.24.1
/tmp/remoteai-ssh-fixture-env/bin/python apps/desktop/e2e/ssh-wsl-server.py
```

Alternatively set `SSH_FIXTURE_PYTHON` to an existing temporary dependency
directory. `--host`, `--bind`, `--port` and `--config` override networking and the
output path. The default listens on WSL port 22022 so the Windows client can
reach the WSL address.

In Windows PowerShell, from the repository root:

```powershell
$env:CARGO_TARGET_DIR = "$PWD/.codex-tmp/ssh-target"
$env:SSH_TEST_CONFIG = "$PWD/.codex-tmp/ssh-wsl/config.json"
cargo test --locked --manifest-path crates/ssh-client/Cargo.toml --test live -- --ignored
cargo build --locked --manifest-path crates/ssh-client/Cargo.toml --example bridge
$env:SSH_FIXTURE_CONFIG = $env:SSH_TEST_CONFIG
node apps/desktop/e2e/ssh-backend.mjs
```

Keep the bridge running, and in another Windows PowerShell terminal:

```powershell
$env:SSH_FIXTURE_CONFIG = "$PWD/.codex-tmp/ssh-wsl/config.json"
Set-Location apps/desktop
npx playwright test --config playwright.chat.config.ts ssh.pw.ts --workers 1
```

Playwright starts Vite if needed. It exercises the production local, remote and
Web PC components with real SSH/SFTP through the Rust bridge; Tauri IPC and the
device transport are replaced by a local test adapter. It does not validate the
packaged native window or a live relay connection. Screenshots are written to
`.codex-tmp/chat-playwright`. Stop the bridge before rebuilding it on Windows,
and stop the fixture with Ctrl+C to remove its temporary directory and credentials.
