# Source Analysis: Agent Teams Messaging System

**Source**: Decompiled Claude Code v2.0.74 (`claude-renamed.js`, 532k+ lines)
**Date**: 2026-02-18
**Method**: Static analysis of decompiled/obfuscated JavaScript using string literal patterns and schema definitions

## Key Finding: Messaging System is Stripped in v2.0.74

The most critical finding is that the inter-agent messaging tool implementation is **not present** in this build. The feature gate function `mL()` (line 145154) always returns `false`, and the messaging tool variable `CpB` (line 371602) is hardcoded to `null`. Schema definitions and state placeholders exist, but the actual send/read message tool implementations are absent.

## SendMessage Tool Implementation

### Tool Schemas (Present but Unused)

**SendMessage schema** (line 371563-371570, lazy init `HpB`):

```javascript
// Input schema (Nk4)
{
  handle: string; // "The @handle of the user to send message to"
  message: string; // "The message content"
}

// Output schema (Yk4)
{
  handle: string; // "The handle of the recipient"
  isSelf: boolean; // "Whether this is a self-to-self message"
  sent: boolean; // "Whether the message was sent successfully"
}
```

**ReadMessages schema** (line 371531-371547, lazy init `BpB`):

```javascript
// Input schema (oy4)
{
  handle: string           // "The @handle of the user to read messages from"
  seconds: number?         // "Only show messages from last N seconds. Omit to see all recent messages."
}

// Output schema (sy4)
{
  handle: string           // "The handle of the user"
  isSelf: boolean          // "Whether this is a self-to-self chat"
  messages: Array<{
    fromHandle: string     // Sender handle
    fromBranch: string     // Sender's branch/session
    content: string        // Message text
    relativeTime: string   // Human-readable time offset
    isFromMe: boolean      // Whether sent by the reading agent
  }>
  hasMore: boolean?        // "True if more messages exist"
  totalCount: number?      // "Total messages in chat"
  filteredCount: number?   // "Messages matching time filter"
}
```

### Registration Status

Both `BpB` and `HpB` are loaded during module init at line 371646-371647 (inside the `JQ` lazy init block), but **neither is included in the tool list** at line 371594:

```javascript
// Line 371594 - tool registration
return [
  Ts,
  MNR,
  y0,
  MP,
  Fc,
  UU,
  E8,
  CQ,
  Y2,
  Gx,
  DI,
  N3,
  jNR,
  kNR,
  AZR,
  Pt,
  RxT,
  ...[],
  ...[],
  ...(mL() ? [VdB, SdB, pdB, RpB] : []), // Team tools (always disabled)
  ...[], // Empty slots where messaging tools would go
  ...(process.env.ENABLE_LSP_TOOL ? [dbA] : []),
  ...[],
  ...[],
  ...[], // More empty slots
  Tc,
  Rc, // MCP Resource tools (always enabled)
  ...(vM() ? [hdB] : []),
]; // MCPSearch (TST mode only)
```

The empty arrays `...[]` are likely build-time dead code elimination of the messaging tools.

### Delegate Mode Tool Allowlist

```javascript
// Line 371656
RO1 = new Set([
  ...(CpB ? [CpB] : []), // CpB = null, so messaging tool NOT included
  uNR, // "TaskCreate"
  mNR, // "TaskGet"
  dNR, // "TaskList"
  cNR, // "TaskUpdate"
]);
```

In delegate mode, workers can ONLY use Task tools. The `CpB` variable is the placeholder for the messaging tool name, but it's `null`.

## Message Types

### Internal Message Types Found

The following message type strings appear in system prompt contexts:

- `"team_permission_update"` (line 366994) - Permission propagation between team members
- `"plan_approval"` - Referenced in plan mode tool result (line 315936-315948): agents submit plans to team lead, then wait for inbox approval/rejection

### System Reminder Types

From the switch statement at line 352235-352244:

- `"team_context"` - Team configuration injected as system reminder
- `"delegate_mode"` - Delegate mode context
- `"delegate_mode_exit"` - Exit from delegate mode

## Inbox / Message Storage

### App State Inbox (In-Memory)

The app state includes an `inbox` field initialized as empty (line 405495-405497, 419176-419178):

```javascript
inbox: {
  messages: [];
}
```

This field is defined in both the default state constructor and the full app initialization, but **no code in this build ever populates it**. It's a prepared slot for the messaging system.

### Task Storage (File-Based, Fully Implemented)

Tasks are stored at: `~/.claude/tasks/{teamName}/{taskId}.json`

Key functions:

