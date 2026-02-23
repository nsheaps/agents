# Agent Launcher Specification

> **Status**: Draft
> **Author**: Elmer Fudd (Project Manager)
> **Date**: 2026-02-17
> **Revised**: 2026-02-17 — v3: tmux -CC flow, permissions default fix, resolved open questions, MEDIUM gaps
> **Task**: #104 (PHASE1-002)
> **Phase**: 1 — Agent Launcher MVP
> **Language**: TypeScript + Bun

---

## 1. Overview

The agent launcher is a CLI tool that reads `.claude/agents/*.md` files and automatically spawns, manages, and monitors AI agent teammates. It replaces the current manual `Task` tool spawning workflow with a declarative, file-driven approach.

### Goals

1. **Declarative agent definitions**: Agents defined as markdown files with YAML frontmatter
2. **Reliable lifecycle**: Launch, kill, relaunch without stale entries or name collisions
3. **Prompt flexibility**: EXTEND or REPLACE the base system prompt per agent
4. **Customizable team name**: No hardcoded team names — parameterized everywhere

### Non-Goals (this phase)

- Docker container backend (Phase 9)
- Session save/restore (Phase 7)
- Multi-framework support (Claude Code only for now)
- Cross-machine agent mobility
- Runtime tool stripping via I/O proxy (Phase 2+ — see architecture doc §7)

### Agent File Format Disambiguation

Three agent definition formats exist across the project. This spec uses **format 1** only:

| Format                                | Location                     | Used By                                                  | Phase                        |
| :------------------------------------ | :--------------------------- | :------------------------------------------------------- | :--------------------------- |
| **`.claude/agents/*.md`** (this spec) | Project `.claude/agents/`    | Claude Code native agent system + launcher               | Phase 1 (MVP)                |
| **`agents/{name}/agent.yaml`**        | Proposed directory structure | Structured agent definitions with Dockerfile, behaviors/ | Phase 2+                     |
| **`.agent.yaml`** (wrapper PRD)       | Agent wrapper config         | Config composition, profiles                             | Future (`nsheaps/agent` CLI) |

Phase 1 reads `.claude/agents/*.md` files. Phase 2 introduces `agent.yaml` for richer definitions. The wrapper `.agent.yaml` is a separate concern in the `nsheaps/agent` repo.

---

## 2. Agent File Discovery

### Location

The launcher scans `.claude/agents/*.md` in the project root. Only files with `.md` extension are considered.

### Discovery Algorithm

```
1. Resolve project root (git root or cwd)
2. Glob: ${projectRoot}/.claude/agents/*.md
3. For each file:
   a. Parse YAML frontmatter (between --- delimiters)
   b. Extract markdown body (everything after frontmatter)
   c. Validate required fields
   d. Add to agent registry
4. Return sorted list of discovered agents
```

### Error Handling

| Condition                      | Behavior                                                               |
| :----------------------------- | :--------------------------------------------------------------------- |
| No `.claude/agents/` directory | Error: "No agents directory found"                                     |
| Directory exists but empty     | Warning: "No agent files found"                                        |
| File with invalid YAML         | Warning: "Skipping {file}: invalid frontmatter" — continue with others |
| File missing required fields   | Warning: "Skipping {file}: missing required field '{field}'"           |
| Duplicate agent names          | Error: "Duplicate agent name '{name}' in {file1} and {file2}"          |

---

## 3. Agent File Schema

### YAML Frontmatter

The existing `.claude/agents/*.md` files have Claude Code native frontmatter fields (`name`, `description`, `color`). The launcher adds new fields for spawning configuration.

#### Required Fields

| Field         | Type   | Description                                                              |
| :------------ | :----- | :----------------------------------------------------------------------- |
| `name`        | string | Unique agent identifier (kebab-case). Used as agent name in team config. |
| `description` | string | When to invoke this agent. Used by Claude Code for agent selection.      |

#### Launcher Fields (optional, with defaults)

