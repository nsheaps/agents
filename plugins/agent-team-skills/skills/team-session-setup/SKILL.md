# Setting Up an Agent Team Session

How to create and launch a Claude Code agent team session from scratch.

## Prerequisites

Before starting, verify:

1. **Claude Code installed** -- `claude --version` should return a version string
2. **tmux installed** -- `tmux -V` should return a version string
3. **Experimental agent teams enabled** -- set the environment variable before launching:

   ```bash
   export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
   ```

   Or add it to your shell profile to make it permanent.

4. **Working directory** -- have the project repository open in your terminal

## Creating the Team

Inside a Claude Code session, call `TeamCreate` to register a new team:

```
TeamCreate(
  name: "my-team",
  description: "Short description of what this team does"
)
```

- The `name` becomes the directory key under `~/.claude/teams/`
- Names should be lowercase, hyphenated (e.g., `agent-team`, `looney-tunes`)
- `TeamCreate` writes `~/.claude/teams/{name}/config.json` and sets the lead's team context

Team context is a runtime state -- it does not persist between sessions unless you resume the lead session with `--resume <session-id>`.

## Spawning Teammates

Use the `Task` tool with `team_name` and `name` parameters to spawn each teammate:

```
Task(
  description: "Your task or initial instructions for this agent",
  team_name: "my-team",
  name: "Bugs B (software-eng)",
  agent: "software-eng",
  teammate_mode: "auto",
  permission_mode: "bypassPermissions"
)
```

| Parameter         | Purpose                                                                     |
| :---------------- | :-------------------------------------------------------------------------- |
| `team_name`       | Must match the name passed to `TeamCreate`                                  |
| `name`            | Display name for this teammate -- used in `SendMessage` and team config     |
| `agent`           | Agent definition to use (matches `.claude/agents/<name>.md` filename stem)  |
| `teammate_mode`   | How the teammate is displayed: `auto`, `tmux`, or `in-process`              |
| `permission_mode` | Permission level: `bypassPermissions` is typical for automated team members |

**Display name conventions** -- Use the format `First L (role)`:

| Character       | Display Name           |
| :-------------- | :--------------------- |
| Bugs Bunny      | Bugs B (software-eng)  |
| Wile E. Coyote  | Wile E (ai-agent-eng)  |
| Tweety Bird     | Tweety B (docs-writer) |
| Daffy Duck      | Daffy D (qa)           |
| Elmer Fudd      | Elmer F (pm)           |
| Road Runner     | Road R (researcher)    |
| Foghorn Leghorn | Foghorn L (ops-eng)    |

Spawn teammates one at a time. Each `Task` call returns when the teammate is launched and has processed its initial message.

## How the Task List Works

All teammates share a single task board stored at `~/.claude/tasks/{team-name}/`. Use these tools from any teammate:

| Tool           | Purpose                                   |
| :------------- | :---------------------------------------- |
| `TaskCreate`   | Create a new task                         |
| `TaskUpdate`   | Update status, owner, or description      |
| `TaskGet`      | Read a specific task by ID                |
| `TaskList`     | List all tasks (optionally filter by status) |

Task IDs are sequential integers. Always read the task with `TaskGet` before starting work -- descriptions may have been updated since the task was created.

**Task naming convention** -- always include the task ID in the subject:

```
"#12: Implement the login endpoint"   -- GOOD
"Implement the login endpoint"        -- BAD
```

## Communication Model

Teammates communicate through three channels:

### 1. SendMessage -- peer-to-peer messages

```
SendMessage(
  to: "Bugs B (software-eng)",
  message: "PR #42 is ready for review",
  type: "message"
)
```

- `type: "message"` for direct messages
- `type: "broadcast"` to send to all teammates (use sparingly -- consumes context across all agents)
- Messages are written to inbox files at `~/.claude/teams/{team-name}/inboxes/`
- **Silent success gotcha** -- `SendMessage` returns success even for non-existent recipients. Always verify the recipient name matches exactly what is in the team config.

### 2. Shared files in `.claude/tmp/`

Use `.claude/tmp/` for reports, findings, and deliverables that need to be shared:

- Never return large outputs only in messages
- Save reports to files and send a summary with the file path
- Use `.claude/tmp/` -- NOT `/tmp/` (the project `.claude/tmp/` is shared between all teammates)

### 3. Direct conversation

The user interacts with the lead (orchestrator) directly. The lead coordinates with teammates via `SendMessage`.

## Recommended Settings

When spawning teammates, these settings are standard for most teams:

```
teammate_mode: "auto"       -- Claude Code picks tmux or in-process based on context
permission_mode: "bypassPermissions"  -- teammates can act without permission prompts
```

For tmux-based setups, `auto` will use `tmux` if you launched Claude Code inside a tmux session (including iTerm2 tmux control mode). See the `tmux-usage` skill for details on tmux pane behavior.

## Agent Team Templates

The `bin/` directory contains helper scripts for common team configurations:

- `bin/run-claude-team-persistent` -- launches a named team with pre-configured teammates

Check `bin/lib/agent-config/` for available agent definitions and team presets.

## Verifying the Team Is Running

After spawning teammates, read the team config to confirm they registered:

```bash
cat ~/.claude/teams/my-team/config.json
```

Each spawned teammate will appear in the `members` array with their `agentId`, `name`, and `tmuxPaneId` (for tmux mode).

To see active tmux panes:

```bash
tmux list-panes -a -F "#{pane_id} #{session_name} #{pane_current_command}"
```

## References

- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Team Storage Internals](../../docs/research/team-storage-internals.md) -- config.json and inbox schema
- [Team Launch Without TeamCreate Research](../../docs/research/claude-code-team-launch-without-teamcreate.md) -- why pre-creation doesn't work
- [tmux Usage Skill](../tmux-usage/SKILL.md) -- tmux pane management and gotchas
- [Writing Agent Team Agents Skill](../writing-agent-team-agents/SKILL.md) -- agent file format
- [Team Structure Docs](../../.claude/docs/team-structure.md) -- display names and roles
