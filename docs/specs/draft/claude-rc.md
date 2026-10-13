# claude-rc — Spec (DRAFT)

Plan and status: `.claude/plans/claude-rc.md`.

## 1. Overview

`claude-rc` keeps Claude Code remote-control sessions (`claude rc`) running for a set of repositories. Two binaries ship in one Homebrew formula:

- `claude-rc-daemon` — long-running service (Linux and macOS).
- `claude-rc` — CLI that talks to the daemon over a unix socket.

Packages: `lib/claude-rc-core` (config, supervisors, IPC, specs), `services/claude-rc-daemon`, `apps/claude-rc-cli`.

## 2. Goals / non-goals

Goals: one command starts `claude rc` per configured repo; children restart on exit; children do not survive reboot while the daemon does (and recreates them); supported on macOS, Ubuntu, Debian, Fedora.
Non-goals: Windows; managing Claude authentication; modifying `claude` itself.

## 3. Config: `~/.claude/daemon/rc.json`

```json
{
  "repos": [{ "name": "app", "path": "/abs/path" }],
  "spawn": "worktree",
  "env": { "KEY": "value" },
  "autoTrust": true
}
```

- `repos[].name`: unique, `[A-Za-z0-9._-]+`. `repos[].path`: absolute. Missing path → that repo reports an error, others continue.
- `spawn`: one of `same-dir`, `worktree`, `session` (passed to `--spawn`). Default `worktree`.
- `env`: string values, added to each child's environment (over an allowlist of the daemon's own env).
- `autoTrust` (default true): pre-accept the workspace-trust prompt (§9).
- Missing file = empty config. Invalid file on reload = daemon stays up, degraded, last good services kept. Changes apply on file change (debounced 500 ms), `claude-rc reload`, or SIGHUP.

## 4. Daemon lifecycle

1. Start IPC server first (so `status` works during upgrade).
2. Run `claude upgrade` (timeout, detached process group). Failure is logged and non-fatal.
3. Load config, reconcile.
4. On SIGTERM/SIGINT/`shutdown`: stop children, remove socket. After a daemon crash, children whose spec hash is unchanged are adopted instead of restarted.

## 5. Supervision

Each repo runs `cd <path> && claude rc --spawn <mode> --verbose` as its own service. Default is OS-native; fallback is in-process.

| Platform | Native mechanism                                                                          | Reboot behavior     |
| -------- | ----------------------------------------------------------------------------------------- | ------------------- |
| Linux    | transient systemd user unit (`systemd-run --user`, `Restart=always`)                      | unit gone on reboot |
| macOS    | launchd job in `gui/<uid>` bootstrapped from a plist outside `LaunchAgents` (`KeepAlive`) | not loaded at login |
| fallback | in-process supervisor, exponential backoff                                                | dies with daemon    |

`--supervisor systemd|launchd|inproc|auto` / `CLAUDE_RC_SUPERVISOR`. An explicit native request that is unavailable is an error, not a silent downgrade. A manual `stop` sticks across reloads.

## 6. CLI surface

`claude-rc [status|list|add <name> <path>|remove <name>|restart [name]|start [name]|stop [name]|reload|trust [name]|ui [--print]|logs <name> [-f]|config|doctor|shutdown|--version|--help]`. Exit codes: 0 ok, 1 error, 2 usage, 3 daemon not running.

## 7. IPC

Unix socket `~/.claude/daemon/rc.sock` (short-path fallback when too long), mode 0600, newline-delimited JSON: request `{cmd, ...}` → response `{ok, ...}`. Commands: ping, status, reload, restart, stop, start, shutdown. (`claude-rc ui` reads `run/ui.json` directly; it needs no IPC command.) A stale socket is replaced; a live one refuses a second daemon.

## 8. Platform support

macOS (launchd), Ubuntu / Debian / Fedora (systemd user manager; inproc if none, e.g. containers). CI covers all four; see §11 for what is not verifiable in every environment.

## 9. TTY / workspace trust

`claude rc` prompts to trust the directory and fails without a TTY. The daemon (or `claude-rc trust`) sets `projects[<key>].hasTrustDialogAccepted = true` in `~/.claude.json` (key = git root of the repo, main checkout for worktrees; never `$HOME`). Writes are atomic and mode-preserving; a corrupt file is refused.
Terminal: every child runs as `claude-rc-daemon pty-run -- claude rc ...`. `pty-run` allocates a pseudo-terminal (Bun `terminal` spawn option), runs the command on it, mirrors its output to stdout (the service log), forwards SIGTERM/SIGINT/SIGHUP, and exits with the child's code. Supervisors therefore track one long-lived process that owns the PTY. Disable with `CLAUDE_RC_PTY=0`.
tmux was evaluated and rejected as the default: `tmux new-session -d` returns in milliseconds and leaves the real process in the tmux server, so systemd/launchd would see the service "exit" and restart it in a loop (measured: 16 ms). It remains available as a future last resort.
Verified: the e2e test uses a fake `claude` that exits 1 without a TTY, passing on Linux and macOS CI via `pty-run`. Not verified: the real `claude rc`, which checks for a full-scope `claude auth login` token before anything else and refuses to run inside cloud sessions, so it cannot be exercised in CI without a real login.

