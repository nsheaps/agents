# claude-rc

CLI for the `claude-rc-daemon`, which keeps `claude rc` (Claude Code remote control) running for your repositories. Supports macOS, Ubuntu, Debian and Fedora.

## Install

```bash
brew install nsheaps/devsetup/claude-rc
brew services start claude-rc   # runs claude-rc-daemon
```

## Configure

`~/.claude/daemon/rc.json`:

```json
{
  "repos": [{ "name": "my-repo", "path": "/abs/path/to/my-repo" }],
  "spawn": "worktree",
  "env": { "KEY": "value" }
}
```

Or use `claude-rc add my-repo /abs/path/to/my-repo`. The daemon watches the file and reloads on change.

## Usage

```
claude-rc status            show daemon and per-repo service state
claude-rc add <name> <path> / remove <name>
claude-rc restart|start|stop [name]
claude-rc reload            re-read rc.json
claude-rc trust [name]      pre-accept Claude's workspace-trust prompt
claude-rc attach <name>     connect to a repo's tmux session (detach: Ctrl-b d; it keeps running)
claude-rc update [--no-restart]  run `claude upgrade` now; restart running repos once they are idle
claude-rc ui [--print]      open the local settings/monitor page (prints the URL with --print)
claude-rc logs <name> [-f]
claude-rc config            print the config path and contents
claude-rc doctor            check claude, config, service manager, daemon
claude-rc shutdown          stop the daemon (and its children)
```

Exit codes: 0 ok, 1 error, 2 usage, 3 daemon not running.

## Sessions in tmux

Each repo's `claude rc` runs in its own private tmux server (socket under `~/.claude/daemon/run/tmux/`, session `rc`; your own `tmux.conf` is not used). Connect and disconnect whenever you like:

```
claude-rc attach my-repo      # detach with Ctrl-b d — the session keeps running
```

The web page shows the exact `tmux -S … attach -t rc` command for each repo and has a **Terminal** button for an in-browser terminal (xterm.js over a token- and Origin-checked WebSocket on 127.0.0.1; disable with `ui.terminal: false`). Closing it only detaches.

Because nobody is watching a detached session, the daemon watches it for you. `claude-rc status` and the web page show a health state per repo: `ok`, `attention` (e.g. a trust or login prompt is waiting for input — you also get a notification), `down` (process up but session or pane gone), `crash-loop` (3+ exits in 10 minutes). This checks that the process and its terminal are alive and not stuck on a prompt; it cannot prove that Claude's remote connection itself is up. Without tmux installed (or with `"terminal": "pty"`) the daemon falls back to a plain pseudo-terminal: still supervised, but not attachable.

## Notifications, updates and the web UI

- **Notifications** when a repo's `claude rc` starts, exits or is restarted (macOS: built in; Linux: needs `notify-send`, package `libnotify-bin` on Debian/Ubuntu, `libnotify` on Fedora).
- **Update check** once a day for claude-rc and for Claude Code; each new version is announced once. Update notices go to every logged-in desktop user via `notify-send` when the daemon runs as root (`notifications.allUsers`), otherwise to the daemon's own user, and appear as a banner in the web page.
- **Update now** (web button or `claude-rc update`) runs `claude upgrade` and restarts each running repo once it is idle (nobody attached and no output for `updates.idleSeconds`). claude-rc itself updates with `brew upgrade claude-rc`.
- **Auto-upgrade** toggle: `updates.autoUpgrade` controls whether the daemon runs `claude upgrade` each time it starts.
- **`claude-rc ui`** opens a page on `127.0.0.1` to monitor repos, add/remove them, restart/stop/start them, open a terminal, and change settings.

All of it is configurable in `rc.json`:

```json
{
  "terminal": "auto",
  "notifications": { "enabled": true, "onStart": true, "onExit": true, "allUsers": true },
  "updates": { "claudeRc": true, "claude": true, "autoUpgrade": true, "idleSeconds": 120 },
  "ui": { "port": 47474, "terminal": true }
}
```

There is no native menu-bar/tray icon; the web page covers the same ground.

See `docs/specs/draft/claude-rc.md` for the design.

## Build

```bash
bun run scripts/build-binary.ts --version 0.1.0 [--target linux-x64]
```
