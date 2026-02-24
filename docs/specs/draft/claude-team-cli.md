# claude-team CLI Specification

> **Status**: Draft
> **Author**: Tweety Bird (Docs Writer)
> **Date**: 2026-02-23
> **Task**: #92

---

## 1. Overview

`claude-team` is a CLI tool for creating and managing agent team configurations. It provides commands to create teams, create agent definitions, and add agents to teams -- replacing manual file editing with a guided workflow.

### Goals

1. **Interactive by default**: Run without flags for a guided experience; use flags for scripting
2. **File-driven output**: All commands produce files (team.yaml, agent .md files) -- the CLI doesn't run agents
3. **Convention over configuration**: Sensible defaults based on project conventions
4. **Composable**: Each command does one thing; combine them for complex workflows

### Non-Goals

- Running or launching agents (that's `bin/run-claude-team-persistent` or the agent launcher)
- Managing live team sessions (that's `claude --resume` and `SendMessage`)
- Plugin management (that's `claude plugin`)

### Relationship to Existing Tools

| Tool                             | Purpose                                         |
| :------------------------------- | :---------------------------------------------- |
| `claude-team` (this spec)        | Create/configure team and agent files           |
| `bin/run-claude-team-persistent` | Launch a team session with tmux                 |
| Agent Launcher (future)          | Declarative agent spawning from .claude/agents/ |
| `claude --resume`                | Reconnect to an existing session                |

---

## 2. Commands

### 2.1 `claude-team team create`

Creates a new team configuration file (team.yaml) and directory structure.

#### Usage

```bash
# Interactive (guided prompts)
claude-team team create

# Non-interactive (scripted)
claude-team team create --team-name my-project-team \
  --description "Team for my-project development" \
  --template default
```

#### Flags

| Flag            | Type   | Default     | Description                                                |
| :-------------- | :----- | :---------- | :--------------------------------------------------------- |
| `--team-name`   | string | (prompted)  | Team identifier (kebab-case)                               |
| `--description` | string | (prompted)  | Human-readable team description                            |
| `--template`    | string | `"default"` | Base template from `templates/teams/` to copy from         |
| `--output-dir`  | string | `"."`       | Directory to create the team in (relative to project root) |
| `--no-personas` | bool   | `false`     | Skip creating persona files                                |

#### Interactive Flow

```
$ claude-team team create

Team name (kebab-case): my-project-team
Description: Development team for my-project
Base template [default]:
  1. default    - Professional team, no character theming
  2. looney-toons - Looney Tunes character theming
  > 1

Creating team 'my-project-team'...
  Created: templates/teams/my-project-team/team.yaml
  Created: templates/teams/my-project-team/personas/ (8 files)
  Created: templates/teams/my-project-team/README.md

Team created. Next steps:
  1. Edit team.yaml to customize roles and system messages
  2. Run 'claude-team team add <agent-name>' to add agents
  3. Launch with 'bin/run-claude-team-persistent'
```

#### Output

Creates the following directory structure:

```
templates/teams/{team-name}/
├── team.yaml        # Team manifest (copied from template, customized)
├── personas/        # One .md file per role
│   ├── orchestrator.md
│   ├── software-eng.md
│   ├── ai-agent-eng.md
│   ├── docs-writer.md
│   ├── quality-assurance.md
│   ├── project-manager.md
│   ├── deep-researcher.md
│   └── ops-eng.md
└── README.md        # Team overview
```

#### team.yaml Format

```yaml
name: my-project-team
description: >
  Development team for my-project.

roles:
  orchestrator:
    agent_template: orchestrator
    display_name: "Team Lead"
    persona: personas/orchestrator.md
    system_message: |
      You are the team lead.
      You are calm, decisive, and protective of people's time.

  software-eng:
    agent_template: software-eng
    display_name: "Software Engineer"
    persona: personas/software-eng.md
    system_message: |
      You are a software engineer.
      You are quietly confident and prefer reading existing code before writing new code.

  # ... additional roles
```

#### Error Handling

| Condition                                      | Behavior                                                      |
| :--------------------------------------------- | :------------------------------------------------------------ |
| Team name already exists in `templates/teams/` | Error: "Team '{name}' already exists at {path}"               |
| Template not found                             | Error: "Template '{name}' not found. Available: default, ..." |
| Invalid team name (not kebab-case)             | Error: "Team name must be kebab-case: {suggestion}"           |
| No write permission                            | Error: "Cannot write to {path}: permission denied"            |

---

### 2.2 `claude-team agent create`

Creates a new agent definition file (`.claude/agents/{name}.md`).

#### Usage

```bash
# Interactive (guided prompts)
claude-team agent create

# Non-interactive (scripted)
claude-team agent create --name frontend-eng \
  --description "Frontend specialist for React and TypeScript" \
  --model claude-opus-4-6 \
  --permission-mode bypassPermissions
```

#### Flags

| Flag                 | Type   | Default               | Description                                                    |
| :------------------- | :----- | :-------------------- | :------------------------------------------------------------- |
| `--name`             | string | (prompted)            | Agent identifier (kebab-case), becomes the filename            |
| `--description`      | string | (prompted)            | When to invoke this agent (used by Claude Code for selection)  |
| `--model`            | string | (none -- use default) | Model override (e.g., `claude-opus-4-6`, `sonnet`, `haiku`)    |
| `--permission-mode`  | string | `"bypassPermissions"` | One of: default, plan, bypassPermissions, acceptEdits, dontAsk |
| `--color`            | string | (none)                | Terminal UI color for the agent                                |
| `--prompt-mode`      | string | `"extend"`            | How the agent prompt combines with base: extend or replace     |
| `--tools`            | string | (all)                 | Comma-separated whitelist of allowed tools                     |
| `--disallowed-tools` | string | (none)                | Comma-separated blacklist of tools to remove                   |
| `--output-dir`       | string | `.claude/agents/`     | Directory to create the agent file in                          |

#### Interactive Flow

```
$ claude-team agent create

Agent name (kebab-case): frontend-eng
Description (when should this agent be invoked?):
  > Frontend specialist for React and TypeScript UI work

Model override (enter for framework default):
  1. (default)
  2. claude-opus-4-6
  3. sonnet
  4. haiku
  > 1

Permission mode [bypassPermissions]:
  1. bypassPermissions (Recommended for teammates)
  2. default
  3. acceptEdits
  4. plan
  5. dontAsk
  > 1

Creating agent 'frontend-eng'...
  Created: .claude/agents/frontend-eng.md

Agent created. Next steps:
  1. Edit .claude/agents/frontend-eng.md to add role-specific instructions
  2. Run 'claude-team team add frontend-eng' to add to a team
```

#### Output File Format

Creates `.claude/agents/{name}.md`:

```markdown
---
name: frontend-eng
description: |
  Frontend specialist for React and TypeScript UI work.
permission_mode: bypassPermissions
---

# Frontend Engineer

You are a frontend engineer specializing in React and TypeScript.

## Role

[Edit this section to define the agent's responsibilities]

## Process

[Edit this section to define the agent's workflow]

## Session Start

Start your session by reading the files in .claude/docs/.
```

#### Error Handling

| Condition                                 | Behavior                                              |
| :---------------------------------------- | :---------------------------------------------------- |
| Agent name already exists                 | Error: "Agent '{name}' already exists at {path}"      |
| Invalid name (not kebab-case)             | Error: "Agent name must be kebab-case: {suggestion}"  |
| `.claude/agents/` directory doesn't exist | Create it automatically                               |
| Invalid permission mode                   | Error: "Invalid permission mode. Valid: default, ..." |

---

### 2.3 `claude-team team add`

Adds an existing agent definition to a team's configuration.

#### Usage

```bash
# Add an agent to a team
claude-team team add frontend-eng --team my-project-team

# Add with display name and persona overrides
claude-team team add frontend-eng \
  --team my-project-team \
  --display-name "Alex F (frontend)" \
  --system-message "You are Alex, a detail-oriented frontend developer."
```

#### Flags

| Flag               | Type   | Default                      | Description                                  |
| :----------------- | :----- | :--------------------------- | :------------------------------------------- |
| `--team`           | string | (prompted if multiple teams) | Team name to add the agent to                |
| `--display-name`   | string | (derived from agent name)    | Display name for this agent in the team      |
| `--system-message` | string | (prompted)                   | System message defining personality/identity |
| `--persona`        | string | (auto-generated)             | Path to persona file (relative to team dir)  |
| `--no-persona`     | bool   | `false`                      | Skip creating a persona file                 |

#### Positional Arguments

```
claude-team team add <agent-name> [flags]
```

The `<agent-name>` must match an existing `.claude/agents/{agent-name}.md` file.

#### Interactive Flow

```
$ claude-team team add frontend-eng

Which team? [my-project-team]:
  1. my-project-team
  2. looney-toons
  > 1

Display name for this agent in the team: Alex F (frontend)
System message (personality, identity -- press Enter for default):
  > You are Alex, a detail-oriented frontend developer who loves clean component architecture.

Create persona file? [Y/n]: Y

Adding 'frontend-eng' to team 'my-project-team'...
  Updated: templates/teams/my-project-team/team.yaml
  Created: templates/teams/my-project-team/personas/frontend-eng.md

Agent added. The team now has 9 roles.
```

#### What It Does

1. Validates that `.claude/agents/{agent-name}.md` exists
2. Adds a new role entry to the team's `team.yaml` under `roles:`
3. Optionally creates a persona file at `templates/teams/{team}/personas/{agent-name}.md`

#### team.yaml Entry Added

```yaml
roles:
  # ... existing roles ...
  frontend-eng:
    agent_template: frontend-eng
    display_name: "Alex F (frontend)"
    persona: personas/frontend-eng.md
    system_message: |
      You are Alex, a detail-oriented frontend developer
      who loves clean component architecture.
```

#### Error Handling

| Condition                | Behavior                                                              |
| :----------------------- | :-------------------------------------------------------------------- |
| Agent file doesn't exist | Error: "No agent found at .claude/agents/{name}.md"                   |
| Agent already in team    | Error: "Agent '{name}' already exists in team '{team}'"               |
| Team doesn't exist       | Error: "Team '{team}' not found. Run 'claude-team team create' first" |
| Only one team exists     | Auto-select it (skip prompt)                                          |

---

## 3. Additional Commands

These commands logically complete the CLI surface.

### 3.1 `claude-team team list`

Lists all available teams.

```bash
$ claude-team team list

TEAM              ROLES  TEMPLATE  LOCATION
my-project-team   9      default   templates/teams/my-project-team/
looney-toons      8      -         templates/teams/looney-toons/
```

### 3.2 `claude-team team show`

Shows details of a specific team.

```bash
$ claude-team team show my-project-team

Team: my-project-team
Description: Development team for my-project
Location: templates/teams/my-project-team/

ROLE              AGENT TEMPLATE   DISPLAY NAME
orchestrator      orchestrator     Team Lead
software-eng      software-eng     Software Engineer
ai-agent-eng      ai-agent-eng     AI Agent Eng
docs-writer       docs-writer      Docs Writer
quality-assurance quality-assurance QA Engineer
project-manager   project-manager  Project Manager
deep-researcher   deep-researcher  Deep Researcher
ops-eng           ops-eng          Ops Engineer
frontend-eng      frontend-eng     Alex F (frontend)
```

### 3.3 `claude-team team remove`

Removes an agent from a team configuration.

```bash
$ claude-team team remove frontend-eng --team my-project-team

Removing 'frontend-eng' from team 'my-project-team'...
  Updated: templates/teams/my-project-team/team.yaml
  Note: Persona file at personas/frontend-eng.md was NOT deleted.
        Remove manually if no longer needed.

Agent removed. The team now has 8 roles.
```

Flags: `--team` (string), `--delete-persona` (bool, default false).

### 3.4 `claude-team agent list`

Lists all agent definitions in the project.

```bash
$ claude-team agent list

AGENT             PERMISSION MODE     MODEL      TEAMS
orchestrator      bypassPermissions   (default)  looney-toons, my-project-team
software-eng      bypassPermissions   (default)  looney-toons, my-project-team
ai-agent-eng      bypassPermissions   (default)  looney-toons, my-project-team
frontend-eng      bypassPermissions   (default)  my-project-team
exec-assist       bypassPermissions   (default)  (none)
```

### 3.5 `claude-team agent show`

Shows details of a specific agent definition.

```bash
$ claude-team agent show frontend-eng

Agent: frontend-eng
File: .claude/agents/frontend-eng.md
Description: Frontend specialist for React and TypeScript UI work
Permission Mode: bypassPermissions
Model: (default)
Prompt Mode: extend

Used in teams:
  - my-project-team (as "Alex F (frontend)")
```

---

## 4. Global Flags

Available on all commands:

| Flag         | Type   | Default | Description               |
| :----------- | :----- | :------ | :------------------------ |
| `--help`     | bool   | false   | Show help for the command |
| `--version`  | bool   | false   | Show CLI version          |
| `--verbose`  | bool   | false   | Show detailed output      |
| `--quiet`    | bool   | false   | Suppress non-error output |
| `--no-color` | bool   | false   | Disable colored output    |
| `--cwd`      | string | `"."`   | Project root directory    |

---

## 5. File Conventions

### Agent Files

- **Location**: `.claude/agents/{name}.md`
- **Naming**: kebab-case, matches the `name` field in frontmatter
- **Format**: YAML frontmatter + markdown body (see [Agent Launcher Spec](agent-launcher.md) for schema)
- **Discovery**: All `.md` files in `.claude/agents/` are considered agent definitions

### Team Files

- **Location**: `templates/teams/{team-name}/`
- **Manifest**: `team.yaml` defines roles, display names, system messages
- **Personas**: `personas/{role-name}.md` defines personality and public voice
- **README**: `README.md` describes the team

### Runtime Config

When a team session is launched, Claude Code creates runtime state at:

- `~/.claude/teams/{team-name}/config.json` -- live team state (members, session IDs, pane IDs)
- `~/.claude/tasks/{team-name}/` -- shared task list

The `claude-team` CLI creates _templates_ (in the repo). The runtime creates _instances_ (in `~/.claude/`). These are separate concerns.

---

## 6. Validation Rules

### Team Names

- Must be kebab-case: `[a-z0-9]+(-[a-z0-9]+)*`
- Must not conflict with existing teams in `templates/teams/`
- Maximum 50 characters

### Agent Names

- Must be kebab-case: `[a-z0-9]+(-[a-z0-9]+)*`
- Must not conflict with existing agents in `.claude/agents/`
- Must not use reserved names: `orchestrator` is valid but has special semantics
- Maximum 30 characters

### Display Names

- Format: "First L (role)" or "Role Title" (for non-themed teams)
- Must be unique within a team
- Maximum 30 characters

---

## 7. Edge Cases

### Adding an Agent That Doesn't Have a Definition

```bash
$ claude-team team add nonexistent-agent --team my-project

Error: No agent found at .claude/agents/nonexistent-agent.md
Hint: Run 'claude-team agent create --name nonexistent-agent' first.
```

### Creating a Team with No Template

```bash
$ claude-team team create --team-name bare-team --template none

Creating team 'bare-team' with no template...
  Created: templates/teams/bare-team/team.yaml (empty roles)
  Created: templates/teams/bare-team/README.md

Team created with no roles. Add agents with 'claude-team team add'.
```

### Duplicate Role Names in a Team

If two different agents are added as the same role name, the second `team add` fails:

```
Error: Role 'frontend-eng' already exists in team 'my-project-team'.
Use 'claude-team team remove frontend-eng' first, or choose a different role name.
```

---

## 8. Future Considerations

These are explicitly out of scope for the initial implementation but noted for future work:

- `claude-team team launch` -- launch a team session (integrate with run-claude-team-persistent)
- `claude-team team status` -- show live team status from `~/.claude/teams/` runtime config
- `claude-team team reconnect` -- wrapper around `claude --resume` with config auto-discovery
- `claude-team agent test` -- validate an agent definition file
- `claude-team team validate` -- validate a team.yaml against available agents
- `claude-team team export` -- export a team config for sharing
- Template inheritance -- teams that extend a base template with overrides

---

## References

- [Agent Launcher Spec](agent-launcher.md) -- agent file schema, frontmatter fields, display name format
- [Team Structure](../../.claude/docs/team-structure.md) -- roles, hierarchy, agent vs persona separation
- [Communication Protocol](../../.claude/docs/communication-protocol.md) -- how teammates communicate
- [Session Reconnection Research](../../../docs/research/session-reconnection.md) -- reconnection procedure and pitfalls
- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams) -- upstream documentation
