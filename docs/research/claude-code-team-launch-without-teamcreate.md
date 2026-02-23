# Research: Launching Claude Code Into an Existing Team Context Without TeamCreate

**Date**: 2026-02-20
**Claude Code version**: v2.1.49
**Researcher**: Claude (automated research)

---

## Summary

**There is currently no supported way to launch a Claude Code session directly into an existing team context without calling `TeamCreate` from within an active session.** No CLI flag, environment variable, config file pre-creation, or Agent SDK API exists that allows a Claude Code instance to start already joined to a team. The team lifecycle is entirely managed through the `TeamCreate` and `Task` (with `team_name`) tools called by the lead session at runtime.

---

## 1. CLI Flags and Environment Variables

### Exhaustive CLI Flag Review (v2.1.49)

The full `claude --help` output was examined. The following flags are relevant to teams, sessions, and agent configuration:

| Flag                            | Relevant? | Can Join a Team? | Notes                                                                            |
| ------------------------------- | --------- | ---------------- | -------------------------------------------------------------------------------- |
| `--resume <session-id>` / `-r`  | Partially | No               | Resumes a session by ID, but does NOT restore team membership for teammates [^1] |
| `--continue` / `-c`             | Partially | No               | Continues most recent conversation; same limitation as `--resume`                |
| `--session-id <uuid>`           | No        | No               | Sets a specific session UUID, not team membership                                |
| `--agent <agent>`               | No        | No               | Selects a pre-defined agent definition, not team membership                      |
| `--agents <json>`               | No        | No               | Defines custom subagents (NOT teammates) via inline JSON                         |
| `--teammate-mode <mode>`        | No        | No               | Controls display mode (`in-process`, `tmux`, `auto`), not team membership        |
| `--system-prompt <text>`        | No        | No               | Replaces system prompt; cannot inject team context                               |
| `--append-system-prompt <text>` | No        | No               | Appends to system prompt; cannot inject team context                             |
| `--fork-session`                | No        | No               | Creates new session ID when resuming; no team awareness                          |
| `--from-pr [value]`             | No        | No               | Resumes session linked to a PR                                                   |
| `--settings <file-or-json>`     | No        | No               | Loads additional settings; no team-related settings exist                        |

**No `--team`, `--join-team`, or `--team-name` flag exists.** [^2]

### Environment Variables

Currently set Claude-related environment variables:

| Variable                               | Value | Team-Related?                                       |
| -------------------------------------- | ----- | --------------------------------------------------- |
| `CLAUDECODE`                           | `1`   | No (indicates running inside Claude Code)           |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `1`   | Enables team feature, but does not set team context |
| `CLAUDE_CODE_ENTRYPOINT`               | `cli` | No                                                  |
| `CLAUDE_CODE_ENABLE_TELEMETRY`         | `1`   | No                                                  |

No `CLAUDE_TEAM`, `CLAUDE_TEAM_NAME`, or similar environment variable exists to pre-set team membership.

---

## 2. Team State Files -- Schema and Pre-Creation Analysis

### Directory Structure

```
~/.claude/teams/{team-name}/
  config.json           # Team configuration and member roster
  inboxes/
    {agent-name}.json   # Per-agent message inbox (JSON array)
```

### config.json Schema

```jsonc
{
  "name": "string", // Team name (directory key)
  "description": "string", // Human-readable description
  "createdAt": 1771220251471, // Epoch milliseconds
  "leadAgentId": "string", // Format: "{name}@{team-name}"
  "leadSessionId": "string", // UUID of the lead's Claude Code session
  "members": [
    // Lead member (minimal):
    {
      "agentId": "team-lead@{team-name}",
      "name": "team-lead",
      "agentType": "team-lead",
      "model": "claude-opus-4-6",
      "joinedAt": 1771220251471,
      "tmuxPaneId": "",
      "cwd": "/path/to/working/dir",
      "subscriptions": [],
    },
    // Teammate member (full):
    {
      "agentId": "{display-name}@{team-name}",
      "name": "{display-name}",
      "agentType": "general-purpose", // or agent definition name
      "model": "claude-opus-4-6",
      "prompt": "Full system prompt...",
      "color": "blue",
      "planModeRequired": false,
      "joinedAt": 1771220256244,
      "tmuxPaneId": "%6", // tmux pane ID
      "cwd": "/path/to/working/dir",
      "subscriptions": [],
      "backendType": "tmux", // "tmux" or "in-process"
      "isActive": false, // Whether currently running
    },
  ],
}
```

### Could config.json Be Pre-Created?

**Theoretically yes, but practically no.** Here is why:

