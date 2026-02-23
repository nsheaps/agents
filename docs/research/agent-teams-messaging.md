# Agent Teams Messaging System — Comprehensive Research

**Status**: Complete
**Date**: 2026-02-18
**Author**: Road Runner (Researcher)
**Task**: #188 — Research agent teams messaging (DMs, broadcasts, rooms/channels, inbox internals)
**Sub-reports**:

- [External Research](./agent-teams-messaging-external.md)
- [Source Code Analysis](./agent-teams-messaging-source.md)
- [Room-Based Messaging Patterns](./room-based-messaging-patterns.md)

---

## Executive Summary

Claude Code's agent teams messaging system (as of v2.1.44) is a **file-based, flat-topology** communication layer built on JSON inbox files and filesystem polling. It supports exactly two addressing modes — **1:1 direct messages** and **1:all broadcasts** — with no rooms, channels, groups, or topic-based routing. Messages are injected into the recipient's conversation as XML-tagged turns, meaning every message consumes context tokens.

The system works but has significant limitations for long-running, multi-agent sessions:

1. **No selective delivery** — all messages enter the recipient's context window
2. **No rooms or channels** — no way to organize communication by topic
3. **No digest or summary mechanism** — agents receive raw messages, never summaries
4. **Polling reliability issues** — inbox polling frequently fails to reinitialize after session resume (4+ open bugs)
5. **Context pollution** — the lead's context fills with status updates, heartbeats, and routine chatter

These limitations motivate the room-based messaging abstraction proposed for the agent-team project.

---

## Part 1: How the Current System Works

### 1.1 SendMessage Tool — The Only Communication Channel

All inter-agent communication goes through `SendMessage`. Plain text output from an agent is **not visible** to teammates or the team lead. Five message types exist:

| Type                     | Direction       | Required Fields                      | Purpose                |
| ------------------------ | --------------- | ------------------------------------ | ---------------------- |
| `message`                | Any → any       | `recipient`, `content`, `summary`    | 1:1 direct message     |
| `broadcast`              | Any → all       | `content`, `summary`                 | Team-wide announcement |
| `shutdown_request`       | Lead → teammate | `recipient`, `content`               | Request graceful exit  |
| `shutdown_response`      | Teammate → lead | `request_id`, `approve`              | Accept/reject shutdown |
| `plan_approval_response` | Lead → teammate | `request_id`, `recipient`, `approve` | Accept/reject plan     |

**Notably absent**: `plan_approval_request` — this is system-generated when a teammate in plan mode finishes planning. The teammate does not call SendMessage for this.

The `summary` field (5-10 words) was added in v2.1.30 as a required field for `message` and `broadcast` types. It appears as a preview in the UI notification.

> Sources: [Piebald-AI SendMessageTool extraction](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-sendmessagetool.md), [Piebald-AI CHANGELOG](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/CHANGELOG.md)

### 1.2 Inbox / Mailbox System

**Storage**: Each agent has a JSON inbox file at:

```
~/.claude/teams/{team-name}/inboxes/{agent-name}.json
```

**Message format** (on disk):

```json
[
  {
    "from": "team-lead",
    "text": "Hello world!",
    "summary": "Saying hello world",
    "timestamp": "2026-02-05T18:56:10.615Z",
    "read": false
  }
]
```

**Delivery mechanism**:

1. Sender calls `SendMessage` → system appends JSON object to recipient's inbox file
2. Recipient polls inbox between turns (~1 second interval)
3. Unread messages are injected into conversation as `<teammate-message teammate_id="[id]">...</teammate-message>` XML turns
4. Messages marked `read: true` after delivery

**Concurrency**: File locking for task claiming; the community MCP reimplementation uses `filelock` + atomic `os.replace` for inbox writes.