- `B3T(teamName)` (line 145160-145161): Returns `path.join(M9(), "tasks", teamName)` = `~/.claude/tasks/{teamName}/`
- `leR(teamName, taskId)` (line 145163-145164): Returns `path.join(B3T(teamName), "{taskId}.json")`
- `D6_(teamName, task)` (line 145190-145198): Creates task, writes JSON, notifies listeners
- `uu(teamName, taskId)` (line 145199-145209): Reads task from disk, validates schema
- `_3T(teamName, taskId, updates)` (line 145211-145221): Updates task on disk
- `pDR(teamName)` (line 145222-145234): Lists all tasks in team directory

Team name resolution: `process.env.CLAUDE_CODE_TEAM_NAME || kA()` (line 145158)

Config directory: `process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude")` (line 784)

### Worker Permissions Queue (In-Memory)

```javascript
workerPermissions: { queue: [], selectedIndex: 0 },
workerSandboxPermissions: { queue: [], selectedIndex: 0 },
pendingWorkerRequest: null,
pendingSandboxRequest: null
```

These handle the delegate mode permission escalation flow.

## DM Routing

### Handle-Based Addressing

Messages are addressed by `@handle` (from the schema definitions). The `fromBranch` field in the ReadMessages response suggests messages carry the sender's branch/session identifier, enabling routing in multi-session scenarios.

### Self-Messaging

Both SendMessage and ReadMessages schemas include `isSelf: boolean`, indicating an agent can message itself (likely for notes/reminders).

### Actual Implementation: Not Present

No `call()` method exists for the messaging tools in this build. The schemas define the API contract but the routing logic is stripped.

## Broadcast Mechanism

### Team Permission Broadcasts

The only broadcast-like behavior found is permission propagation (line 366993-367008):

```javascript
// When team lead approves a permission for a worker:
for (let member of teamFile.members) {
  if (member.name === requestingWorker) continue; // Skip requester
  if (member.agentId === teamFile.leadAgentId) continue; // Skip lead
  xJ1?.writeToMailbox(
    member.name,
    {
      from: "team-lead",
      text: JSON.stringify({
        type: "team_permission_update",
        permissionUpdate: update,
        directoryPath: path,
        toolName: toolName,
      }),
      timestamp: new Date().toISOString(),
    },
    teamName,
  );
}
```

This broadcasts permission updates to all team members except the requester and the lead. However, `xJ1` is always `null` in this build.

### Mailbox Message Format

From the broadcast code, the mailbox message format is:

```javascript
{
  from: string,           // Sender identifier (e.g., "team-lead")
  text: string,           // Message content (may be JSON-stringified)
  timestamp: string       // ISO 8601 timestamp
}
```

## Rooms / Channels

**No rooms or channels exist.** The messaging system is purely:

1. Direct messages (DM) between agents via `@handle`
2. Broadcast to all team members (for system events like permission updates)

There is no concept of rooms, channels, topics, or groups.

## Message Delivery Mechanism

### File-Based Watching for Tasks

The task system uses `fs.watch()` on the tasks directory (line 270198-270199):

```javascript
let taskDir = B3T(teamName); // ~/.claude/tasks/{teamName}/
if (fs.existsSync(taskDir)) {
  watcher = fs.watch(taskDir, callback);
}
```

Combined with:

- `_6_(callback)` (line 145146-145147): Registers change listeners in a Set
- `B6_()` (line 145149-145152): Notifies all registered listeners synchronously

This creates a file-watching notification pattern: when any agent writes a task file, `fs.watch` detects the change and triggers UI re-renders in other agents watching the same directory.

### Polling with Debounce

The task watcher includes debounce logic (line 270180-270206):

- Initial check runs immediately
- Changes trigger a debounced re-check (50ms debounce via `vc7`)
- Periodic poll every 5000ms (`gc7`) as a fallback
- 5000ms idle timeout (`LHB`) when all tasks are resolved

### Mailbox Delivery (Placeholder)

The `writeToMailbox` and `sendPermissionResponseViaMailbox` methods on `xJ1` and `VgT` are called via optional chaining (always null in this build). The actual delivery mechanism is not included.

## Message Format / Schema

### Task Schema (Fully Implemented)

```javascript
{
  id: string,
  subject: string,
  description: string,
  status: "open" | "resolved",
  owner: string | undefined,    // Agent ID if assigned
  references: string[],         // Related task IDs (bidirectional)
  blocks: string[],             // Tasks that cannot start until this completes
  blockedBy: string[],          // Tasks that must complete before this can start
  comments: Array<{
    author: string,             // Agent ID (CLAUDE_CODE_AGENT_ID)
    content: string
  }>
}
```

### Mailbox Message Schema (From Code Patterns)

```javascript
{
  from: string,                 // Sender identifier
  text: string,                 // Message content
  timestamp: string             // ISO 8601
}
```

### Permission Response Schema (From Code Patterns)

```javascript
{
  decision: "approved" | "rejected",
  resolvedBy: "leader",
  feedback?: string             // Only on rejection
}
```

## Environment Variables

