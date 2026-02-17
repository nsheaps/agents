# Agent Teams Storage Internals

Research into the on-disk storage format used by Claude Code agent teams, based on analysis of the `looney-tunes` team.

**Date**: 2026-02-16
**Source team**: `looney-tunes` (5 members, created 2026-02-16T03:50:49Z)
**Claude Code version**: Current as of 2026-02-16

## Overview

Claude Code agent teams persist state in two directory trees under `~/.claude/`:

| Path                                | Purpose                                  |
| ----------------------------------- | ---------------------------------------- |
| `~/.claude/teams/{team-name}/`      | Team configuration and agent inboxes     |
| `~/.claude/tasks/{team-name}/`      | Shared task board with file-based locking |

Both directories are keyed by team name (e.g., `looney-tunes`). State is stored as JSON files with no database layer -- purely file-based.

## Team Configuration (`~/.claude/teams/{team-name}/`)

### Directory Structure

```
~/.claude/teams/looney-tunes/
  config.json
  inboxes/
    team-lead.json
    Wile-E--Coyote--Team-Coach-.json
    Tweety-Bird--Technical-Writer-.json
    Road-Runner--Researcher-.json
    Foghorn-Leghorn--Ops-Engineer-.json
    ...
```

### config.json

The team configuration file. Contains team metadata and the full member roster.

#### Schema

```jsonc
{
  "name": "string",              // Team name, used as directory key
  "description": "string",       // Human-readable description
  "createdAt": 1771213849309,    // Epoch milliseconds (team creation time)
  "leadAgentId": "string",       // Agent ID of the team lead (format: "{name}@{team-name}")
  "leadSessionId": "string",     // UUID of the lead's Claude Code session
  "members": [                   // Array of member objects (includes the lead)
    { /* member object */ }
  ]
}
```

#### Member Object Schema

Members come in two variants: **team-lead** and **teammate**.

**Team lead member** (minimal fields):

```jsonc
{
  "agentId": "team-lead@looney-tunes",   // Format: "{name}@{team-name}"
  "name": "team-lead",                    // Always "team-lead" for the lead
  "agentType": "team-lead",               // Always "team-lead"
  "model": "claude-opus-4-6",             // Model ID
  "joinedAt": 1771213849309,              // Epoch ms (same as team createdAt)
  "tmuxPaneId": "",                        // Empty string for the lead
  "cwd": "/path/to/working/dir",          // Working directory
  "subscriptions": []                      // Always empty array (observed)
}
```

**Teammate member** (full fields):

```jsonc
{
  "agentId": "Wile E. Coyote (Team Coach)@looney-tunes",  // Full display name @ team
  "name": "Wile E. Coyote (Team Coach)",                   // Display name
  "agentType": "general-purpose",                           // Agent type (matches .claude/agents/ filename stem)
  "model": "claude-opus-4-6",
  "prompt": "You are Wile E. Coyote, the Team Coach...",   // Full system prompt (can be very long)
  "color": "blue",                                          // Terminal color for output
  "planModeRequired": false,                                // Whether agent needs plan approval
  "joinedAt": 1771213868407,                                // Epoch ms (when spawned)
  "tmuxPaneId": "%1",                                       // tmux pane identifier
  "cwd": "/path/to/working/dir",
  "subscriptions": [],                                      // Always empty (observed)
  "backendType": "tmux",                                    // "tmux" or "in-process"
  "isActive": false                                         // Whether currently running
}
```

#### Field Differences: Lead vs Teammate

| Field             | Team Lead    | Teammate               |
| ----------------- | ------------ | ---------------------- |
| `prompt`          | Absent       | Present (full prompt)  |
| `color`           | Absent       | Present                |
| `planModeRequired`| Absent       | Present                |
| `backendType`     | Absent       | Present ("tmux")       |
| `isActive`        | Absent       | Present (boolean)      |
| `tmuxPaneId`      | Empty `""`   | tmux pane ID (e.g., "%1") |

#### Observations

