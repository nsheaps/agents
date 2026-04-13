---
name: agents-cli
status: draft
description: Command-line interface for managing agent runtime, deployment, and configuration
parent: agent-launcher
related:
  - agent-harness-lifecycle
  - claude-team-cli
owner: nate
created: 2026-04-13
updated: 2026-04-13
tags:
  - agents-cli
  - agent-management
  - cli-interface
source: https://discord.com/channels/1490863845252665415/1490930230360018944/1493300758962110524
---

# agents CLI Specification

## Overview

`agents` is a command-line interface for managing agent runtime, deployment, and configuration. It provides commands to start/stop/manage agent services, pull agent definitions from GitHub, push local changes, and execute one-shot prompts.

### Goals

1. **Unified control**: Single CLI to start, stop, restart, and inspect agents
2. **Auto-discovery**: Find agent definitions by walking up the filesystem
3. **Environment sync**: Automatically set up symlinks between local and global agent directories
4. **GitHub-backed**: Pull agent definitions from GitHub repositories, push changes back
5. **Runtime isolation**: Each agent has isolated config and state in `~/.agents/`

### Non-Goals

- Agent team orchestration (that's `claude-team` CLI)
- Interactive debugging of running agents (use `claude --resume` for that)
- Plugin management (that's `claude plugin`)

### Relationship to Existing Tools

| Tool                        | Purpose                                    |
| :-------------------------- | :----------------------------------------- |
| `agents` (this spec)        | Agent runtime management (start/stop/run) |
| `claude-team`               | Team configuration and agent definitions  |
| `agent-launcher` / `bin/agent` | Individual agent session lifecycle         |
| `claude --resume`           | Reconnect to running agent                |

---

## Architecture Concepts

### Agent Discovery

When no name/ref is provided as an argument, the `agents` CLI walks up the directory tree from the current working directory to find `agent.yaml`. This enables:

```bash
cd /path/to/agent/project
agents run          # Finds ./agent.yaml automatically
agents push         # Pushes from discovered agent root
```

### Global Agent Store

Each agent has a canonical location in the global agent store:

```
~/.agents/{agentName}/
├── agent.yaml                     # Agent definition
├── .source -> /path/to/local/src  # Symlink to local source (if in-repo)
└── .claude/
    ├── commands/   -> local .claude/commands/
    ├── rules/      -> local .claude/rules/
    ├── skills/     -> local .claude/skills/
    └── settings.json -> local .claude/settings.json
```

When an agent is started, it syncs `.claude/` directories from the local repo (via symlinks) into the global store, ensuring the agent uses the current configuration.

### Operation Modes

The `push` command behaves differently depending on context:

1. **From within an agent runtime** (as child process):
   - Uses parent PID to detect
   - Auto-pushes changes from local repo to remote
   - No manual ref needed

2. **From outside agent runtime**:
   - Uses `find-up` to locate `agent.yaml`
   - Pushes from that agent's root directory
   - Requires explicit ref or uses local configuration

---

## Commands

### `agents start [name]`

Starts an agent service.

#### Usage

```bash
# Start with auto-discovery
agents start

# Start by explicit name
agents start jack

# Start by GitHub reference
agents start nsheaps/agents#jack
```

#### Behavior

1. Discovers agent definition (local `agent.yaml` or registry)
2. Sets up `~/.agents/{name}/` with symlinks to `.claude/` config
3. Launches agent service in background
4. Returns immediately (does not wait)

#### Exit Codes

- `0`: Service started successfully
- `1`: Agent definition not found
- `2`: Service already running
- `3`: Configuration error (bad symlink setup, etc.)

---

### `agents stop [name]`

Stops a running agent service.

#### Usage

```bash
agents stop
agents stop jack
```

#### Behavior

1. Finds running agent by name
2. Sends graceful shutdown signal
3. Waits up to 10s for clean exit
4. Kills forcefully if timeout exceeded

#### Exit Codes

- `0`: Service stopped successfully
- `1`: Service not found
- `2`: Service did not stop cleanly (force-killed)

---

### `agents enable [name]`

Marks an agent to start on system boot (persistent).

#### Usage

```bash
agents enable jack
agents enable nsheaps/agents#henry
```

#### Behavior

- Registers agent in system startup (implementation platform-dependent)
- Agent will auto-start on next boot/restart
- Requires agent to be registered in local or GitHub registry

---

### `agents disable [name]`

Removes agent from system startup.

#### Usage

```bash
agents disable jack
```

#### Behavior

- Removes agent from startup registration
- Does not stop currently running agent (`agents stop` for that)

---

### `agents restart [name]`

Restarts a running agent service.

#### Usage

```bash
agents restart
agents restart jack
```

#### Behavior

1. Stops the service (graceful shutdown)
2. Waits for clean exit
3. Starts the service again
4. Returns once started (does not wait for full startup)

---

### `agents run [name]`

Runs an agent in foreground with auto-restart.

#### Usage

```bash
# Auto-discovery
agents run

# Explicit name
agents run jack
```

#### Behavior

1. Discovers agent definition
2. Sets up configuration symlinks
3. Launches agent in foreground (blocking)
4. On exit, restarts automatically (unless manually killed with Ctrl+C twice)
5. Useful for development and debugging

#### Exit Codes

- `0`: Manual termination (Ctrl+C)
- `1`: Configuration error
- `2`: Agent crashed and auto-restart disabled

---

### `agents pull <ref>`

Pulls agent definition from GitHub repository.

#### Usage

```bash
# Pull from GitHub (docker-like reference)
agents pull nsheaps/agents#jack
agents pull nsheaps/agents#jack@v1.0.0
agents pull nsheaps/agents              # Pulls all agents from repo

# Pull from specific branch
agents pull nsheaps/agents@main#jack
```

#### Behavior

1. Parses GitHub reference: `{owner}/{repo}[#{name}][@{ref}]`
2. Clones or updates local cache from GitHub
3. Extracts agent definition to `~/.agents/{name}/agent.yaml`
4. Sets up `.source` symlink to cache location (if requested)
5. Syncs `.claude/` configuration

#### Reference Format

```
{owner}/{repo}                    # Clone entire repo
{owner}/{repo}#{agent-name}       # Clone repo, extract specific agent
{owner}/{repo}@{branch}#{agent}   # From specific branch
{owner}/{repo}@v1.0.0#{agent}     # From specific tag
```

#### Exit Codes

- `0`: Pull successful
- `1`: Repository not found
- `2`: Agent definition not found in repository
- `3`: Network error

---

### `agents push [--force]`

Pushes local agent changes back to remote repository.

#### Usage

```bash
# From within agent runtime (auto-detects parent PID)
agents push

# From agent root directory
agents push

# Force push (destructive, overwrites remote)
agents push --force
```

#### Behavior

**When run from within agent runtime (parent PID detected):**
- Commits outstanding changes from local repo
- Pushes to remote repository
- Uses agent's configured git remote
- No manual ref needed

**When run from outside agent runtime:**
- Uses `find-up` to locate `agent.yaml`
- Commits and pushes from that directory
- Requires git remote to be configured

#### Flags

| Flag      | Type | Default | Description                     |
| :-------- | :--- | :------ | :------------------------------ |
| `--force` | bool | false   | Force push (overwrites remote)  |

#### Exit Codes

- `0`: Push successful
- `1`: No changes to push
- `2`: Git error (no remote, etc.)
- `3`: Permission denied (insufficient GitHub token)

---

### `agents ask [-p prompt] [name]`

Execute a one-shot prompt against an agent.

#### Usage

```bash
# Interactive prompt
agents ask
agents ask jack

# One-liner (with -p flag)
agents ask -p "What is your current status?" jack
agents ask -p "List all tasks" < task-query.txt
```

#### Behavior

1. Starts agent session temporarily
2. Injects prompt at session start
3. Returns agent's response
4. Cleans up (does not leave agent running)

#### Flags

| Flag | Type   | Default | Description              |
| :--- | :----- | :------ | :----------------------- |
| `-p` | string | (stdin) | Prompt text              |

#### Exit Codes

- `0`: Query executed successfully
- `1`: Agent not found
- `2`: Agent failed to respond
- `3`: Prompt execution timeout

---

## Global Flags

Available on all commands:

| Flag          | Type   | Default | Description                           |
| :------------ | :----- | :------ | :------------------------------------ |
| `--help`      | bool   | false   | Show help for the command             |
| `--version`   | bool   | false   | Show CLI version                      |
| `--verbose`   | bool   | false   | Show detailed output (logs, steps)    |
| `--quiet`     | bool   | false   | Suppress non-error output             |
| `--config`    | string | `"~"` | Home directory for `~/.agents/` store |

---

## Directory Structure

### Local Agent Project

```
{project}/
├── agent.yaml              # Agent definition (name, description, etc.)
├── bin/
│   └── agent               # Launch script (from agent-harness-lifecycle)
├── .claude/
│   ├── commands/           # Custom slash commands
│   ├── rules/              # Behavior rules
│   ├── skills/             # Operational skills
│   ├── settings.json       # Claude Code configuration
│   ├── MEMORY.md           # Agent memory index
│   ├── memory/             # Memory files
│   └── prompts/            # Prompt templates
└── docs/
    └── specs/              # Specifications
```

### Global Agent Store

```
~/.agents/
├── {agentName}/
│   ├── agent.yaml          # Canonical agent definition
│   ├── .source             # Symlink to local project (if applicable)
│   ├── .claude/            # Config symlinks
│   │   ├── commands/
│   │   ├── rules/
│   │   ├── skills/
│   │   ├── settings.json
│   │   ├── MEMORY.md
│   │   └── memory/
│   └── .state/             # Runtime state (pid, status, logs)
└── ...
```

---

## Configuration Sync

When an agent starts, the `agents` CLI establishes symlinks:

```bash
~/.agents/{name}/.claude/commands     -> {project}/.claude/commands
~/.agents/{name}/.claude/rules        -> {project}/.claude/rules
~/.agents/{name}/.claude/skills       -> {project}/.claude/skills
~/.agents/{name}/.claude/settings.json -> {project}/.claude/settings.json
```

This ensures:
- Agent always uses the current local configuration
- Changes to rules/commands/skills take effect on next start
- Multiple agents can share `.claude/` directories via symlinks

---

## Future Scope (Out of Spec)

These are noted for future iteration but explicitly out of scope:

- `agents status` -- show live status of all agents
- `agents logs [name]` -- tail logs from a running agent
- `agents registry` -- manage local agent registry
- `agents upgrade [name]` -- upgrade agent to newer version
- `agents delete [name]` -- completely remove an agent from `~/.agents/`
- Web dashboard for monitoring multiple agents

---

## Notes on Evolution

This spec is a **first capture** of Nate's vision for a unified agents CLI. It may:

- Supersede or evolve from the existing `claude-team` CLI (which focuses on team configuration rather than individual agent runtime)
- Extend or replace parts of `agent-launcher.md` as the agent harness matures
- Require coordination with the agents binary (currently non-functional per agents#18)

The focus here is capturing the command surface and discovery/configuration behavior. Implementation and platform-specific concerns (systemd, launchd, etc.) are deferred to the implementation phase.

---

## References

- [Agent Launcher Spec](agent-launcher.md) -- agent file schema and harness design
- [Agent Harness Lifecycle Spec](agent-harness-lifecycle.md) -- restart loop, session continuity, crash detection
- [claude-team CLI Spec](claude-team-cli.md) -- team configuration (complementary to this CLI)
- nsheaps/agents issues: #18 (launch/relaunch are no-ops), #111 (monorepo vision)
- nsheaps/.ai-agent-jack issues: #27 (reusable launcher template)
- Discord source: https://discord.com/channels/1490863845252665415/1490930230360018944/1493300758962110524
