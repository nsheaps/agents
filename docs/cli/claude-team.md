# claude-team

Shell scripts for launching agent team sessions with Claude Code.

Two modes exist — **persistent** (teammates stay alive between tasks) and **ephemeral** (teammates are spun up and down per task).

## Scripts

| Script                       | Path                             | Mode                 |
| :--------------------------- | :------------------------------- | :------------------- |
| `run-claude-team-persistent` | `bin/run-claude-team-persistent` | Persistent teammates |
| `run-claude-team-ephemeral`  | `bin/run-claude-team-ephemeral`  | Ephemeral teammates  |

## Usage

```bash
# From the agent-team repo root:
bin/run-claude-team-persistent
# or
bin/run-claude-team-ephemeral
```

Or via the `claude-team` / `ct` alias from [claude-utils](https://github.com/nsheaps/claude-utils):

```bash
claude-team
ct
```

## Environment Variables

| Variable                               | Required          | Description                                          |
| :------------------------------------- | :---------------- | :--------------------------------------------------- |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Set automatically | Enables agent teams feature                          |
| `CLAUDE_TEAM_DEFAULT_MODE`             | No                | Default teammate mode (`auto`, `in-process`, `tmux`) |

## Flags Passed to Claude

Both scripts pass these flags to the `claude` CLI:

| Flag                             | Value               | Purpose                      |
| :------------------------------- | :------------------ | :--------------------------- |
| `--teammate-mode`                | `auto`              | How teammates are displayed  |
| `--append-system-prompt`         | Orchestrator prompt | Inject orchestrator identity |
| `--dangerously-skip-permissions` | —                   | Skip permission prompts      |

## Persistent vs Ephemeral

### Persistent Mode

- Teammates are launched at session start and stay alive
- Teammates idle between tasks, preserving context
- Best for long sessions with multiple tasks
- Teammates collaborate and build on each other's knowledge

### Ephemeral Mode

- Teammates are spun up per task and shut down when done
- Fresh context on each task
- Best for isolated, independent tasks
- Lower resource usage but higher startup cost per task

## Planned Commands

> These commands are aspirational — they describe the future `claude-team` CLI interface. Implementation is tracked in the [agent-launcher spec](../specs/draft/agent-launcher.md).

### `claude-team init`

<!-- TODO: Define what init does — create team config? Initialize agent files? -->

Initialize a new agent team configuration.

```bash
claude-team init [--team-name <name>] [--template <template>]
```

### `claude-team start`

Start the orchestrator and optionally spawn all teammates.

```bash
claude-team start [--team-name <name>] [--teammate-mode <mode>]
```

Equivalent to the current `run-claude-team-persistent` script but with declarative configuration.

### `claude-team stop`

<!-- TODO: Define graceful shutdown behavior -->

Gracefully shut down all teammates and the orchestrator.

```bash
claude-team stop [--team-name <name>]
```

### `claude-team status`

<!-- TODO: Define status output format -->

Show the current state of the team — which agents are running, idle, or dead.

```bash
claude-team status [--team-name <name>]
```

## Migration Path

`claude-team` will be superseded by `agent-launcher` (Phase 1) and eventually `agent` (Phase 2+). See [agent-launcher.md](./agent-launcher.md) for the replacement CLI.

## References

- [Launch Guide](../LAUNCH-GUIDE.md) — step-by-step launch instructions
- [Agent Launcher Spec](../specs/draft/agent-launcher.md) — replacement CLI design
- [claude-utils repo](https://github.com/nsheaps/claude-utils) — Homebrew-distributed `claude-team` / `ct`
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