- The `prompt` field stores the **entire system prompt** passed at spawn time. For agents with long prompts, this can be thousands of characters.
- The `subscriptions` array was empty for all members observed. Its purpose is unclear -- possibly for pub/sub message filtering that is not yet implemented or was not used.
- `isActive` only appears on teammates and reflects whether the agent's session is running. In the observed team, only Foghorn Leghorn had `isActive: true` (the most recently spawned agent); others had `false` (halted).
- Colors observed: blue, green, yellow, purple. The lead has no color.
- `joinedAt` timestamps show spawn order and timing gaps between team members.

### Inboxes (`inboxes/`)

Each agent has a JSON file in the `inboxes/` directory. The file is a JSON array of message objects.

#### Inbox File Naming Convention

Agent names are transformed into filenames by:

1. Replacing spaces with hyphens (`-`)
2. Replacing parentheses with hyphens (`-`)
3. Preserving periods (`.`) -- e.g., `Wile E.` becomes `Wile-E-`
4. Appending `.json`

**Observed pattern (regex):** The transformation appears to be: replace `[ ()]` with `-`, then append `.json`.

| Agent Name                          | Inbox Filename                            |
| ----------------------------------- | ----------------------------------------- |
| `team-lead`                         | `team-lead.json`                          |
| `Wile E. Coyote (Team Coach)`      | `Wile-E--Coyote--Team-Coach-.json`        |
| `Tweety Bird (Technical Writer)`    | `Tweety-Bird--Technical-Writer-.json`      |
| `Road Runner (Researcher)`          | `Road-Runner--Researcher-.json`            |
| `Foghorn Leghorn (Ops Engineer)`    | `Foghorn-Leghorn--Ops-Engineer-.json`      |

**Note on double hyphens:** The double hyphens (`--`) result from a space followed by a parenthesis. For example, `Coyote (Team` becomes `Coyote--Team` because the space becomes `-` and the `(` becomes `-`.

#### Message Object Schema

```jsonc
{
  "from": "string",              // Sender's display name (e.g., "team-lead", "Wile E. Coyote (Team Coach)")
  "text": "string",              // Message content (plain text or JSON-encoded structured message)
  "timestamp": "string",         // ISO 8601 timestamp (e.g., "2026-02-16T03:51:08.407Z")
  "read": true,                  // Boolean: whether the recipient has read the message

  // Optional fields (present on some messages):
  "summary": "string",           // Short summary (appears when sender provides one via SendMessage)
  "color": "string"              // Sender's team color (absent for team-lead messages, present for teammate messages)
}
```

#### Message Types Observed in `text` Field

The `text` field carries several types of content:

1. **Plain text messages** -- Regular communication between agents.

2. **Initial prompt** -- The very first message in each teammate's inbox is the full system prompt (same as the `prompt` field in config.json). This is how the agent receives its role instructions.

3. **Structured JSON messages** -- Some messages contain JSON-encoded objects in the `text` field:

   **Task assignment:**
   ```jsonc
   {
     "type": "task_assignment",
     "taskId": "4",
     "subject": "Create nsheaps/agent-team repo with CI and prettier",
     "description": "Full task description...",
     "assignedBy": "team-lead",
     "timestamp": "2026-02-16T04:14:22.026Z"
   }
   ```

   **Idle notification:**
   ```jsonc
   {
     "type": "idle_notification",
     "from": "Road Runner (Researcher)",
     "timestamp": "2026-02-16T03:52:47.066Z",
     "idleReason": "available",
     "summary": "[to Elmer Fudd (Project Manager)] Research in progress, 3 sub-agents running"  // Optional
   }
   ```

4. **Messages with markdown** -- Many messages contain full markdown formatting, tables, code blocks, etc. The inbox system preserves all formatting.

#### `read` Field Behavior

- Messages from the team-lead to teammates are marked `"read": true` once the teammate has processed them.
- Messages from teammates to recipients that never read them (e.g., the `orchestrator.json` stale inbox) remain `"read": false`.
- The first message (system prompt injection) in each teammate's inbox is always `"read": true`.

#### `summary` Field

- **Not always present.** The initial system prompt message has no summary.
- **Present when the sender includes one** via the `SendMessage` tool's `summary` parameter.
- Used for UI preview in the team lead's view (idle notifications show summaries).

#### `color` Field on Messages

- **Absent** when the sender is `team-lead` (the lead has no assigned color).
- **Present** when the sender is a teammate -- matches the `color` field from their member entry in config.json.

#### Inbox File Sizes