1. **`leadSessionId` must match an active session**: The `leadSessionId` field must contain the UUID of the actual Claude Code session that will act as lead. This UUID is generated when Claude Code starts and is not predictable in advance. You would need to:
   - Launch Claude Code first
   - Capture the session ID (from the init message or session file)
   - Write it into config.json
   - Hope the running session picks it up (it won't -- see point 3)

2. **`tmuxPaneId` must match real tmux panes**: For tmux-based teams, each teammate's `tmuxPaneId` (e.g., `%6`, `%14`) references an actual tmux pane. These IDs are assigned by tmux at pane creation time and cannot be predicted.

3. **No runtime detection of pre-existing team files**: The Claude Code session does not scan `~/.claude/teams/` on startup to detect whether it belongs to a team. Team context is injected by the `TeamCreate` tool at runtime, which:
   - Creates the config.json
   - Sets internal session state (the `teamName` field appears in session JSONL entries after `TeamCreate` runs)
   - Enables team-specific tools (SendMessage, TaskCreate for teams, etc.)
   - Starts the inbox polling loop for the lead

4. **Session JSONL shows team binding happens at TeamCreate call**: Examining session logs from `/Users/nathan.heaps/.claude/projects/-Users-nathan-heaps-src-nsheaps-agent-team/053d3c48-84a5-4fe2-a849-b4840e386210.jsonl`, the `"teamName"` field first appears on messages AFTER the `TeamCreate` tool completes. Messages before `TeamCreate` have no `teamName` field. This confirms team binding is a runtime state transition, not a startup configuration.

5. **Teammate spawning requires the lead's Task tool**: Teammates are spawned by the lead calling `Task` with `team_name` parameter. The system then:
   - Launches a new Claude Code process (in tmux or in-process)
   - Writes the teammate entry to config.json
   - Creates the teammate's inbox file
   - Delivers the initial prompt to the teammate's inbox
   - Returns the spawn result to the lead

---

## 3. Session State and Team Context

### Where Sessions Are Stored

Sessions are stored in `~/.claude/projects/{encoded-cwd}/{session-id}.jsonl`. Each line is a JSON object representing a message, tool use, or system event.

### Team Context in Session State

The `"teamName"` field appears on session JSONL entries only after `TeamCreate` is called. It is part of the runtime session state, not a persistent configuration. Example progression:

```
Line 1-3: SessionStart hooks — no teamName field
Line 4:   User message "Create a team..." — no teamName field
Line 13:  TeamCreate tool call — teamName: "agent-team" appears HERE
Line 14+: All subsequent messages include teamName: "agent-team"
```

### Resuming Sessions (`--resume`)

The official docs explicitly state [^1]:

> `/resume` and `/rewind` do not restore in-process teammates. After resuming a session, the lead may attempt to message teammates that no longer exist. If this happens, tell the lead to spawn new teammates.

**What `--resume` DOES restore:**

- The lead's conversation history
- The `teamName` in session state (the lead "remembers" it was in a team)
- The lead's awareness of team config at `~/.claude/teams/{team-name}/config.json`

**What `--resume` does NOT restore:**

- Teammate processes (they are gone)
- Inbox polling for teammates
- Active tmux panes for teammates
- The ability to send messages to teammates (they don't exist)

**Practical outcome:** A resumed lead session can read the stale config.json and may try to message teammates, but those messages go to inbox files that no process reads. The lead must spawn new teammates.

---

## 4. Claude Agent SDK

The Claude Agent SDK (Python/TypeScript) provides programmatic access to Claude Code capabilities. Key findings:

### No Team API in the Agent SDK

The Agent SDK `ClaudeAgentOptions` class supports [^3]:

- `allowed_tools`, `permission_mode`, `model`
- `agents` (for subagents, NOT teammates)
- `resume` (session ID for resumption)
- `mcp_servers`, `hooks`, `plugins`
- `system_prompt`, `append_system_prompt`
- `env` (environment variables)

There is **no `team` or `team_name` option** in `ClaudeAgentOptions`. The Agent SDK does not expose team creation or team joining as a programmatic API.

### Potential Workaround via Agent SDK

The Agent SDK supports `resume` with a session ID. If you:

1. Create a team using Claude Code CLI (or via Agent SDK `query()` with a prompt that says "create a team")
2. Capture the lead's session ID
3. Later use `query(options=ClaudeAgentOptions(resume=session_id))` to resume

...the lead session would resume with team context, but teammates would NOT be restored (same limitation as CLI `--resume`).

---

## 5. Theoretical Approaches and Their Feasibility

### Approach A: Pre-create config.json manually

**Feasibility: Low**

You could write `~/.claude/teams/{team-name}/config.json` before launching Claude Code, but:

- The session won't detect it (no startup scan for team files)
- `leadSessionId` can't be set correctly (unknown until session starts)
- Even if you somehow set it, the internal session state won't have `teamName` set
- Team tools (SendMessage, etc.) won't be activated

### Approach B: Use `--resume` to restore a team-lead session

**Feasibility: Medium (with caveats)**

This is the closest thing to "launching into a team context":

1. In a prior session, create a team via `TeamCreate`
2. Record the lead's session ID
3. Later: `claude --resume <session-id>`
4. The lead resumes with team context and can spawn new teammates

**Limitations:**

- Previous teammates are NOT restored
- The lead must re-spawn any needed teammates
- If the team was cleaned up (`TeamCleanup`), the config.json is gone and team context is lost
- Inbox polling may not reinitialize properly [^4]

### Approach C: Use `--system-prompt` to instruct the session to create a team

**Feasibility: Medium**

```bash
claude --append-system-prompt "You are the lead of a team called 'my-team'.
Immediately create the team using TeamCreate and spawn these teammates: ..."
```

This works but still requires `TeamCreate` to run -- it just automates the instruction. Not truly "launching into" a pre-existing team.

### Approach D: External process writes to inbox files directly

**Feasibility: High (for read/write), Low (for full team participation)**

Per the team-storage-internals research [^5], the file-based architecture allows external processes to:

- Read team state from config.json
- Write messages to agent inbox files
- Manage task files (with `.lock` acquisition)

However, an external process CANNOT:

- Register itself as a team member that Claude Code recognizes
- Receive messages via the inbox polling mechanism (that's internal to Claude Code)
- Use team tools like SendMessage

### Approach E: Agent SDK programmatic team creation

**Feasibility: Medium**

```python
from claude_agent_sdk import query, ClaudeAgentOptions

# Create team programmatically by prompting
async for msg in query(
    prompt="Create a team called 'my-team' with a researcher and reviewer",
    options=ClaudeAgentOptions(
        env={"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"},
        permission_mode="bypassPermissions"
    )
):
    pass
```

This automates team creation via the SDK but still relies on `TeamCreate` being called by the model during the session. It's not pre-configuration -- it's programmatic invocation.

---

## 6. Key Findings

1. **No CLI flag or env var exists to join a team at launch.** The `--team` or `--join-team` flag does not exist. [^2]

2. **Team context is a runtime state transition, not a startup configuration.** The `teamName` field appears in session state only after `TeamCreate` runs. There is no mechanism to inject it before the session starts.

3. **Pre-creating config.json does not work** because the session won't detect it, and critical fields (`leadSessionId`, `tmuxPaneId`) can't be known in advance.

4. **`--resume` is the closest workaround** but only restores the lead's team awareness, not teammate processes. Teammates must be re-spawned.

5. **The Agent SDK has no team API.** Teams are not exposed as a first-class concept in `ClaudeAgentOptions`.

6. **The file-based architecture enables external tooling** to read/write team state, but not to fully participate as a team member.

7. **The most practical approach today** is to use `--append-system-prompt` to instruct a new session to create a team immediately upon launch, effectively automating the `TeamCreate` call without manual interaction.

---

## 7. Recommendations

For the agent-team project's launcher, the most viable paths are:

1. **Automate TeamCreate via prompt injection**: Launch Claude Code with `--append-system-prompt` containing instructions to create or resume a team. This is the simplest approach that works within the current architecture.

2. **Use `--resume` for lead persistence**: For the lead session, use `--resume` to maintain team context across restarts. Teammates must be re-spawned.

3. **File-based external coordination**: For external orchestrators, read/write team files directly for observation and task management. Use Claude Code sessions for actual team participation.

4. **Feature request**: File an issue requesting a `--team <team-name>` CLI flag that would:
   - On the lead: detect existing config.json and restore team context (or create new)
   - On teammates: accept team membership parameters and auto-join
   - This would be the ideal solution but does not exist today

---

## References

[^1]: [Orchestrate teams of Claude Code sessions -- Limitations](https://code.claude.com/docs/en/agent-teams#limitations) -- "No session resumption with in-process teammates"

[^2]: [System Prompt Flags Research](./system-prompt-flags-research.md) -- "No `--team` flag exists"

[^3]: [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- ClaudeAgentOptions API

[^4]: [GitHub Issue #23415](https://github.com/anthropics/claude-code/issues/23415) -- Inbox polling failures after session resume

[^5]: [Team Storage Internals](./team-storage-internals.md) -- File-based architecture analysis

[^6]: [Agent Teams Messaging -- External Research](./agent-teams-messaging-external.md) -- SendMessage tool schema and inbox system

[^7]: [CLI Help Output](claude --help, v2.1.49) -- Full flag enumeration

[^8]: [Session JSONL analysis](~/.claude/projects/-Users-nathan-heaps-src-nsheaps-agent-team/053d3c48-84a5-4fe2-a849-b4840e386210.jsonl) -- Team binding appears after TeamCreate
