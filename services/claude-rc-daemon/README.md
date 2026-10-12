# claude-rc-daemon

Daemon behind [`claude-rc`](../../apps/claude-rc-cli/README.md). On start it runs `claude upgrade`, reads `~/.claude/daemon/rc.json`, and runs `claude rc --spawn <mode> --verbose` in each repo as its own service. Services restart when they exit but do not return on reboot; the daemon does and recreates them.

```
claude-rc-daemon [--supervisor auto|systemd|launchd|inproc]
```

`auto` uses systemd user units on Linux and launchd on macOS, falling back to an in-process supervisor. Also settable with `CLAUDE_RC_SUPERVISOR`.