Inbox sizes vary dramatically based on communication volume:

| Inbox                                | Size       | Notes                                    |
| ------------------------------------ | ---------- | ---------------------------------------- |
| `team-lead.json`                     | 189 KB     | Receives ALL teammate messages           |
| `Tweety-Bird--Technical-Writer-.json`| 62 KB      | Heavy communication (writer role)        |
| `Wile-E--Coyote--Team-Coach-.json`  | 45 KB      | Receives failure reports from all agents |
| `Road-Runner--Researcher-.json`      | 34 KB      | Research assignments + follow-ups        |
| `Foghorn-Leghorn--Ops-Engineer-.json`| 28 KB      | Ops tasks + status messages              |
| `Bugs-Bunny--Team-Lead-.json`       | 5 KB       | Orphaned -- wrong recipient messages     |
| `orchestrator.json`                  | 4 KB       | Stale -- alternate lead name             |
| `Elmer-Fudd--Project-Manager-.json` | 3 KB       | Orphaned -- agent never launched         |
| `Tweety-Bird--Docs-Writer-.json`    | 1 KB       | New name after rename                    |
| `coach.json`                         | 1 KB       | Stale -- old name before rename          |

#### Stale and Orphaned Inboxes

The inbox system creates files on-demand when a message is sent to any recipient name, regardless of whether that agent exists. This leads to several categories of stale inboxes:

| Inbox File                          | Category     | Explanation                                                     |
| ----------------------------------- | ------------ | --------------------------------------------------------------- |
| `coach.json`                        | Stale/renamed| Old inbox before Wile E. Coyote was renamed from "coach"        |
| `orchestrator.json`                 | Stale/alias  | Alternate name someone used for the team-lead                   |
| `Bugs-Bunny--Team-Lead-.json`      | Orphaned     | Road Runner repeatedly messaged "Bugs Bunny (Team Lead)" thinking that was the team lead. Agent was never launched. |
| `Elmer-Fudd--Project-Manager-.json`| Orphaned     | Road Runner messaged PM before it was launched. Agent never spawned. |
| `Tweety-Bird--Docs-Writer-.json`   | Current      | New inbox after role rename from "Technical Writer" to "Docs Writer" |
| `Tweety-Bird--Technical-Writer-.json`| Stale/renamed| Old inbox from before the rename                                |

**Key finding:** The `SendMessage` tool silently succeeds when sending to a non-existent recipient. The message is written to an inbox file (creating it if needed), but no agent ever reads it. This was identified as a platform-level issue during the looney-tunes session -- it caused significant communication failures (messages to unlaunched Elmer Fudd and non-existent "Bugs Bunny (Team Lead)" were silently lost).

**No garbage collection.** Stale inbox files are never cleaned up. They persist indefinitely. Old inboxes from before agent renames sit alongside current ones.

## Task Storage (`~/.claude/tasks/{team-name}/`)

### Directory Structure

```
~/.claude/tasks/looney-tunes/
  .highwatermark       # Next task ID to allocate
  .lock                # File-based lock for concurrent access
  4.json               # Task files (one per task)
  5.json
  6.json
  ...
  40.json
```

### Task Files (`{id}.json`)

Each task is stored as a separate JSON file named `{id}.json`.

#### Schema

```jsonc
{
  "id": "string",               // Task ID (string, not number, matches filename)
  "subject": "string",          // Short task title
  "description": "string",      // Full task description (can be very long)
  "activeForm": "string",       // Present-tense gerund describing current activity (e.g., "Creating agent-team repo")
  "status": "string",           // One of: "pending", "in_progress", "completed"
  "blocks": ["string"],         // Array of task IDs that THIS task blocks (downstream dependencies)
  "blockedBy": ["string"],      // Array of task IDs that block THIS task (upstream dependencies)

  // Optional:
  "owner": "string"             // Agent display name (e.g., "Foghorn Leghorn (Ops Engineer)")
}
```

#### Field Details