| Field                          | Type                                                                               | Default                                    | Description                                                                                                                                                                                                                      |
| :----------------------------- | :--------------------------------------------------------------------------------- | :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt_mode`                  | `"extend"` \| `"replace"`                                                          | `"extend"`                                 | How the agent's prompt combines with the base prompt                                                                                                                                                                             |
| `base_prompt`                  | `"_builtin"` \| string (file path)                                                 | `"_builtin"`                               | Base system prompt source                                                                                                                                                                                                        |
| `framework`                    | `"claude-code"`                                                                    | `"claude-code"`                            | Agent framework (only `claude-code` supported in Phase 1)                                                                                                                                                                        |
| `model`                        | string                                                                             | (framework default)                        | Model override, e.g., `"claude-opus-4-6"`, `"sonnet"`                                                                                                                                                                            |
| `permission_mode`              | `"default"` \| `"plan"` \| `"bypassPermissions"` \| `"acceptEdits"` \| `"dontAsk"` | `"bypassPermissions"`                      | Claude Code permission mode                                                                                                                                                                                                      |
| `dangerously_skip_permissions` | boolean                                                                            | `true` for orchestrator, `false` otherwise | If true, passes `--dangerously-skip-permissions`. **Migration note**: `claude-team` always passes this flag. The orchestrator defaults to `true` to match; other agents default to `false` as a deliberate security improvement. |
| `display_name`                 | string                                                                             | (derived from name)                        | Display name for team UI, format: "First L (role)"                                                                                                                                                                               |
| `teammate_mode`                | `"auto"` \| `"in-process"` \| `"tmux"`                                             | (inherited from lead)                      | Override teammate display mode                                                                                                                                                                                                   |
| `continue_session`             | boolean                                                                            | `false`                                    | If true, passes `--continue` to resume most recent session                                                                                                                                                                       |
| `tools`                        | string[]                                                                           | (all tools)                                | Whitelist of tools available to this agent. Maps to `--tools`. Removes unlisted tools from context.                                                                                                                              |
| `disallowed_tools`             | string[]                                                                           | `[]`                                       | Blacklist of tools to remove from context. Maps to `--disallowedTools`. Supports patterns.                                                                                                                                       |

#### Preserved Claude Code Fields

These fields are native to Claude Code's agent system and are preserved as-is:

| Field   | Type   | Description                |
| :------ | :----- | :------------------------- |
| `color` | string | Agent color in terminal UI |

### Display Name Format

Agent display names follow the format: **"First L (role)"**

Examples:

- `Bugs B (software-eng)` — not "Bugs Bunny (Software Eng)"
- `Wile E (ai-agent-eng)` — abbreviated role
- `Tweety B (docs-writer)`
- `Daffy D (qa)`
- `Elmer F (pm)`
- `Road R (researcher)`
- `Foghorn L (ops-eng)`

Role abbreviations:
| Full Role | Abbreviated |
|:--|:--|
| Software Eng | software-eng |
| AI Agent Eng | ai-agent-eng |
| Ops Eng | ops-eng |
| Quality Assurance | qa |
| Project Manager | pm |
| Technical Writer | docs-writer |
| Deep Researcher | researcher |

The `display_name` field in frontmatter overrides the default derivation.

### Example Agent File

```yaml
---
name: software-eng
description: |
  Use this agent for implementation tasks: writing code, fixing bugs,
  running tests, and committing changes.
color: cyan
prompt_mode: extend
base_prompt: _builtin
framework: claude-code
model: claude-opus-4-6
permission_mode: bypassPermissions
display_name: "Bugs B (software-eng)"
---
# Bugs Bunny (Software Eng)

You are a software engineer...
[rest of agent prompt markdown body]
```

---

## 4. Prompt Assembly

### Modes

#### EXTEND Mode (default — recommended for MVP)

The agent's prompt content is **appended** to the base system prompt. This preserves all Claude Code defaults (tool usage, memory, CLAUDE.md loading, etc.).

```
Final prompt = base_prompt + "\n\n" + agent_markdown_body
```

CLI mapping: `--append-system-prompt "<agent_markdown_body>"`

This is the **recommended approach** for all agents in Phase 1. It is reliable in both interactive and print modes.

For per-agent customization beyond the prompt, combine EXTEND mode with tool control flags:

```bash
claude \
  --append-system-prompt "AGENT ROLE: You are the Orchestrator..." \
  --tools "Read,Grep,Glob,Task,SendMessage" \
  --disallowedTools "Edit" "Write" "Bash"
