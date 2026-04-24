---
name: directory-taxonomy
status: draft
description: Canonical directory paths for agent configuration, distinguishing project-level, user-level, and per-agent directories
owner: nate
created: 2026-04-24
updated: 2026-04-24
tags:
  - infrastructure
  - configuration
  - agents
---

# Agent Directory Taxonomy

## Directory Types

| Path                               | Scope                       | Description                                                                                        | Example                                             |
| ---------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `~/.claude/`                       | User/system                 | Shared between all agents on the machine. Plugins, marketplace cache, channels, global settings    | `~/.claude/settings.json`                           |
| `$CLAUDE_PROJECT_DIR/.claude/`     | Project                     | Per-repo config, checked into git. Rules, skills, settings, agents                                 | `<agent-repo>/.claude/settings.json`                |
| `~/.agents/${AGENT_NAME}/.config/` | Per-agent runtime           | Runtime-generated config (tokens, PEM keys, env files). NOT checked in.                            | `~/.agents/jack/.config/github-app-env`             |
| `~/.agents/${AGENT_NAME}/.claude/` | Per-agent settings (future) | Per-agent Claude settings dir via `CLAUDE_SETTINGS_DIR`. Isolates plugins, channels, etc.          | `~/.agents/jack/.claude/settings.json`              |
| `<agent-repo>/.claude/`            | Agent project               | The agent's own repo-level config (same as `$CLAUDE_PROJECT_DIR` when working in the agent's repo) | `/home/nsheaps/src/nsheaps/.ai-agent-jack/.claude/` |

## Environment Variables

| Variable              | Points To                                | Set By                                   |
| --------------------- | ---------------------------------------- | ---------------------------------------- |
| `CLAUDE_PROJECT_DIR`  | Current working directory's project root | Claude Code (automatic)                  |
| `CLAUDE_SETTINGS_DIR` | Per-agent settings directory (future)    | `bin/agent` harness                      |
| `AGENT_NAME`          | Agent identifier (e.g., "jack")          | 1Password ENVIRONMENT item               |
| `AGENT_CONFIG_DIR`    | `~/.agents/${AGENT_NAME}/.config/`       | github-app plugin's `lib/agent-paths.sh` |

## Key Distinctions

### `~/.claude/` is shared infrastructure

This directory is shared by **all agents and users on the machine**. Writing
agent-specific configuration here will bleed across agents. Examples of what
belongs here vs. what does not:

| Belongs in `~/.claude/`       | Does NOT belong in `~/.claude/` |
| ----------------------------- | ------------------------------- |
| Marketplace plugin cache      | Agent-specific channels config  |
| Global settings (theme, etc.) | Per-agent token files           |
| System-wide MCP server config | Agent-specific rules or skills  |

### `<agent-repo>/.claude/` is the agent's identity

Each agent's repo contains its configuration checked into git. This is the canonical
source of truth for:

- Rules (`.claude/rules/`)
- Skills (`.claude/skills/`)
- Agents (`.claude/agents/`)
- Project-level settings (`.claude/settings.json`)

When Claude Code runs inside an agent's repo, `$CLAUDE_PROJECT_DIR` points here.

### `~/.agents/${AGENT_NAME}/.config/` is runtime-only

Runtime secrets and generated files go here — never committed. Examples:

- GitHub App installation tokens
- Private key PEM files
- Env files with injected secrets

This path is created and managed by the agent harness and github-app plugin.

### `~/.agents/${AGENT_NAME}/.claude/` is future isolation

Per-agent Claude settings isolation is tracked in
[agents#116](https://github.com/nsheaps/agents/issues/116). When implemented,
`CLAUDE_SETTINGS_DIR` will point here, giving each agent its own plugin marketplace,
channel configs, and settings — isolated from other agents on the same machine.

## Related

- `docs/specs/agents-cli.md` — Per-Agent `.claude/` Directory Standard
- [agents#116](https://github.com/nsheaps/agents/issues/116) — Per-agent settings isolation tracking issue
- `docs/specs/tilt-orchestration.md` — Per-Agent Configuration section (how Tilt uses these directories)