> Sources: [GitHub issue #23415](https://github.com/anthropics/claude-code/issues/23415), [VibeCodeCamp reverse-engineering](https://vibecodecamp.blog/blog/how-to-install-and-use-claude-code-agent-teams-reverse-engineered), [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp)

### 1.3 Idle Notifications and Peer Visibility

- When a teammate's turn ends, the system auto-sends an idle notification to the lead
- **Peer DM summaries**: When teammate A DMs teammate B, a brief summary is included in A's idle notification to the lead — passive observability without full forwarding
- Queued delivery: Messages arriving mid-turn are queued and delivered when the turn ends
- **No read receipts or delivery confirmation** — sender gets a tool result confirming the inbox write, but no notification when the recipient processes it

### 1.4 Topology

```
┌─────────────────────────────────────────────┐
│  Task Management: Hub-and-Spoke             │
│  (Lead creates/assigns tasks)               │
│                                             │
│        ┌──────────┐                         │
│        │   Lead   │                         │
│        └──┬───┬───┘                         │
│           │   │                             │
│     ┌─────┘   └─────┐                      │
│     ▼               ▼                       │
│  ┌──────┐       ┌──────┐                   │
│  │ Wkr1 │       │ Wkr2 │                   │
│  └──────┘       └──────┘                   │
│                                             │
│  Messaging: Mesh                            │
│  (Any agent can DM any agent)               │
│                                             │
│  Lead ←→ Wkr1 ←→ Wkr2 ←→ Lead             │
│                                             │
│  Broadcast: 1:All (linear cost scaling)     │
└─────────────────────────────────────────────┘
```

There are **no rooms, channels, groups, topics, threads, or subscription-based messaging**. The only way to message a subset is individual `message` calls to each.

---

## Part 2: Source Code Analysis (Decompiled v2.0.74)

### 2.1 Key Finding: Messaging Tools Stripped

In the decompiled Claude Code v2.0.74 (`claude-renamed.js`, 532k+ lines):

- Feature gate `mL()` (line 145154) always returns `false`
- Messaging tool variable `CpB` (line 371602) is hardcoded to `null`
- Schema definitions exist but no `call()` implementations are present
- Tool registration at line 371594 has empty array slots where messaging tools would go

This confirms messaging is behind a feature gate and was stripped from this build. The schemas define the API contract even though the implementation is hidden.

### 2.2 Schema Differences: v2.0.74 vs v2.1.44

The v2.0.74 source reveals an **older schema** with different field names:

| Field          | v2.0.74 (source)                         | v2.1.44 (system prompts) |
| -------------- | ---------------------------------------- | ------------------------ |
| Addressing     | `handle` (with `@` prefix)               | `recipient` (by name)    |
| Content        | `message`                                | `content`                |
| Metadata       | `fromBranch` (session ID)                | `summary` (preview text) |
| Self-messaging | `isSelf: boolean`                        | Not documented           |
| Time filter    | `seconds` parameter                      | Not documented           |
| Read cursor    | `hasMore`, `totalCount`, `filteredCount` | Not documented           |

The v2.1.30 restructuring significantly simplified the schema and added the flat message type system.

### 2.3 Delegate Mode Restrictions

In delegate mode (line 371612), workers can ONLY use:

- `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`
- `CpB` (messaging tool) would be included if non-null, but it's `null`

Workers cannot use file tools, Bash, Read, Write, etc. This is by design but has a known bug ([#25037](https://github.com/anthropics/claude-code/issues/25037)) where restrictions are incorrectly inherited.

### 2.4 Task System (Fully Implemented)

Unlike messaging, the task system is fully present:

- Storage: `~/.claude/tasks/{teamName}/{taskId}.json`
- CRUD: Create, Read, Update, List operations with schema validation
- File watching: `fs.watch()` on tasks directory with 50ms debounce + 5000ms polling fallback
- Change listeners: Pub/sub pattern for UI re-renders

### 2.5 Permission Broadcasts (Code Pattern)

The only broadcast-like behavior in source is permission propagation (line 366993-367008):

```javascript
for (let member of teamFile.members) {
  if (member.name === requestingWorker) continue;
  if (member.agentId === teamFile.leadAgentId) continue;
  xJ1?.writeToMailbox(member.name, {
    from: "team-lead",
    text: JSON.stringify({ type: "team_permission_update", ... }),
    timestamp: new Date().toISOString()
  }, teamName);
}
```

However, `xJ1` is always `null` in v2.0.74.

### 2.6 Environment Variables

| Variable                 | Purpose                              |
| ------------------------ | ------------------------------------ |
| `CLAUDE_CODE_TEAM_NAME`  | Team identifier for task/inbox paths |
| `CLAUDE_CODE_AGENT_NAME` | Agent display name                   |
| `CLAUDE_CODE_AGENT_ID`   | Unique agent identifier              |
| `CLAUDE_CODE_AGENT_TYPE` | Role (e.g., `"team-lead"`)           |
| `CLAUDE_CONFIG_DIR`      | Override for `~/.claude`             |

> Source: Decompiled `claude-renamed.js` v2.0.74 — see [source analysis](./agent-teams-messaging-source.md) for line references

---

## Part 3: Known Bugs and Limitations

### 3.1 Inbox Polling Failures (Critical)

The most commonly reported issue. Multiple GitHub issues describe the same root cause:

| Issue                                                            | Description                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| [#23415](https://github.com/anthropics/claude-code/issues/23415) | Teammates don't poll inbox in tmux mode on macOS           |
| [#24108](https://github.com/anthropics/claude-code/issues/24108) | Teammates stuck at idle, mailbox never polled              |
| [#24771](https://github.com/anthropics/claude-code/issues/24771) | Split panes open but teammates disconnected from messaging |
| [#25254](https://github.com/anthropics/claude-code/issues/25254) | Messages not delivered in VS Code extension                |

**Root cause** (from debug logs): `TeammateMailbox.readMailbox()` polling loop doesn't reinitialize when resuming a session with an existing team.

**Workaround**: Full restart — exit Claude Code, `pkill -f claude`, `tmux kill-server`, wait 5 seconds, restart fresh.

### 3.2 Zombie Agents

Teammates can persist as zombie processes (0 tokens, 0 tool uses) that never receive prompts and cannot be shut down via SendMessage. Requires manual `kill` + `rm -rf ~/.claude/teams/{name} ~/.claude/tasks/{name}`.

### 3.3 No Session Resumption

`/resume` and `/rewind` do not restore in-process teammates. The lead may attempt to message teammates that no longer exist.

### 3.4 ENV Variable Propagation

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `settings.json` alone may not be sufficient. Must be set in shell environment for spawned teammates.

---

## Part 4: Room-Based Messaging Patterns (Multi-Agent Framework Comparison)

### 4.1 Framework Comparison

| Framework             | Model                                  | Rooms?                                      | Key Insight                                                           |
| --------------------- | -------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| **LangGraph**         | Shared state graph with typed channels | Private channels (not rooms)                | Channels prevent context pollution; not all state flows everywhere    |
| **CrewAI**            | Hub-and-spoke hierarchical delegation  | No — strict delegation only                 | Structured JSON responses reduce context waste vs conversational text |
| **AutoGen GroupChat** | Shared room with speaker governance    | **Yes** — group topic + private DM channels | Closest existing room pattern; dual subscription (group + DM)         |
| **OpenHands**         | Event-sourced immutable log            | No rooms, but event log acts as room        | Typed events enable priority filtering; replay capability             |
| **Semantic Kernel**   | Pre-built orchestration patterns       | Group Chat pattern available                | Concurrent pattern = broadcast to room + aggregate responses          |
| **Google A2A**        | JSON-RPC 2.0 with agent discovery      | No rooms — task-oriented                    | Three transport modes (sync, stream, async) map to urgency levels     |

### 4.2 Chat Platform Patterns

| Platform            | Relevant Pattern                                        | Applicability                                                |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| **Slack channels**  | Named rooms, threading, unread tracking, channel types  | High — maps directly to agent team needs                     |
| **IRC rooms**       | Lightweight, text-based, moderated modes                | Medium-high — simplicity ideal for file-based implementation |
| **Matrix**          | Event-sourced rooms, power levels, federation, sync API | Medium — event sourcing and power levels relevant            |
| **Discord threads** | Spawnable sub-conversations, auto-archive               | Medium — thread-per-task pattern useful                      |

### 4.3 Context Token Optimization Research

**Key finding** (JetBrains Research, NeurIPS 2025): "Agent-generated context quickly turns into noise instead of useful information." Observation masking outperforms LLM summarization in 4/5 scenarios while being cheaper.

| Approach                | Token Savings              | Quality Impact                                    | Cost                         |
| ----------------------- | -------------------------- | ------------------------------------------------- | ---------------------------- |
| **Observation masking** | >50%                       | Neutral or positive                               | Minimal                      |
| **LLM summarization**   | >50%                       | May obscure stopping signals (13-15% longer runs) | +7% from summarization calls |
| **Selective injection** | Variable                   | Best with priority routing                        | Minimal                      |
| **Filesystem state**    | Near 100% for non-critical | Requires explicit reads                           | None                         |

**Core principle** (Google context engineering): "Share memory by communicating, don't communicate by sharing memory." Agents should post to rooms (sharing memory through communication) rather than all sharing one context window.

> Sources: [JetBrains efficient context management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/), [Google context-aware multi-agent framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)

---

## Part 5: Recommended Architecture for agent-team

### 5.1 Core Model: File-Backed Message Rooms

```
.agent-team/rooms/
  #general/
    messages.jsonl      # append-only structured message log
    summary.md          # latest auto-generated digest
    room.yaml           # metadata: members, topic, read-cursors
  #errors/
    messages.jsonl
    summary.md
    room.yaml
  #status/
    messages.jsonl
    summary.md
    room.yaml
  @orchestrator/        # DM channel (@ prefix for DMs)
    messages.jsonl
    room.yaml
```

### 5.2 Message Format

```json
{
  "id": "msg-uuid",
  "timestamp": "2026-02-17T10:30:00Z",
  "sender": "road-runner",
  "type": "status|error|question|result|heartbeat",
  "priority": "critical|normal|low",
  "room": "#status",
  "payload": "Research on topic X complete. See /path/to/report.md",
  "thread": null
}
```

### 5.3 Priority-Tiered Injection

| Priority   | Behavior                                                              |
| ---------- | --------------------------------------------------------------------- |
| `critical` | Injected into recipient's context immediately (like today's messages) |
| `normal`   | Added to room digest; agent polls when ready                          |
| `low`      | File-only; never enters context unless explicitly read                |

### 5.4 Room Tools (MCP Server)

- `room.post(room, message)` — append to room's message log
- `room.read(room, since=cursor)` — read new messages since last read
- `room.digest(room)` — get latest summary of room activity
- `room.subscribe(room, priority_filter)` — configure injection thresholds

### 5.5 Comparison: Current vs Proposed

| Aspect         | Current (Claude Code native) | Proposed (room-based)            |
| -------------- | ---------------------------- | -------------------------------- |
| Addressing     | 1:1 or 1:all                 | Room-based with DM fallback      |
| Context impact | Every message is a turn      | Only critical messages are turns |
| Organization   | Flat inbox                   | Topic-specific rooms             |
| History        | Inbox file (no summary)      | JSONL log + auto-digest          |
| Filtering      | None                         | Priority-tiered injection        |
| Scalability    | Linear context growth        | Bounded by priority filter       |

### 5.6 Implementation Phases

| Phase | Scope                                                                           |
| ----- | ------------------------------------------------------------------------------- |
| **1** | File-based rooms with manual read/write (shell scripts)                         |
| **2** | MCP server providing room tools (post, read, digest, subscribe)                 |
| **3** | Priority-based injection (critical → context, normal → digest, low → file-only) |
| **4** | Auto-summarization of room activity (digest generation)                         |

---

## Part 6: Open Questions

1. **Can we intercept message injection?** The current system injects all inbox messages as conversation turns. Can a hook or MCP server intercept this to apply priority filtering? Or does the room model need to bypass the native inbox entirely?

2. **Concurrency for JSONL append**: Multiple agents writing to the same room's `messages.jsonl` needs append-locking or similar coordination. The native system uses per-agent inbox files (no shared writes). Rooms would need a write-coordination mechanism.

3. **Digest quality**: JetBrains research suggests LLM summarization can hurt performance. Should digests be LLM-generated or template-based (e.g., "3 status updates, 1 error, last activity 2 minutes ago")?

4. **Backwards compatibility**: Can the room model coexist with the native SendMessage/inbox system, or does it fully replace it?

5. **How does the v2.1.44 messaging implementation differ from v2.0.74?** The source analysis was on v2.0.74 where messaging was stripped. The live system has full messaging — the internal implementation details (beyond what's documented) are unknown.

---

## References

### Official Documentation

- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)

### System Prompt Extractions

- [Piebald-AI SendMessageTool](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-sendmessagetool.md)
- [Piebald-AI TeammateTool](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-teammatetool.md)
- [Piebald-AI CHANGELOG](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/CHANGELOG.md)

### GitHub Issues

- [#23415 — Inbox polling failure in tmux](https://github.com/anthropics/claude-code/issues/23415)
- [#24108 — Teammates stuck at idle](https://github.com/anthropics/claude-code/issues/24108)
- [#24771 — Panes disconnected from messaging](https://github.com/anthropics/claude-code/issues/24771)
- [#25037 — Delegate mode tool restriction bug](https://github.com/anthropics/claude-code/issues/25037)
- [#25254 — Messages not delivered in VS Code](https://github.com/anthropics/claude-code/issues/25254)

### Community Implementations

- [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp)
- [VibeCodeCamp reverse-engineering article](https://vibecodecamp.blog/blog/how-to-install-and-use-claude-code-agent-teams-reverse-engineered)

### Multi-Agent Frameworks

- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [CrewAI Collaboration Docs](https://docs.crewai.com/en/concepts/collaboration)
- [AutoGen Group Chat](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html)
- [OpenHands Software Agent SDK](https://arxiv.org/html/2511.03690v1)
- [Semantic Kernel Agent Orchestration](https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-orchestration/)
- [Google A2A Protocol](https://a2a-protocol.org/latest/specification/)

### Context Optimization

- [JetBrains: Efficient Context Management (NeurIPS 2025)](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- [Google: Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
- [Filesystem-Based Agent State Pattern](https://agentic-patterns.com/patterns/filesystem-based-agent-state/)
- [The Agentic Service Bus](https://www.arionresearch.com/blog/the-agentic-service-bus-a-new-architecture-for-inter-agent-communication)