```

This preserves Claude Code's built-in tool descriptions for kept tools while removing the rest — saving context tokens.

#### REPLACE Mode (experimental — unreliable in interactive mode)

> **WARNING**: `--system-prompt` (REPLACE) is **unreliable in interactive mode** per [GitHub Issue #2692](https://github.com/anthropics/claude-code/issues/2692). Users report Claude Code still uses default instructions even when `--system-prompt` is specified. It works reliably in print mode (`-p`) but not interactive.
>
> Since agent team teammates are **interactive sessions**, REPLACE mode is risky for Phase 1. Use EXTEND mode instead. REPLACE will be revisited when:
>
> 1. The GitHub issue is resolved, or
> 2. We migrate to the Agent SDK's `systemPrompt` parameter (which is reliable for full replacement)

The agent's prompt content **replaces** the entire system prompt. Use for specialized agents that need full control.

```
Final prompt = agent_markdown_body
```

CLI mapping: `--system-prompt "<agent_markdown_body>"`

**Additional risk**: When using REPLACE, ALL tool descriptions are removed since they're part of the default prompt. You'd need to reconstruct any tool guidance in the agent prompt — which is fragile and version-dependent.

### Base Prompt Selection

| Value                                | Behavior                                                                                                                                                                                                         |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_builtin` (default)                 | Don't pass any base — let Claude Code use its built-in system prompt. In EXTEND mode, only `--append-system-prompt` is passed. In REPLACE mode, `--system-prompt` is passed with just the agent body.            |
| File path (relative to project root) | Read the file and use its contents as the base. In EXTEND mode: `--system-prompt "<file_contents>" --append-system-prompt "<agent_body>"`. In REPLACE mode: `--system-prompt "<file_contents>\n\n<agent_body>"`. |

### Prompt Assembly Algorithm

```typescript
function assemblePrompt(agent: AgentDefinition): CLIFlags {
  const body = agent.markdownBody;
  const mode = agent.prompt_mode ?? "extend";
  const base = agent.base_prompt ?? "_builtin";

  if (mode === "extend") {
    if (base === "_builtin") {
      // Let Claude Code use its defaults, just append
      return { appendSystemPrompt: body };
    } else {
      // Custom base + agent body appended
      const baseContent = readFile(base);
      return {
        systemPrompt: baseContent,
        appendSystemPrompt: body,
      };
    }
  } else {
    // REPLACE mode
    if (base === "_builtin") {
      // Agent body IS the full prompt
      return { systemPrompt: body };
    } else {
      // Custom base + agent body combined
      const baseContent = readFile(base);
      return { systemPrompt: `${baseContent}\n\n${body}` };
    }
  }
}
```

### Shell Argument Length Limitation

Agent prompts passed via CLI flags may hit shell argument length limits (~262,144 bytes on macOS). Mitigations:

1. **Keep prompts concise** (recommended for Phase 1)
2. **Use heredoc**: Pass prompt via stdin/heredoc if length exceeds threshold
3. **Future**: Investigate `--system-prompt-file` for print-mode workaround, or `--settings` JSON

The launcher should warn if assembled prompt exceeds 200KB.

---

## 5. Agent Spawning

### Team Name

The team name is a **required parameter** to the launcher. It is never hardcoded.

```bash
agent-launcher --team-name looney-tunes launch software-eng
```

If not provided via flag, the launcher checks:

1. `AGENT_TEAM_NAME` environment variable
2. Error: "Team name required. Use --team-name or set AGENT_TEAM_NAME."

### Spawn Flow (Claude Code Backend)

```
1. Resolve agent by name from registry
2. Assemble prompt (§4)
3. Build CLI flags from agent definition
4. Run pre-launch cleanup (§6: remove stale entries for this agent name)
5. Spawn via Task tool with team_name parameter
6. Record agent metadata (name, agent ID, tmux pane, timestamp)
7. Verify agent appears in team config
```

### CLI Flag Mapping

