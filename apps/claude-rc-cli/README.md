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
claude-rc logs <name> [-f]
claude-rc config            print the config path and contents
claude-rc doctor            check claude, config, service manager, daemon
claude-rc shutdown          stop the daemon (and its children)
```

Exit codes: 0 ok, 1 error, 2 usage, 3 daemon not running.

See `docs/specs/draft/claude-rc.md` for the design.

## Build

```bash
bun run scripts/build-binary.ts --version 0.1.0 [--target linux-x64]
```
