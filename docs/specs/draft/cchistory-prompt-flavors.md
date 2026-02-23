# PRD: cchistory Fork — System Prompt Flavors & Agent Team Visualization

**Status**: Draft (Sidequest)
**Date**: February 2026
**Author**: Road Runner (Researcher)
**Task**: #102

---

## 1. Background

### What is cchistory?

[cchistory](https://github.com/badlogic/cchistory) is a CLI tool and web interface by Mario Zechner (@badlogic) that extracts, archives, and compares Claude Code's system prompts and tool definitions across versions.[^1]

**How it works**:[^2]

1. Downloads Claude Code versions from npm
2. Patches the binary to bypass version checks (string matching + curly-brace balancing to find and remove the check function)
3. Runs the patched binary with tracing enabled
4. Monkeypatches `fetch` to intercept the API request containing the system prompt
5. Extracts the prompt and tool schemas from the captured request
6. Outputs markdown files and serves a web diff viewer

**Web interface**: [cchistory.mariozechner.at](https://cchistory.mariozechner.at/) — Monaco-based side-by-side diff comparing any two Claude Code versions.[^3]

**Install**: `npm install -g @mariozechner/cchistory`

### The Gap

cchistory captures **one system prompt per version**. It does not account for the fact that Claude Code's system prompt changes based on runtime context:

- **Permission modes** (e.g., `--permission-mode bypassPermissions`) change tool restrictions and behavioral instructions
- **Agent teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) injects team primitives (TeamCreate, SendMessage, TaskUpdate, etc.)
- **Teammate sessions** receive different instructions than the lead session
- **Plan mode** restricts available tools and adds plan-specific instructions
- **MCP servers** inject tool definitions and server-provided instructions
- **Plugins** inject skills, agents, hooks, and commands
- **CLAUDE.md / rules** inject user-configured behavioral rules

Each of these "flavors" produces a materially different system prompt that researchers and developers may want to compare.

### User's Prior Notes

From the user's Obsidian vault (`ideas.md`):[^4]

> Fork badlogic/cchistory-site and add an additional dropdown for different mode flags (in particular delegate mode) and different output styles

From `ai ramblings.md`:[^4]

> Add inter-agent conversation visualization to cchistory-site fork — currently agent-to-agent DMs are invisible to the user, only idle notification summaries are shown. A shared conversation view or transcript replay would make agent team debugging much easier.

---

## 2. Goals

### Primary Goal

Fork cchistory with intent to contribute improvements back upstream. Add the ability to extract and compare different "flavors" of the system prompt produced by the same Claude Code version under different runtime configurations.

### Secondary Goal

Add inter-agent conversation visualization — a transcript replay or shared view of agent-to-agent messages during team sessions, making agent team debugging substantially easier.

### Non-Goals

- Replacing cchistory (this is a fork with PR-back intent)
- Building a production monitoring service
- Real-time prompt interception during live sessions
- Implementing any of this in this PRD (sidequest — PRD only)

---

## 3. Feature: System Prompt Flavors

### 3.1 What Are Flavors?

A "flavor" is a named configuration that produces a distinct system prompt from the same Claude Code version. Each flavor is defined by a set of flags, environment variables, and configuration files passed to Claude Code during extraction.

### 3.2 Proposed Flavor Dimensions

| Dimension           | Values                                                           | Prompt Impact                                                |
| :------------------ | :--------------------------------------------------------------- | :----------------------------------------------------------- |
| **Permission mode** | `default`, `acceptEdits`, `plan`, `dontAsk`, `bypassPermissions` | Changes tool restrictions and behavioral instructions        |
| **Agent teams**     | Off, Lead session, Teammate session                              | Adds team primitives (7 tools), teammate communication rules |
| **Teammate mode**   | N/A, `in-process`, `tmux`                                        | Minor differences in spawn backend instructions              |
| **Plan mode**       | Off, Active                                                      | Restricts to read-only tools, adds planning instructions     |
| **MCP servers**     | None, Specific server configs                                    | Injects server tools and instructions                        |
| **Plugins**         | None, Specific plugin set                                        | Injects skills, agents, hooks, commands                      |

### 3.3 Flavor Extraction

Each flavor requires running cchistory's extraction process with different arguments. The existing `--claude-args` flag already supports this:[^1]

```bash
# Normal mode (existing behavior)
cchistory extract --version 2.1.39

# Delegate mode flavor
cchistory extract --version 2.1.39 --claude-args "--permission-mode bypassPermissions"

# Agent teams lead flavor
cchistory extract --version 2.1.39 --env "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"

# Agent teams teammate flavor
cchistory extract --version 2.1.39 --env "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" \
  --claude-args "--teammate-mode tmux"
```

**New capability needed**: A `--flavor` flag or configuration file that defines named presets:

```yaml
# flavors.yaml
flavors:
  default:
    description: "Standard Claude Code session"
    args: []
    env: {}

  bypassPermissions:
    description: "Bypass permissions mode — skip all permission prompts"
    args: ["--permission-mode", "bypassPermissions"]
    env: {}

  agent-team-lead:
    description: "Agent teams — lead session"
    args: ["--permission-mode", "bypassPermissions"]
    env:
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"

  agent-team-teammate:
    description: "Agent teams — teammate session"
    args: []
    env:
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"
      CLAUDE_CODE_AGENT_NAME: "test-worker"
      CLAUDE_CODE_TEAM_NAME: "test-team"

  plan-mode:
    description: "Plan mode active"
    args: ["--permission-mode", "plan"]
    env: {}
```

### 3.4 Web Interface Changes

The existing web interface has a **version dropdown** for selecting two versions to diff. Add:

1. **Flavor dropdown** next to each version selector — choose which flavor's prompt to display
2. **Cross-flavor diff** — compare the same version under different flavors (e.g., "v2.1.39 default" vs "v2.1.39 bypassPermissions")
3. **Cross-version + cross-flavor diff** — compare different versions AND different flavors
4. **Output style toggle** — switch between raw markdown, structured sections, or tool-schema-only views

### 3.5 Output Styles

Current cchistory output is a single markdown file with the full prompt. Add selectable views:

| Style                     | Description                                                                                |
| :------------------------ | :----------------------------------------------------------------------------------------- |
| **Full prompt**           | Existing behavior — complete system prompt markdown                                        |
| **Sections only**         | Parsed sections (system instructions, tool descriptions, user rules) as collapsible blocks |
| **Tools only**            | Just tool definitions and their schemas                                                    |
| **Diff from default**     | Show only what changed from the "default" flavor                                           |
| **Delta between flavors** | Side-by-side showing additions/removals between two flavors                                |

---

## 4. Feature: Inter-Agent Conversation Visualization

### 4.1 Problem

When agent teams are running, teammates communicate via `SendMessage` (direct messages and broadcasts). These messages are stored in inbox files at `~/.claude/teams/{team-name}/inboxes/{agent}.json`, but:[^5]

- Users only see **idle notification summaries** — brief one-line descriptions
- The full content of agent-to-agent DMs is **invisible** to the user
- Debugging team coordination failures requires manually reading inbox JSON files
- There is no timeline or sequence view of inter-agent communication

### 4.2 Proposed Solution

Add a **conversation visualization** view to the cchistory web interface (or as a companion tool) that:

1. **Reads team inbox files** from `~/.claude/teams/{team-name}/inboxes/`
2. **Reads JSONL transcripts** from `~/.claude/projects/**/*.jsonl` for team sessions
3. **Correlates messages** by timestamp and agent name
4. **Renders a timeline** showing:
   - Which agent sent what message to whom
   - When tasks were created, claimed, and completed
   - Idle notifications and their triggers
   - Broadcasting events

### 4.3 Visualization Modes

| Mode                  | Description                                                                         |
| :-------------------- | :---------------------------------------------------------------------------------- |
| **Timeline**          | Chronological sequence of all inter-agent messages, color-coded by sender           |
| **Agent focus**       | Filter to show messages to/from a specific agent                                    |
| **Task flow**         | Show task lifecycle (create → claim → progress → complete) with associated messages |
| **Transcript replay** | Step through the conversation turn-by-turn, showing each agent's context            |

### 4.4 Data Sources

| Source            | Location                                      | Contains                                                 |
| :---------------- | :-------------------------------------------- | :------------------------------------------------------- |
| Team config       | `~/.claude/teams/{team}/config.json`          | Team members, agent names, types                         |
| Inboxes           | `~/.claude/teams/{team}/inboxes/{agent}.json` | Message history per agent                                |
| Tasks             | `~/.claude/tasks/{team}/*.json`               | Task definitions, ownership, status                      |
| JSONL transcripts | `~/.claude/projects/**/*.jsonl`               | Full session transcripts including SendMessage tool uses |

The JSONL transcript schema (documented in our [JSONL parsing tools research](../research/jsonl-parsing-tools.md)) provides the richest data source. Key fields for team visualization:

- `teamName` and `agentName` on every entry
- `type: "assistant"` entries with `SendMessage` tool uses contain message content
- `type: "progress"` entries with `waiting_for_task` show idle states
- `type: "system"` entries with `stop_hook_summary` show turn boundaries

---

## 5. Implementation Approach

### 5.1 Fork Strategy

1. Fork `badlogic/cchistory` (CLI tool) and `badlogic/cchistory-site` (web interface)
2. Develop flavor extraction as a CLI addition first
3. Add web interface flavor dropdowns second
4. Develop conversation visualization as a separate companion page
5. PR improvements back upstream where applicable

### 5.2 Upstream PR Candidates

| Change                         | PR-back Likelihood | Rationale                                             |
| :----------------------------- | :----------------- | :---------------------------------------------------- |
| `--flavor` config file support | High               | General-purpose, benefits all users                   |
| Flavor dropdown in web UI      | High               | Natural extension of existing version dropdown        |
| Output style toggle            | High               | Useful for all researchers                            |
| Inter-agent visualization      | Medium             | Depends on whether upstream wants agent-team features |
| JSONL transcript parsing       | Low                | May be too specific to our use case                   |

### 5.3 Technology

- **CLI**: Node.js (matching existing cchistory stack)
- **Web**: Existing cchistory-site uses Monaco editor — extend with additional views
- **JSONL parsing**: Use findings from [JSONL parsing tools research](../research/jsonl-parsing-tools.md) — `jq` for CLI, streaming Node.js for web

---

## 6. User Stories

1. **As a Claude Code researcher**, I want to compare the system prompt across different permission modes (e.g., `bypassPermissions` vs `default`) for the same version, so I can understand what behavioral constraints each mode adds.

2. **As a plugin developer**, I want to see how my plugin's skills and hooks modify the system prompt, so I can verify my plugin integrates correctly.

3. **As an agent team operator**, I want to see what a teammate's system prompt looks like vs the lead's prompt, so I can understand their different capabilities.

4. **As an agent team debugger**, I want to replay inter-agent conversations chronologically, so I can identify where coordination broke down.

5. **As a Claude Code power user**, I want to track how the agent teams system prompt evolves across versions, so I can adapt my orchestration strategies.

---

## 7. Open Questions

1. **Upstream receptivity**: Has Mario Zechner expressed interest in flavor support? Should we open an issue before forking?
2. **Extraction cost**: Each flavor extraction sends one API request. With N flavors x M versions, costs could add up. Should we batch or cache aggressively?
3. **Agent team prompt stability**: The agent teams feature is experimental. How frequently does the team-specific prompt change relative to the base prompt?
4. **Transcript privacy**: JSONL transcripts contain full conversation content. The visualization tool should be local-only (no cloud upload). Should we add warnings?
5. **Scope creep**: The conversation visualization feature is substantially larger than the flavor feature. Should they be separate PRDs or phased within this one?

---

## References

[^1]: [badlogic/cchistory — GitHub](https://github.com/badlogic/cchistory)

[^2]: [cchistory: Tracking Claude Code System Prompt and Tool Changes — Mario Zechner's blog](https://mariozechner.at/posts/2025-08-03-cchistory/)

[^3]: [cchistory web interface](https://cchistory.mariozechner.at/)

[^4]: User's Obsidian vault: `~/src/nsheaps/obsidian-vaults/ideas.md` and `~/src/nsheaps/obsidian-vaults/ai ramblings.md`

[^5]: [Claude Code Agent Teams documentation](https://code.claude.com/docs/en/agent-teams)