| Agent Field                    | Claude CLI Flag                                                                |
| :----------------------------- | :----------------------------------------------------------------------------- |
| (prompt assembly)              | `--append-system-prompt` (EXTEND) or `--system-prompt` (REPLACE, experimental) |
| `model`                        | `--model <value>`                                                              |
| `permission_mode`              | `--permission-mode <value>`                                                    |
| `dangerously_skip_permissions` | `--dangerously-skip-permissions`                                               |
| `teammate_mode`                | `--teammate-mode <value>`                                                      |
| `continue_session`             | `--continue`                                                                   |
| `tools`                        | `--tools "<comma-separated>"`                                                  |
| `disallowed_tools`             | `--disallowedTools "<tool1>" "<tool2>" ...`                                    |

### Environment Variables

The launcher always sets:

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### Spawning Method

Agents are spawned via the lead session's `Task` tool with the `team_name` parameter. There is no CLI flag to join an existing team — team membership is managed by the lead.

```typescript
// Conceptual — the lead's system prompt instructs it to use Task tool
Task({
  subagent_type: agent.subagent_type ?? "general-purpose",
  team_name: teamName,
  name: agent.display_name,
  prompt: assembledPrompt,
  mode: mapPermissionMode(agent),
});
```

### Batch Launch

```bash
agent-launcher --team-name looney-tunes launch --all
```

Spawns all discovered agents sequentially (respecting any ordering defined in a team config file, if present). Each agent is spawned, verified in team config, then the next is started.

---

## 6. Lifecycle Management

### 6.1 Kill

```bash
agent-launcher --team-name looney-tunes kill <agent-name>
```

**Flow:**

1. Find agent in team config (`~/.claude/teams/{team-name}/config.json`)
2. Find associated tmux pane (if tmux mode)
3. Send shutdown request via `SendMessage` (graceful)
4. Wait for shutdown acknowledgment (timeout: 10s)
5. If no acknowledgment: force kill tmux pane (`tmux kill-pane -t {pane}`)
6. Remove agent entry from team config.json
7. Verify removal

**Error cases:**
| Condition | Behavior |
|:--|:--|
| Agent not in config | Warning: "Agent '{name}' not found in team config" |
| Tmux pane already dead | Skip pane kill, proceed with config cleanup |
| Config file locked/missing | Error with guidance |

### 6.2 Health Check

```bash
agent-launcher --team-name looney-tunes health
```

Cross-references team config entries against actual running backends:

```
For each agent in config.json:
  1. Check if associated tmux pane exists and is alive
  2. Report status: RUNNING | DEAD | UNKNOWN
```

**Output format:**

```
Agent                    Status    Backend     Pane
Bugs B (software-eng)    RUNNING   tmux        %42
Wile E (ai-agent-eng)    DEAD      tmux        %38 (pane not found)
Road R (researcher)      RUNNING   tmux        %44
```

### 6.3 Auto-Cleanup

Runs automatically before every `launch` command:

```
1. Read team config
2. For each entry, check if backend is alive
3. Remove entries where backend is dead
4. Log removed entries
```

Also available as explicit command:

```bash
agent-launcher --team-name looney-tunes cleanup
```

### 6.4 List

```bash
agent-launcher --team-name looney-tunes list
```

Shows all agents: both discovered (from files) and running (from config).

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

### 6.5 Relaunch

```bash
agent-launcher --team-name looney-tunes relaunch <agent-name>
```

**Flow:**

1. Kill existing agent (§6.1) — including config cleanup
2. Re-read agent file (picks up any changes)
3. Launch fresh (§5)

This guarantees no `-2` suffix entries because the old entry is fully removed before the new spawn.

---

## 7. Tool Control

Per-agent tool control is available in Phase 1 via `tools` and `disallowed_tools` frontmatter fields.

### How Tool Control Works

Tool control affects **two things simultaneously** ([tool stripping research](../../docs/research/tool-stripping.md)):

1. **Execution**: The agent cannot invoke removed tools
2. **Context**: Tool descriptions are removed from the system prompt, saving tokens (~5,000-10,000 tokens for a full tool set)

This is different from hooks or permission rules, which only block execution but leave descriptions in context.

### Tool Control Levels

