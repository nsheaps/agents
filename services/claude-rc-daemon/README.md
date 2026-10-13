# claude-rc-daemon

Daemon behind [`claude-rc`](../../apps/claude-rc-cli/README.md). On start it runs `claude upgrade`, reads `~/.claude/daemon/rc.json`, and runs `claude rc --spawn <mode> --verbose` in each repo as its own service. Services restart when they exit but do not return on reboot; the daemon does and recreates them.

```
claude-rc-daemon [--supervisor auto|systemd|launchd|inproc]
```

`auto` uses systemd user units on Linux and launchd on macOS, falling back to an in-process supervisor. Also settable with `CLAUDE_RC_SUPERVISOR`.

Each `claude rc` runs inside a private per-repo tmux session when tmux is installed (`terminal: auto`), via an internal `claude-rc-daemon tmux-run` keeper that the service manager supervises; otherwise it gets a plain pseudo-terminal (`pty-run`). Override tmux with `CLAUDE_RC_TMUX_BIN`. The daemon health-checks each session (`ok`/`attention`/`down`/`crash-loop`), serves the local web UI with an in-browser terminal, and can restart repos after a Claude Code update once they are idle. See the [`claude-rc` README](../../apps/claude-rc-cli/README.md#sessions-in-tmux).