## 10. Packaging & release

Tag `claude-rc-vX.Y.Z` → `.github/workflows/release-claude-rc.yaml` builds `bun build --compile` binaries (darwin/linux × arm64/x64), uploads tarballs and sha256 to a GitHub release, renders `apps/claude-rc-cli/Formula/claude-rc.rb.gotmpl` with gomplate and opens a PR to nsheaps/homebrew-devsetup. The formula installs both binaries and defines a `service` block (`brew services start claude-rc`).

## 11. Test strategy

Tests were written first. Unit tests per module; supervisors tested through a fake `exec`; e2e (`apps/claude-rc-cli/src/e2e.test.ts`) runs the real daemon and CLI processes against a fake `claude` in a temp HOME. `claude-rc-e2e.yaml` runs them on ubuntu/debian/fedora containers (inproc), ubuntu with systemd, and macOS with launchd.
Not verified in the authoring sandbox: real `claude rc`, real systemd/launchd, brew install of the formula.

## 12. Security

Socket 0600; `~/.claude.json` writes atomic, mode-preserving; daemon env is allowlisted before passing to children; config `env` is plain text in `rc.json` (keep file private); logs never print env values.

## 12a. Notifications, update checks, local web UI

**Notifications.** The daemon polls service state (default every 10 s) and notifies when a repo's `claude rc` starts, exits on its own, or is auto-restarted. A user-initiated `stop` is not an exit. macOS uses `osascript`; Linux uses `notify-send` (libnotify) and silently does nothing if it is absent (`claude-rc doctor` warns). Config: `notifications: {enabled, onStart, onExit}` (all default true). Notification failures never affect supervision.

**Update checks.** At most once per 24 h (timestamp persisted in `state.json`, so daemon restarts do not re-check), the daemon compares the installed claude-rc against the latest non-draft, non-prerelease `claude-rc-v*` GitHub release, and the installed Claude Code (`claude --version`) against npm `@anthropic-ai/claude-code` latest. Each new version is announced once. claude-rc updates point at `brew upgrade claude-rc`; Claude Code updates are applied by the daemon's `claude upgrade` on its next start. Config: `updates: {claudeRc, claude}` (default true). A failed source is logged and does not block the other; `lastCheck` only advances if a source answered. Latest known versions appear in `status` under `updates`.

**Local web UI.** The daemon serves a settings/monitor page on `127.0.0.1` (config `ui.port`, default 47474, `0` = ephemeral; falls back to a free port if taken; change needs a daemon restart). `claude-rc ui` opens it (`--print` prints the URL). The address and a per-run random token are recorded in `~/.claude/daemon/run/ui.json` (0600). The page lists repos with state, restart/start/stop/remove, adds repos, and edits spawn, autoTrust, env, notifications, updates and the UI port. Edits go through the same validate-then-atomic-write path as the CLI and then trigger a reload.
Protections: token on every request (constant-time compare; the page reads it from `?token=` and strips it from the URL, it is never embedded in served HTML); `Host` must be loopback and `Origin`, if sent, same-origin (DNS rebinding, CSRF); mutating requests must be `application/json`; a strict CSP; DOM built with `textContent` only.
API: `GET /api/status|config`, `POST /api/reload`, `PUT /api/settings`, `POST /api/repos`, `DELETE /api/repos/:name`, `POST /api/repos/:name/(restart|start|stop)`.

## 13. Decisions log

| #   | Decision                                                                                                                                                                                                                                                                 | Date                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| D1  | Layout `lib/` + `services/` + `apps/`                                                                                                                                                                                                                                    | 2026-10-12                               |
| D2  | Compiled binaries per platform; per-app tag `claude-rc-vX.Y.Z`                                                                                                                                                                                                           | 2026-10-12                               |
| D3  | Pre-trust via `~/.claude.json`; PTY before tmux; ask before tmux                                                                                                                                                                                                         | 2026-10-12                               |
| D4  | OS-native supervision default, in-process fallback or flag                                                                                                                                                                                                               | 2026-10-12                               |
| D5  | Daemon defaults: non-fatal upgrade failure, degraded on bad config, children stop on daemon SIGTERM, no third-party runtime deps                                                                                                                                         | 2026-10-12 (defaults; user may override) |
| D6  | PTY via built-in `pty-run` (not tmux): tmux detaches from the supervisor                                                                                                                                                                                                 | 2026-10-12                               |
| D7  | No native tray icon: notifications + a local web page opened by `claude-rc ui`. A tray needs a native toolkit (AppIndicator on Linux, NSStatusItem on macOS) that cannot be built with the monorepo's TypeScript-only stack, and would split the compiled-binary release | 2026-10-13                               |