| Mechanism                                                     | Saves Context? | Phase                          |
| :------------------------------------------------------------ | :------------- | :----------------------------- |
| `--tools` / `--disallowedTools` CLI flags                     | **Yes**        | Phase 1 (this spec)            |
| Agent frontmatter `tools` / `disallowedTools` (subagent only) | **Yes**        | Phase 1 (for subagents)        |
| PreToolUse hooks                                              | No             | N/A (blocking only)            |
| Permission deny rules                                         | No             | N/A (blocking only)            |
| Runtime I/O proxy stripping                                   | **Yes**        | Phase 2+ (architecture doc §7) |

### Example Tool Sets by Role

```yaml
# Orchestrator: coordination tools only, no code editing
tools: [Read, Grep, Glob, Task, SendMessage, TaskCreate, TaskUpdate, TaskList, AskUserQuestion]
disallowed_tools: [Edit, Write, Bash]

# Software engineer: full implementation tools, no team management
tools: [Read, Edit, Write, Bash, Grep, Glob, WebSearch, WebFetch]

# Researcher: read-only + web access
tools: [Read, Grep, Glob, WebSearch, WebFetch, Bash]
disallowed_tools: [Edit, Write]

# QA: read + execute, no write
tools: [Read, Grep, Glob, Bash, WebFetch]
disallowed_tools: [Edit, Write]
```

### Pattern Support

`disallowed_tools` supports patterns per Claude Code's permission rule syntax:

- `Bash(rm -rf *)` — block specific command patterns
- `Read(./.env)` — block reading sensitive files
- `Task(Explore)` — disable specific subagent types
- `WebFetch(domain:api.private.com)` — block specific domains

---

## 8. Team Config Interaction

### Config File Location

```
~/.claude/teams/{team-name}/config.json
```

### Config Structure (as managed by Claude Code)

The launcher does not own this file — Claude Code's `TeamCreate` tool creates and manages it. The launcher reads it for health checks and modifies it only for cleanup operations.

```json
{
  "members": [
    {
      "name": "Bugs B (software-eng)",
      "agentId": "abc-123-def",
      "agentType": "general-purpose",
      "tmuxPaneId": "%42",
      "agentName": "software-eng"
    }
  ]
}
```

**Launcher-managed fields** (set at spawn time, not part of Claude Code's base schema):

| Field        | Type      | Purpose                                                               |
| :----------- | :-------- | :-------------------------------------------------------------------- |
| `tmuxPaneId` | `string?` | Tmux pane ID — enables kill (§6.1), health (§6.2), and cleanup (§6.3) |
| `agentName`  | `string?` | Agent file name slug — enables file/config correlation in list (§6.4) |

These fields are added to the config entry when the launcher spawns an agent. Claude Code's own tools ignore unknown fields, so they coexist safely.

### Cleanup Operations

The launcher uses `jq` (or programmatic JSON manipulation) to remove stale entries:

```bash
# Remove agent by name
jq '.members = [.members[] | select(.name != "Bugs B (software-eng)")]' \
  ~/.claude/teams/{team-name}/config.json > tmp && mv tmp config.json
```

---

## 9. Orchestrator Self-Configuration

The orchestrator agent is special — it's the lead that manages the team. The launcher identifies the orchestrator by a `role: orchestrator` field in frontmatter (or by file name `orchestrator.md` as fallback). The orchestrator is always launched first.

The launcher configures the lead session with:

1. `--append-system-prompt` with the orchestrator's agent file content
2. `--teammate-mode` from CLI flag or orchestrator agent definition
3. `--permission-mode bypassPermissions` (or from definition)
4. `--dangerously-skip-permissions` (defaults `true` for orchestrator — see §3 schema)
5. `--continue` to resume the team session
6. `--settings` with hooks (SessionStart, Stop) for team lifecycle events
7. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable

### tmux -CC Auto-Launch Flow

When `--teammate-mode tmux` is selected and the user is **not already inside a tmux session** (`$TMUX` env var is empty), the launcher auto-launches tmux in iTerm2 control mode. This allows iTerm2 to render tmux panes as native tabs/windows.

**Detection and launch algorithm:**

```
1. If teammate_mode == "tmux":
   a. Verify tmux is installed (error if not)
   b. If $TMUX is set → already in tmux, proceed normally
   c. If $TMUX is empty:
      - Log: "Not in a tmux session. Auto-launching tmux -CC."
      - exec tmux -CC new-session -- <claude command with all flags>
      - The `exec` replaces the current process (no orphan shell)
      - CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 must be exported before exec
        (inherited by the tmux session)
2. If teammate_mode != "tmux":
   - Launch claude directly (no tmux)
```

**Key details from `claude-team` script (`bin/claude-team:188-196`):**

```bash
# Auto-launch tmux -CC for iTerm2 native integration
if [[ "$LAUNCH_TMUX_CC" == true ]]; then
  exec tmux -CC new-session -- claude --dangerously-skip-permissions "${TEAM_FLAGS[@]}" "${CLAUDE_ARGS[@]}"
else
  command claude --dangerously-skip-permissions "${TEAM_FLAGS[@]}" "${CLAUDE_ARGS[@]}"
fi
```

The `exec` pattern is critical — it replaces the shell process so the tmux session ends cleanly when claude exits. Without `exec`, the parent shell lingers after the tmux session ends.

### Hooks Configuration

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '[agent-teams] Session started' >&2"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '[agent-teams] Session stopping' >&2"
          }
        ]
      }
    ]
  }
}
```

---

## 10. CLI Interface

### Commands

```
agent-launcher --team-name <name> <command> [args]

