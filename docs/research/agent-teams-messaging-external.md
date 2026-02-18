# Agent Teams Messaging System -- External Research

**Date**: 2026-02-17
**Sources**: Official docs, GitHub issues, system prompt extractions, community implementations
**Claude Code version at time of research**: v2.1.44

---

## 1. SendMessage Tool -- Complete Schema

The SendMessage tool is the sole mechanism for inter-agent communication. Plain text output from an agent is NOT visible to teammates or the team lead. All communication MUST go through SendMessage.

Source: [Piebald-AI system prompt extraction -- SendMessageTool](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-sendmessagetool.md)

### 1.1 type: "message" (Direct Message)

```json
{
  "type": "message",
  "recipient": "<teammate-name>",
  "content": "<message text>",
  "summary": "<5-10 word preview>"
}
```

**Required fields**: `recipient`, `content`, `summary`

- Sends to exactly one teammate, identified by name (e.g., `"researcher"`, `"team-lead"`)
- Never use agent UUIDs for recipient; always use human-readable names
- The `summary` field (5-10 words) was added in v2.1.30 as a required field

### 1.2 type: "broadcast" (All Teammates)

```json
{
  "type": "broadcast",
  "content": "<message to all teammates>",
  "summary": "<5-10 word preview>"
}
```

**Required fields**: `content`, `summary`

- Sends to ALL teammates simultaneously
- No `recipient` field (implicit: everyone)
- Expensive: each broadcast consumes separate API resources scaling linearly with team size
- Guidance: use only for critical issues requiring immediate team-wide attention or major announcements affecting everyone equally
- Default to `message` for normal communication

### 1.3 type: "shutdown_request"

```json
{
  "type": "shutdown_request",
  "recipient": "<teammate-name>",
  "content": "<reason for shutdown>"
}
```

- Sent by the lead to request a teammate gracefully exit
- Teammate receives this as a JSON message and must respond with `shutdown_response`
- Teammate can approve (exit) or reject (continue working)

### 1.4 type: "shutdown_response"

**Approve:**
```json
{
  "type": "shutdown_response",
  "request_id": "<id-from-shutdown-request>",
  "approve": true
}
```

**Reject:**
```json
{
  "type": "shutdown_response",
  "request_id": "<id-from-shutdown-request>",
  "approve": false,
  "content": "Still working on task #3, need 5 more minutes"
}
```

- `request_id` must be extracted from the received shutdown request JSON
- Simply stating approval in plain text is insufficient; the tool call is required

### 1.5 type: "plan_approval_response"

**Approve:**
```json
{
  "type": "plan_approval_response",
  "request_id": "<id-from-plan-request>",
  "recipient": "<teammate-name>",
  "approve": true
}
```

**Reject:**
```json
{
  "type": "plan_approval_response",
  "request_id": "<id-from-plan-request>",
  "recipient": "<teammate-name>",
  "approve": false,
  "content": "Please add error handling for the API calls"
}
```

- Used by the lead to respond to plan approval requests from teammates in plan mode
- Rejected plans cause the teammate to stay in plan mode, revise, and resubmit
- Approved plans cause the teammate to exit plan mode and begin implementation

### 1.6 Notably ABSENT: "plan_approval_request"

There is NO explicit `plan_approval_request` type in the SendMessage tool schema. Plan approval requests appear to be generated **automatically by the system** when a teammate in plan mode finishes planning. The teammate does not manually call SendMessage to request plan approval -- the system handles this. Only the **response** (`plan_approval_response`) is a SendMessage type.

### 1.7 Complete List of Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `message` | Any agent to any agent | Direct 1:1 communication |
| `broadcast` | Any agent to all teammates | Team-wide announcement |
| `shutdown_request` | Lead to teammate | Request graceful exit |
| `shutdown_response` | Teammate to lead | Accept/reject shutdown |
| `plan_approval_response` | Lead to teammate | Accept/reject plan |

These are the ONLY five types in the SendMessage tool schema as of v2.1.44.

---

## 2. Inbox / Mailbox System

### 2.1 Storage Location

Messages are stored as JSON files in the filesystem:

```
~/.claude/teams/{team-name}/inboxes/{agent-name}.json
```

Each agent has their own inbox file. For example:
- `~/.claude/teams/my-project/inboxes/team-lead.json`
- `~/.claude/teams/my-project/inboxes/researcher.json`

