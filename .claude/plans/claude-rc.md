# Plan: claude-rc (CLI + daemon + Homebrew formula)

Status legend: [ ] todo · [~] in progress · [x] done · [?] blocked on user decision

## Goal

Homebrew formula `claude-rc` (published to nsheaps/homebrew-devsetup) installing:

- `claude-rc` — CLI to interact with the daemon
- `claude-rc-daemon` — service run via `brew services` (launchd on macOS, systemd --user on Linux)

Daemon on startup: (1) `claude upgrade`; (2) read `~/.claude/daemon/rc.json`
(`{repos:[{name,path}], spawn, env}`); (3) per repo run
`cd <path> && claude rc --spawn <spawn> --verbose`; (4) if possible, run each repo's
`claude rc` as its own OS-level service that auto-restarts on exit but does NOT
survive reboot on its own (the daemon recreates them on boot).
Platforms: macOS, Ubuntu, Debian, Fedora. Tests first. Same libs as monorepo.

## Findings so far (verified, with evidence)

- [x] Monorepo = nx + bun + TS; every package needs `format`/`lint`/`build`/`test` scripts
      (docs/MONOREPO.md). Tools: bun test, prettier, tsc. No runtime deps used yet by any
      app/service (no CLI-arg lib, no schema lib) -> "same libraries" = bun + TS + node types only.
- [x] `apps/*` = run-and-exit CLIs that manage services via IPC; `services/*` = daemons
      (docs say container images). `apps/README.md`, `services/README.md`.
- [x] `Formula/TODO.md`: formulas should move to `apps/<name>/Formula/` ("every package is a
      ts package even if we publish a ruby file"). Current `release.yaml` is ONE whole-repo
      release-it tag whose tarball feeds `Formula/*.gotmpl` -> gomplate -> PR to homebrew-devsetup.
- [x] `claude remote-control` (alias `rc`) flags `--spawn worktree` and `--verbose` exist
      (code.claude.com/docs/en/remote-control). `--spawn` modes: same-dir|worktree|session.
- [x] CONSTRAINT: `claude rc` asks `Trust <dir>? [y/N]`; with stdin/stdout not a TTY it exits
      `Workspace not trusted` unless dir already trusted. Never saved for $HOME.
- [x] `claude rc` is unavailable in this cloud session -> e2e needs a fake `claude` stub
      on PATH; real-claude smoke test must be run by user on a laptop.
- [x] Sandbox: Ubuntu 24.04, no systemd running, no launchctl, no brew -> real service
      supervision can't be exercised here; use containers/VMs or adapters + fakes (see Tests).

## Decisions (user-approved 2026-10-12)

- D1 Layout: `lib/claude-rc-core` (shared), `services/claude-rc-daemon` (bin `claude-rc-daemon`),
  `apps/claude-rc-cli` (bin `claude-rc`). Formula template lives at
  `apps/claude-rc-cli/Formula/claude-rc.rb.gotmpl` (follows Formula/TODO.md; NEW pattern: first
  formula inside an app dir, rendered by its own workflow).
- D2 Release: NEW pattern — per-app release `claude-rc-vX.Y.Z`; `bun build --compile` for
  darwin-arm64/darwin-x64/linux-x64/linux-arm64; assets + sha256 on a GitHub release; formula
  downloads the per-platform asset; PR to homebrew-devsetup like release.yaml does today.
- D3 Workspace trust (user clarified Q3 meant the trust prompt): pre-trust repos by setting `projects[<key>].hasTrustDialogAccepted=true` in
  `~/.claude.json` (documented mechanism; user explicitly authorized). Key = git root (main
  checkout for worktrees) else the dir; never $HOME. `autoTrust` (default true) in rc.json;
  `claude-rc trust` does it explicitly. Atomic read-modify-write (claude edits the file too).
  UNVERIFIED here: that `claude rc` runs fully headless once trusted -> user smoke test;
  PTY wrapper stays a documented fallback if it needs a TTY.
- D4 Supervision: OS-native default (systemd --user transient units / launchd job bootstrapped
  from a runtime dir outside LaunchAgents); in-process supervisor when native is unavailable
  or when `--supervisor inproc` / `CLAUDE_RC_SUPERVISOR=inproc`.
- D5 TTY ladder (user, 2026-10-12): if `claude rc` still needs a TTY after pre-trust ->
  (1) find a way around it (PTY via Bun spawn `terminal` / `script(1)`), (2) ONLY as last
  resort manage tmux sessions — MUST ASK USER BEFORE trying tmux.
- My defaults (flag if you disagree): `claude upgrade` failure is non-fatal (logged);
  invalid rc.json -> daemon stays up degraded (no crash loop); daemon SIGTERM stops its
  children (OS-native children are adopted again if still running after a crash);
  no third-party runtime deps (monorepo has none) — hand-rolled validation + arg parsing.

## Work breakdown (tests first at each step)

1. [x] Decisions Q1-Q4 recorded in spec
2. [x] Spec outline -> filled in (`docs/specs/draft/claude-rc.md`)
3. [x] Scaffold packages (lib/claude-rc-core, services/claude-rc-daemon, apps/claude-rc-cli)
4. [x] Config module: parse/validate rc.json
5. [x] Supervisor adapters: systemd-user, launchd, in-process (fake-exec contract tests)
6. [x] Daemon startup sequence: upgrade -> load config -> reconcile services
7. [x] CLI: status, list, add/remove, restart/start/stop, reload, trust, logs, config, doctor, shutdown, version
8. [x] IPC (unix socket, NDJSON) daemon<->CLI; e2e with real processes + fake claude
9. [x] Formula template (`apps/claude-rc-cli/Formula/claude-rc.rb.gotmpl`), binary build script, release workflow
10. [x] CI workflow: ubuntu/debian/fedora containers (inproc), native systemd (ubuntu) + launchd (macOS)
11. [~] READMEs, changelog, PR
    11a. [x] Notifications (osascript / notify-send), start/exit events, daily update check (claude-rc + Claude Code), local web UI + `claude-rc ui` (user choices 2026-10-13: no native tray; web page; check both). Tests first; e2e covers notify-send fake + web API.
12. [?] UNVERIFIED here (needs user/CI): real `claude rc` headless after pre-trust, real systemd/launchd runs, brew install of formula. If `claude rc` still needs a TTY: try PTY first; ask before any tmux.