Commands:
  launch <agent>     Spawn an agent by name
  launch --all       Spawn all discovered agents
  kill <agent>       Terminate agent and clean config
  relaunch <agent>   Kill + launch (pick up file changes)
  list               Show all agents with status
  health             Check backend health for running agents
  cleanup            Remove stale config entries
  start              Launch the orchestrator/lead session
```

### Global Flags

| Flag                     | Env Var                    | Description                                                                                                |
| :----------------------- | :------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `--team-name <name>`     | `AGENT_TEAM_NAME`          | Team name (required)                                                                                       |
| `--teammate-mode <mode>` | `CLAUDE_TEAM_DEFAULT_MODE` | Teammate display mode: `auto`, `in-process`, `tmux` (default: `auto`)                                      |
| `--no-interactive`       | —                          | Skip interactive prompts, use defaults. Without this, launcher prompts for teammate mode if not specified. |
| `--project-root <path>`  | —                          | Override project root (default: git root or cwd)                                                           |
| `--verbose`              | —                          | Verbose output                                                                                             |
| `--`                     | —                          | Separator. Everything after `--` is passed through to the claude CLI as extra args.                        |

### `start` Command (Orchestrator)

The `start` command is the primary entry point. It:

1. Discovers agents
2. Runs auto-cleanup
3. Launches the orchestrator lead session with team configuration
4. The orchestrator then uses the launcher's `launch` commands (or Task tool) to spawn teammates

```bash
agent-launcher --team-name looney-tunes start
# equivalent to the current: claude-team --mode tmux
```

---

## 11. Migration from claude-team

The launcher replaces `claude-team` from the claude-utils repo. Feature mapping:

| claude-team Feature                          | Launcher Equivalent                                                                                                                                                                                                                                         |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interactive mode picker (gum)                | `--teammate-mode` flag on `start` command, or interactive fallback                                                                                                                                                                                          |
| iTerm2 tmux -CC auto-launch                  | Preserved in `start` command                                                                                                                                                                                                                                |
| Hardcoded orchestrator prompt                | Read from `.claude/agents/orchestrator.md`                                                                                                                                                                                                                  |
| `--permission-mode bypassPermissions`        | Per-agent `permission_mode` in frontmatter                                                                                                                                                                                                                  |
| `--continue`                                 | Per-agent `continue_session` in frontmatter                                                                                                                                                                                                                 |
| `--dangerously-skip-permissions` (always on) | Per-agent `dangerously_skip_permissions` in frontmatter. **Breaking change**: orchestrator defaults `true` (matches old behavior), other agents default `false` (new security improvement — users will see permission prompts for non-orchestrator agents). |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`     | Always set by launcher                                                                                                                                                                                                                                      |
| Hooks (SessionStart, Stop)                   | Configurable via orchestrator agent definition or `--settings`                                                                                                                                                                                              |
| Brew update check                            | Retained in entry point script (not in launcher core)                                                                                                                                                                                                       |
| `gum` dependency                             | Optional — only for interactive mode selection                                                                                                                                                                                                              |
| `--no-interactive` flag                      | `--no-interactive` global flag (same semantics)                                                                                                                                                                                                             |
| `CLAUDE_TEAM_DEFAULT_MODE` env var           | `CLAUDE_TEAM_DEFAULT_MODE` env var for `--teammate-mode` (same)                                                                                                                                                                                             |
| `--` passthrough to claude                   | `--` separator passes remaining args to claude CLI                                                                                                                                                                                                          |
| `claude_check_settings_backup`               | Not carried over (previously rejected by user)                                                                                                                                                                                                              |