| Variable                 | Purpose                                                      | Line           |
| :----------------------- | :----------------------------------------------------------- | :------------- |
| `CLAUDE_CODE_TEAM_NAME`  | Team identifier, used for task directory and team context    | 145158         |
| `CLAUDE_CODE_AGENT_NAME` | Agent display name                                           | 270156         |
| `CLAUDE_CODE_AGENT_ID`   | Agent unique identifier, used in task comments and ownership | 270160         |
| `CLAUDE_CODE_AGENT_TYPE` | Agent type (e.g., "team-lead")                               | 270156, 371280 |
| `CLAUDE_CONFIG_DIR`      | Override for `~/.claude`                                     | 784            |

## Permission Model in Delegate Mode

When `mode === "delegate"` (line 371612):

- Tool list is filtered to only `RO1` set: TaskCreate, TaskGet, TaskList, TaskUpdate
- Team lead can update any task; workers can only update tasks they own (line 371279-371288)
- Workers cannot update tasks owned by others unless they are the team-lead (`CLAUDE_CODE_AGENT_TYPE === "team-lead"`)

## Summary

| Feature                  | Exists?                        | Evidence                                                                        |
| :----------------------- | :----------------------------- | :------------------------------------------------------------------------------ |
| DMs (via @handle)        | Schema only                    | Input/output schemas defined at lines 371531-371570; no `call()` implementation |
| Broadcasts               | Code patterns only             | Permission broadcast loop at line 366993-367008; `xJ1` is null                  |
| Rooms/channels           | No                             | No evidence whatsoever                                                          |
| File-based task storage  | Yes, fully implemented         | `~/.claude/tasks/{teamName}/{taskId}.json` with CRUD operations                 |
| File-based inbox/mailbox | Placeholder only               | `writeToMailbox` called on null variable; storage location unknown              |
| In-memory inbox          | State defined, never populated | `inbox: { messages: [] }` in app state                                          |
| fs.watch notification    | Yes, for tasks                 | Watches tasks directory, debounced polling fallback                             |
| Self-messaging           | Schema supports it             | `isSelf` field in both schemas                                                  |
| Branch tracking          | Schema supports it             | `fromBranch` field in ReadMessages output                                       |
| Time-filtered reads      | Schema supports it             | `seconds` parameter in ReadMessages input                                       |
| Permission delegation    | Fully implemented              | Worker permission queue, leader approval flow                                   |
| Plan approval flow       | Text references only           | System prompt instructs "check your inbox" for plan approval                    |

## Confidence Levels

| Finding                                         | Confidence                                                                     |
| :---------------------------------------------- | :----------------------------------------------------------------------------- |
| Messaging tool stripped from v2.0.74            | **High** - `mL()` returns false, `CpB` is null, empty array slots in tool list |
| Task system fully implemented                   | **High** - Complete CRUD with file I/O, schema validation, UI rendering        |
| Messages addressed by @handle                   | **High** - Schema definitions are explicit                                     |
| Mailbox message format {from, text, timestamp}  | **Medium** - Derived from broadcast code patterns, may differ for DMs          |
| fs.watch is the delivery notification mechanism | **High** - Clear implementation in task watcher code                           |
| No rooms/channels concept                       | **High** - Zero evidence in 532k lines                                         |
| Inbox state is for future messaging             | **Medium** - Empty state initialized, never used, but structurally ready       |
| Branch field enables multi-session routing      | **Medium** - Field exists in schema but routing logic is stripped              |
| Delegate mode limits tools to Task-only         | **High** - Explicit `RO1` set filtering at line 371612                         |

## Key Line References

| Component                               | Lines                                  |
| :-------------------------------------- | :------------------------------------- |
| `mL()` feature gate (always false)      | 145154-145156                          |
| `Eb()` team name resolution             | 145157-145158                          |
| Task CRUD operations                    | 145160-145234                          |
| Change listener pub/sub                 | 145146-145152                          |
| Agent name/ID resolution                | 270155-270164                          |
| Task file watcher with debounce         | 270174-270210                          |
| Plan approval inbox reference           | 315936-315948                          |
| Permission broadcast via mailbox        | 366993-367008                          |
| Mailbox/permission response via mailbox | 367003, 366336, 366966, 367014, 367040 |
| Null variable declarations (VgT, xJ1)   | 367217-367219                          |
| TaskCreate tool                         | 370887-370965                          |
| TaskGet tool                            | 371010-371113                          |
| TaskUpdate tool                         | 371202-371341                          |
| TaskList tool                           | 371432-371516                          |
| ReadMessages schema                     | 371525-371547                          |
| SendMessage schema                      | 371556-371570                          |
| Tool registration (messaging stripped)  | 371594                                 |
| Delegate mode tool allowlist            | 371656                                 |
| App state inbox placeholder             | 405495-405497                          |
