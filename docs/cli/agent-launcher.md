# agent-launcher

Declarative agent lifecycle manager. Reads `.claude/agents/*.md` files and spawns, manages, and monitors agent teammates.

> **Status**: Phase 1 — planned. See [agent-launcher spec](../specs/draft/agent-launcher.md) for full design.

## Synopsis

```
agent-launcher --team-name <name> <command> [args]
```

## Global Flags

| Flag | Env Var | Default | Description |
|:-----|:--------|:--------|:------------|
| `--team-name <name>` | `AGENT_TEAM_NAME` | (required) | Team name for config and coordination |
| `--teammate-mode <mode>` | `CLAUDE_TEAM_DEFAULT_MODE` | `auto` | Teammate display mode: `auto`, `in-process`, `tmux` |
| `--no-interactive` | — | — | Skip interactive prompts, use defaults |
| `--project-root <path>` | — | git root or cwd | Override project root for agent discovery |
| `--verbose` | — | — | Verbose output |
| `--` | — | — | Pass remaining args through to `claude` CLI |

## Commands

### `start`

Launch the orchestrator (lead session) with team configuration.

```bash
agent-launcher --team-name looney-tunes start
```

This is the primary entry point. It:

1. Discovers agents from `.claude/agents/*.md`
2. Runs auto-cleanup of stale config entries
3. Launches the orchestrator with `--append-system-prompt`
4. Auto-launches `tmux -CC` if not already in tmux (iTerm2 integration)

The orchestrator then spawns teammates via `Task` tool or the `launch` command.

<!-- TODO: Document the tmux -CC auto-launch flow in detail -->
<!-- TODO: Document hooks configuration (SessionStart, Stop) -->

### `launch`

Spawn one or all agents.

```bash
# Single agent
agent-launcher --team-name looney-tunes launch <agent-name>

# All discovered agents
agent-launcher --team-name looney-tunes launch --all
```

**Flow:**

1. Resolve agent by name from `.claude/agents/<agent-name>.md`
2. Assemble prompt (EXTEND or REPLACE mode)
3. Build CLI flags from agent frontmatter
4. Run pre-launch cleanup (remove stale entries for this agent name)
5. Spawn via `Task` tool with `team_name` parameter
6. Verify agent appears in team config

<!-- TODO: Document prompt assembly modes (EXTEND vs REPLACE) in detail -->
<!-- TODO: Document batch launch ordering and error handling -->

### `kill`

Terminate an agent and clean up its config entry.

```bash
agent-launcher --team-name looney-tunes kill <agent-name>
```

**Flow:**

1. Find agent in `~/.claude/teams/{team-name}/config.json`
2. Send `shutdown_request` via `SendMessage` (graceful, 10s timeout)
3. If no acknowledgment: force kill tmux pane
4. Remove agent entry from config
5. Verify removal

<!-- TODO: Document error cases (agent not found, pane already dead, config locked) -->

### `relaunch`

Kill + launch in one command. Picks up any changes to the agent file.

```bash
agent-launcher --team-name looney-tunes relaunch <agent-name>
```

Guarantees no `-2` suffix entries because the old entry is fully removed before the new spawn.

### `list`

Show all agents — both discovered (from files) and running (from config).

```bash
agent-launcher --team-name looney-tunes list
```

**Example output:**

```
Agent                    File    Config   Status
ai-agent-eng             yes     yes      RUNNING
deep-researcher          yes     yes      RUNNING
docs-writer              yes     no       NOT SPAWNED
ops-eng                  yes     no       NOT SPAWNED
orchestrator             yes     yes      RUNNING
project-manager          yes     no       NOT SPAWNED
quality-assurance        yes     no       NOT SPAWNED
software-eng             yes     yes      DEAD (stale)
```

### `health`

Check backend health for running agents.

```bash
agent-launcher --team-name looney-tunes health
```

Cross-references config entries against actual running backends (tmux panes).

**Example output:**

```
Agent                    Status    Backend     Pane
Bugs B (software-eng)    RUNNING   tmux        %42
Wile E (ai-agent-eng)    DEAD      tmux        %38 (pane not found)
Road R (researcher)      RUNNING   tmux        %44
```

**Health statuses:**

| Status | Meaning |
|:-------|:--------|
| `RUNNING` | Config entry exists, tmux pane alive |
| `DEAD` | Config entry exists, tmux pane not found (stale) |
| `UNKNOWN` | Config entry exists but no tmux pane ID |
| `NOT_SPAWNED` | Agent file exists but no config entry |

### `cleanup`

Remove stale config entries (runs automatically before every `launch`).

```bash
agent-launcher --team-name looney-tunes cleanup
```

## Agent File Format

Agents are defined as markdown files with YAML frontmatter in `.claude/agents/*.md`.

```yaml
---
name: software-eng
description: |
  Use this agent for implementation tasks.
color: cyan
prompt_mode: extend        # extend (default) or replace
base_prompt: _builtin      # _builtin (default) or path to file
framework: claude-code
model: claude-opus-4-6
permission_mode: delegate
display_name: "Bugs B (software-eng)"
tools:
  - Read
  - Edit
  - Write
  - Bash
disallowed_tools: []
---
# Agent prompt content here...
```

See the [agent-launcher spec §3](../specs/draft/agent-launcher.md) for the full schema.

<!-- TODO: Document all frontmatter fields with defaults and examples -->
<!-- TODO: Document prompt assembly algorithm -->
<!-- TODO: Document tool control (whitelist/blacklist) -->

## Configuration

### Team Config

Team state is stored in:

```
~/.claude/teams/{team-name}/config.json
```

The launcher reads this file for health checks and modifies it only for cleanup operations. Claude Code's `TeamCreate` tool owns this file.

### Environment

The launcher always sets:

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

## Future: `agent` CLI (Phase 2+)

The `agent-launcher` will eventually be absorbed into a unified `agent` CLI:

```bash
# Phase 2+
agent launch <name>
agent kill <name>
agent list
agent health
```

This CLI will also support structured `agent.yaml` definitions, Docker backends, and session save/restore. See the [multi-repo phase plan](../specs/draft/multi-repo-phase-plan.md) for the roadmap.

## References

- [Agent Launcher Spec](../specs/draft/agent-launcher.md) — full design document
- [Multi-Repo Phase Plan](../specs/draft/multi-repo-phase-plan.md) — phase breakdown
- [Agent Team Architecture](../specs/draft/agent-team-architecture.md) — design topics
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Claude Code CLI Usage](https://code.claude.com/docs/en/cli-usage)