---

## 12. Implementation Phases

Maps to the Phase 1 sub-phases in the multi-repo phase plan:

### Phase 1A: Discovery + Prompt Assembly (PHASE1-003, PHASE1-004)

- Agent file glob + frontmatter parsing
- Prompt mode system (EXTEND/REPLACE)
- Base prompt selection
- Unit tests

### Phase 1B: Spawning (PHASE1-005, PHASE1-012)

- `launch` command — spawn via Claude CLI
- `start` command — launch orchestrator
- Customizable team name
- Batch launch
- Integration tests

### Phase 1C: Lifecycle (PHASE1-006 through PHASE1-008)

- `kill` with graceful shutdown + config cleanup
- Health check (tmux pane alive/dead)
- Auto-cleanup on launch
- `list` with file + config cross-reference
- `relaunch` (kill + launch, no stale entries)
- Integration tests

---

## 13. Resolved Decisions

Answers provided by team-lead. These were previously open questions.

| #   | Question                  | Decision                                                                                                                                                                                              |
| :-- | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Launcher packaging        | **Bun script in agent-team repo** for MVP. Package as npm module later if it proves useful.                                                                                                           |
| 2   | Tmux pane ID tracking     | Capture from `tmux split-window -P -F "#{pane_id}"` at spawn time. Store in agent metadata.                                                                                                           |
| 3   | Graceful shutdown timeout | **10 seconds** — fine for MVP.                                                                                                                                                                        |
| 4   | Batch launch ordering     | **Sequential** for MVP. Parallel launch is a later optimization.                                                                                                                                      |
| 5   | Orchestrator agent file   | **Agent file like any other** (`.claude/agents/orchestrator.md`), but with `role: orchestrator` in frontmatter. Launcher recognizes this role as special: launches first, gets team management tools. |

### Remaining Open Questions

1. **`role` field in frontmatter**: Should this be a new field, or reuse `name` / derive from file name? The orchestrator needs to be identifiable as special.
2. **Interactive fallback dependency**: If `gum` is not installed, should the launcher fall back to a basic `read -p` prompt, or require `--teammate-mode` / `--no-interactive`?

---

## 14. References

- [Multi-Repo Phase Plan](multi-repo-phase-plan.md) — Phase 1 breakdown
- [Agent Team Architecture](agent-team-architecture.md) — Design topics
- [System Prompt Flags Research](../../.claude/tmp/system-prompt-flags-research.md) — Task #103 findings
- [Tool Stripping Research](../../docs/research/tool-stripping.md) — Task #111: three levels of tool control
- [System Prompt Flags Deep Dive](../../docs/research/system-prompt-flags.md) — REPLACE mode reliability analysis
- [GitHub Issue #2692](https://github.com/anthropics/claude-code/issues/2692) — `--system-prompt` unreliable in interactive mode
- [Current claude-team Script](https://github.com/nsheaps/claude-utils/blob/main/bin/claude-team)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-usage)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Team Member Cleanup Behavior](../../.claude/behaviors/team-member-cleanup.md) — Stale entry problem
- [Agent Wrapper PRD](https://github.com/nsheaps/agent/blob/main/docs/specs/draft/agent-wrapper.md) — Future CLI home