Source: [GitHub issue #23415 -- inbox file evidence](https://github.com/anthropics/claude-code/issues/23415)

### 2.2 Inbox Message Format

Each inbox file is a JSON array of message objects:

```json
[
  {
    "from": "team-lead",
    "text": "Hello world!",
    "summary": "Saying hello world to alice",
    "timestamp": "2026-02-05T18:56:10.615Z",
    "read": false
  }
]
```

**Fields**:
- `from`: sender name
- `text`: message content
- `summary`: brief preview
- `timestamp`: ISO 8601 timestamp
- `read`: boolean, starts as `false`, set to `true` after delivery

### 2.3 Delivery Mechanism

- **Write side**: When agent A calls `SendMessage` targeting agent B, the system appends a JSON object to B's inbox file
- **Read side**: Agents poll their inbox file between turns (not during a turn)
- **Polling interval**: Approximately 1 second based on debug logs (`TeammateMailbox.readMailbox()`)
- **Injection**: Received messages are injected into the agent's conversation as user-turn content, wrapped in XML: `<teammate-message teammate_id="[agent_id]">...</teammate-message>`
- **Automatic**: The official docs and system prompts state "Messages are automatically delivered; no manual inbox checking required"

Source: [VibeCodeCamp reverse-engineering article](https://vibecodecamp.blog/blog/how-to-install-and-use-claude-code-agent-teams-reverse-engineered)

### 2.4 Concurrency Control

- Task claiming uses file locking to prevent race conditions
- The `claude-code-teams-mcp` reimplementation uses atomic writes (`tempfile` + `os.replace`) and cross-platform file locking (`filelock` library) for inbox access
- The native implementation likely uses similar mechanisms

Source: [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp)

### 2.5 Idle Notifications

- When a teammate's turn ends, the system automatically sends an idle notification to the lead
- Idle does NOT mean done or unavailable; it means waiting for input
- Sending a message to an idle teammate wakes them up
- **Peer DM visibility**: When teammate A sends a DM to teammate B, a brief summary is included in A's idle notification to the lead. This gives the lead visibility into peer collaboration without full message content.

Source: [Piebald-AI TeammateTool description](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-teammatetool.md)

---

## 3. Rooms, Channels, and Group Conversations

**None exist.** The messaging system is flat:

- **1:1 direct messages** (`type: "message"`)
- **1:all broadcasts** (`type: "broadcast"`)

There are no:
- Named rooms or channels
- Group conversations with subset membership
- Topic-based routing
- Message threading
- Subscription-based messaging

The only way to communicate with a subset of teammates is to send individual `message` calls to each one. Broadcast is all-or-nothing.

The coordination topology is:
- **Hub-and-spoke** for task management (lead creates/assigns tasks)
- **Mesh** for messaging (any teammate can message any other teammate directly)
- In practice, most communication flows through the lead, but peer-to-peer DMs are supported

---

## 4. Team Configuration and Discovery

### 4.1 Team Config File

```
~/.claude/teams/{team-name}/config.json
```

Contains a `members` array:

```json
{
  "members": [
    {
      "name": "researcher",
      "agentId": "abc-123-...",
      "agentType": "general-purpose"
    }
  ]
}
```

- Teammates can read this file to discover other team members
- Always use `name` for messaging, never `agentId`

Note: Older versions used `~/.claude/teams/{team-name}.json` (flat file). Current versions (v2.1.44) use `~/.claude/teams/{team-name}/config.json` (directory with config).

### 4.2 Task Storage

```
~/.claude/tasks/{team-name}/
```

Tasks are JSON files with status tracking, ownership, and dependency management.

---

## 5. Known Bugs and Limitations (as of v2.1.44)

### 5.1 Inbox Polling Failures

The most commonly reported bug. Multiple variations:

| Issue | Description | Status |
|-------|-------------|--------|
| [#23415](https://github.com/anthropics/claude-code/issues/23415) | Teammates don't poll inbox in tmux mode on macOS | Open |
| [#24108](https://github.com/anthropics/claude-code/issues/24108) | Teammates stuck at idle, mailbox never polled | Open |
| [#24771](https://github.com/anthropics/claude-code/issues/24771) | Split panes open but teammates disconnected from messaging | Open |
| [#25254](https://github.com/anthropics/claude-code/issues/25254) | Messages not delivered in VS Code extension | Open |

**Root cause (from debug logs)**: The `TeammateMailbox.readMailbox()` polling loop doesn't reinitialize when resuming a session with an existing team. The polling starts during initial team creation but never restarts after session end/resume.

**Workaround**: Full restart: exit Claude Code, `pkill -f claude`, `tmux kill-server`, wait 5 seconds, restart fresh.

Source: [Issue #23415 comment by tylerR94](https://github.com/anthropics/claude-code/issues/23415#issuecomment-3888523110)

### 5.2 ENV Variable Requirement

Setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `settings.json` alone may not be sufficient for teammates. One user found it must be set in the shell environment for spawned teammates to properly initialize team context.

Source: [Issue #23415 comment by ianterrell](https://github.com/anthropics/claude-code/issues/23415#issuecomment-3855978540)

### 5.3 Zombie Agents

Teammates can persist as zombie processes (0 tokens, 0 tool uses) that:
- Never receive their prompts
- Survive session compaction
- Cannot be shut down via SendMessage (messages go undelivered)
- Block `Teammate cleanup` ("Cannot cleanup team with N active member(s)")
- Require manual `kill` + `rm -rf ~/.claude/teams/{name} ~/.claude/tasks/{name}`

Source: [Issue #23415 comment by oskarmodig](https://github.com/anthropics/claude-code/issues/23415#issuecomment-3858847183)

### 5.4 No Session Resumption for Teammates

`/resume` and `/rewind` do not restore in-process teammates. After resuming, the lead may attempt to message teammates that no longer exist.

### 5.5 Delegate Mode Bug

[#25037](https://github.com/anthropics/claude-code/issues/25037) -- Teammates inherit delegate mode restrictions incorrectly, losing file access tools.

---

## 6. System Prompt Architecture

Three system prompt files govern teammate communication:

| File | Tokens | Purpose |
|------|--------|---------|
| `system-prompt-teammate-communication.md` | ~127 | Core instruction: use SendMessage, text is invisible |
| `system-reminder-team-coordination.md` | ~247 | Team coordination reminders |
| `system-reminder-team-shutdown.md` | ~136 | Shutdown protocol instructions |

Full text of the teammate communication prompt:

> IMPORTANT: You are running as an agent in a team. To communicate with anyone on your team:
> - Use the SendMessage tool with type `message` to send messages to specific teammates
> - Use the SendMessage tool with type `broadcast` sparingly for team-wide announcements
>
> Just writing a response in text is not visible to others on your team -- you MUST use the SendMessage tool.
>
> The user interacts primarily with the team lead. Your work is coordinated through the task system and teammate messaging.

Source: [Piebald-AI teammate-communication prompt](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/system-prompt-teammate-communication.md)

---

## 7. Evolution of the Messaging System (from CHANGELOG)

| Version | Change |
|---------|--------|
| v2.1.20 | Added SendMessageTool and teammate communication system prompt. Removed broadcast from TeammateTool operations. |
| v2.1.30 | **Major restructure**: Flattened protocol to use specific types (`shutdown_request`, `shutdown_response`, `plan_approval_response`). Added required `summary` field for `message` and `broadcast`. Removed nested request/response architecture. |
| v2.1.32 | Removed structured JSON status message requirement for teammates. Added automatic message delivery note. Simplified TeammateTool to core team management. |

Source: [Piebald-AI CHANGELOG](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/CHANGELOG.md)

---

## 8. Undocumented / Lightly Documented Features

### 8.1 Peer DM Summaries in Idle Notifications

When teammate A DMs teammate B, the lead receives a brief summary of the DM as part of A's idle notification. This is mentioned in the TeammateTool system prompt but NOT in the official docs page. It provides passive observability without full message forwarding.

### 8.2 Message Injection Format

Messages are injected into conversations using XML-style markup:
```
<teammate-message teammate_id="[agent_id]">message content</teammate-message>
```
This is not documented anywhere official; it was reverse-engineered from logs.

### 8.3 Queued Delivery During Active Turns

If a teammate is mid-turn when a message arrives, the message is queued and delivered when their turn ends. The UI shows a brief notification with the sender's name while messages are waiting. This is mentioned in the TeammateTool prompt but not the official docs.

### 8.4 No Read Receipts or Delivery Confirmation

There is no mechanism for confirming a message was read or delivered. The sender gets a tool result confirming the write to the inbox file, but there is no notification when the recipient actually processes it.

### 8.5 Communication Restrictions

The official `claude-code-teams-mcp` reimplementation enforces a restriction that **teammates can only message the lead/coordinator**, not each other. However, the native Claude Code implementation allows **any teammate to message any other teammate** (true mesh). It is unclear if this restriction exists in the native implementation but is unenforced, or if it's a simplification in the MCP reimplementation.

---

## 9. Comparison: Native vs. MCP Reimplementation

| Feature | Native (Claude Code) | claude-code-teams-mcp |
|---------|---------------------|----------------------|
| Inbox storage | `~/.claude/teams/<team>/inboxes/` | Same path convention |
| Concurrency | File locking (implementation unclear) | `filelock` + atomic `os.replace` |
| Peer messaging | Any-to-any (mesh) | Lead-only (hub-and-spoke) |
| Broadcast | Lead can broadcast to all | Lead-only broadcast |
| Message types | 5 types (message, broadcast, shutdown_*, plan_approval_*) | DM, broadcast, shutdown, plan responses |

Source: [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp)

---

## 10. Summary of Findings

1. **DMs** work via filesystem-based JSON inboxes with ~1s polling. Messages are appended to `~/.claude/teams/{team}/inboxes/{name}.json` and injected as conversation turns.
2. **Broadcasts** are 1:all with no filtering. They scale linearly in cost. No subset targeting.
3. **No rooms/channels exist.** The topology is flat: 1:1 or 1:all. No group conversations, topics, or subscription patterns.
4. **Five message types** exist in SendMessage: `message`, `broadcast`, `shutdown_request`, `shutdown_response`, `plan_approval_response`. Notably, `plan_approval_request` is NOT a SendMessage type -- it's system-generated.
5. **The inbox is file-based JSON** with `from`, `text`, `summary`, `timestamp`, `read` fields. Polling is between turns, not during.
6. **Major known issue**: Inbox polling frequently fails to initialize in tmux mode, leaving teammates orphaned. No fix shipped as of v2.1.44.