| Field         | Required | Description                                                          |
| ------------- | -------- | -------------------------------------------------------------------- |
| `id`          | Yes      | String ID matching the filename (without `.json`)                    |
| `subject`     | Yes      | Short title, typically 5-15 words                                    |
| `description` | Yes      | Full description; can include markdown, instructions, file paths     |
| `activeForm`  | Yes      | Gerund phrase describing current work (e.g., "Analyzing team storage internals") |
| `status`      | Yes      | `"pending"`, `"in_progress"`, or `"completed"`                       |
| `blocks`      | Yes      | Array of task ID strings this task blocks (empty array `[]` if none) |
| `blockedBy`   | Yes      | Array of task ID strings blocking this task (empty array `[]` if none) |
| `owner`       | No       | Present on most tasks, absent on some (e.g., task #6 and #9 have no owner) |

#### Status Values Observed

| Status        | Meaning                                          | Count |
| ------------- | ------------------------------------------------ | ----- |
| `completed`   | Work is done                                     | ~25   |
| `in_progress` | Agent is actively working on this                | 2     |
| `pending`     | Not yet started or awaiting dependencies         | ~4    |

**Note:** There is no `cancelled` or `deleted` status. Cancelled tasks are deleted from disk entirely (their `.json` file is removed). This explains the gaps in the ID sequence.

#### Dependency Model

Tasks use a bidirectional dependency system:

- `blocks`: "If I'm not done, these tasks cannot start" (downstream)
- `blockedBy`: "I cannot start until these tasks are done" (upstream)

Example from the observed team:
- Task #4 (create repo) has `"blocks": ["6", "7", "10"]` -- three tasks depend on it
- Task #10 (write agent files) has `"blockedBy": ["4"]` -- needs the repo first

Both directions must be maintained manually. There is no automatic consistency enforcement -- if task A lists B in `blocks`, task B should list A in `blockedBy`, but this is convention, not enforced.

#### Missing Task IDs

The following task IDs have no corresponding `.json` file on disk:

| Missing IDs | Likely Explanation                                                |
| ----------- | ----------------------------------------------------------------- |
| 1, 2, 3     | Early tasks that were self-assigned by teammates and later deleted |
| 8            | Unknown -- possibly a cancelled duplicate                         |
| 14           | Skipped or deleted                                                |
| 31, 32       | Explicitly cancelled by team-lead ("marketplace research" and "marketplace implementation") |
| 34           | The .highwatermark says "34" but no 34.json exists -- this was likely allocated and immediately deleted |

### Metadata Files

#### `.highwatermark`

- **Contents:** `34` (a plain text integer, 2 bytes on disk)
- **Purpose:** Tracks the next task ID to allocate.
- **Behavior analysis:** The highest existing task ID is **40**, but the highwatermark reads **34**. This creates an apparent inconsistency:
  - Tasks 35-40 exist on disk but have IDs above the highwatermark.
  - **Interpretation:** The highwatermark appears to be **stale** -- it was last written when task 34 was created, and subsequent task creation by teammates may have been done through the inbox messaging system (agents self-assigning tasks by creating files directly) rather than through the centralized allocation mechanism.
  - Alternatively, the highwatermark may track something other than the global maximum -- perhaps each agent maintains its own counter, or the highwatermark is only updated by the team-lead's task creation flow.
  - **Another possibility:** Tasks 35-40 were created by teammates using `TaskWrite` directly, which may not update the highwatermark. The highwatermark may only be used by the team-lead's `TaskCreate` flow.

#### `.lock`

- **Size:** 0 bytes
- **Created:** 2026-02-15T22:50 (before the team was created, suggesting it was created during task system initialization)
- **Purpose:** File-based lock for concurrent access to the task directory.
- **Mechanism:** Almost certainly uses POSIX advisory locking (`flock` or `fcntl`). The file itself is empty -- the lock state is maintained by the kernel's file locking subsystem, not by file contents. When an agent needs to read/write tasks, it acquires a lock on this file; other agents attempting to lock will block until the lock is released.
- **Implication for orchestration:** Any external tooling that reads/writes task files should also acquire this lock to avoid race conditions.

## Observations

### 1. No Session State Files

There are no session-specific state files in the team directory. The `leadSessionId` in config.json is the only session reference. Agent sessions are tracked by Claude Code's own session management (in `~/.claude/projects/`), not in the team directory.

### 2. Inbox Files Are Append-Only Arrays

Each inbox is a JSON array. New messages are appended to the end. There is no message deletion, archival, or pagination. Over a long session, inbox files grow without bound -- the team-lead's inbox reached **189 KB** in a single session. This could become a performance concern for long-running teams.

### 3. No Message IDs

Messages in inboxes have no unique identifier. There is no way to reference a specific message except by timestamp + sender + content. This makes it impossible to reply to a specific message or track message chains.

### 4. Task ID as String

Task IDs are stored as strings (`"id": "4"`), not numbers, even though they are sequential integers. The filename is `4.json` (without leading zeros). This means filesystem sorting does not match numeric order for IDs >= 10.

### 5. Implicit Agent Discovery

The team system creates inbox files on-demand for any recipient name. There is no validation that the recipient is a registered team member. This is the root cause of the "silent success" messaging bug -- messages to non-existent agents create orphaned inbox files that nobody reads.

### 6. No Tombstones for Deleted Tasks

When tasks are cancelled/deleted, their `.json` file is simply removed from disk. There is no tombstone, no deletion log, and no way to recover the task's metadata after deletion. The gaps in the ID sequence are the only evidence that tasks once existed.

### 7. Config.json is Write-Once-ish

The config.json appears to be written at team creation and updated when members join. The `isActive` field on members is updated as agents start/stop. However, there is no observed mechanism for removing members from the config -- even if an agent is shut down, its member entry persists with `isActive: false`.

### 8. Timestamps

Two timestamp formats coexist:

| Context               | Format                           | Example                       |
| --------------------- | -------------------------------- | ----------------------------- |
| config.json fields    | Epoch milliseconds (number)      | `1771213849309`               |
| Inbox message fields  | ISO 8601 string                  | `"2026-02-16T03:51:08.407Z"` |

This inconsistency suggests different parts of the codebase handle timestamp serialization differently.

## Key Findings for Orchestration

### 1. The Inbox System is the Primary Communication Channel

All agent-to-agent communication goes through inbox files. The `SendMessage` tool writes to the recipient's inbox file; the recipient polls its inbox for new messages (identified by `"read": false`). This is a simple, file-based pub/sub system.

**Implication:** An external orchestrator could participate in team communication by reading/writing inbox files directly, without needing Claude Code's internal APIs. However, it would need to handle the file naming convention and JSON format.

### 2. Task System is Decentralized

Any agent can create, read, and update task files. The `.lock` file provides basic concurrency control, but there is no central authority enforcing task state transitions. Agents self-assign tasks by writing their name to the `owner` field.

**Implication:** An external orchestrator could manage the task board by reading/writing task JSON files, but must acquire the `.lock` before modifications.

### 3. The Highwatermark Problem

The highwatermark appears unreliable for determining the next available task ID when multiple agents create tasks concurrently. External tooling should scan existing task files to find the true maximum ID rather than relying on `.highwatermark`.

### 4. No Cleanup Mechanism

Stale inboxes, completed tasks, and inactive member entries accumulate indefinitely. A long-running team would benefit from periodic cleanup, but no such mechanism exists in the current implementation.

### 5. Full Prompt Storage in Config

The complete system prompt for each teammate is stored in config.json. This means config.json grows linearly with team size and prompt length. For the 5-member looney-tunes team, config.json is a manageable size, but teams with many agents or very long prompts could have large config files.

### 6. File-Based Architecture Enables External Tooling

Because all state is in plain JSON files with no database or daemon process, external tools can:

- Read team state by parsing config.json
- Monitor communication by watching inbox files
- Manage tasks by reading/writing task JSON files (with `.lock` acquisition)
- Detect agent activity by checking `isActive` flags and message timestamps

This file-based architecture is a significant advantage for the agent-team project's goal of provider-agnostic orchestration.

## References

- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Plugin Documentation](https://code.claude.com/docs/en/plugins)
- [Delegate mode bug (GitHub #25037)](https://github.com/anthropics/claude-code/issues/25037)
- [Simultaneous spawning garbling (GitHub #23615)](https://github.com/anthropics/claude-code/issues/23615)
- [OpenCode agent teams porting research](./opencode-agent-teams-porting.md)
- [claude-flow research](./claude-flow.md)
- Source data: `~/.claude/teams/looney-tunes/` and `~/.claude/tasks/looney-tunes/` (analyzed 2026-02-16)
