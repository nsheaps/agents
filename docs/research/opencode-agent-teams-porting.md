# OpenCode Agent Teams Porting: Research Report

**Source**: [Porting Claude Code's Agent Teams to OpenCode](https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol) by uenyioha
**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #37

---

## 1. What is OpenCode?

OpenCode is an open-source implementation at [github.com/sst/opencode](https://github.com/sst/opencode).[^2] It rebuilt Claude Code's agent teams system from scratch with one critical difference: **everything runs in a single process**.[^1]

> "OpenCode runs all teammates in the same process, so we don't need files for cross-process IPC. But we still wanted a clean audit trail."[^1]

Key differentiator: OpenCode can **"mix models from different providers in the same team."**[^1] Testing included GPT-5.3 Codex, Gemini 2.5 Pro, and Claude Sonnet 4 working together in one team.

Unlike Claude Code (which supports three spawn backends: in-process, tmux split-pane, and iTerm2 split-pane)[^3], OpenCode operates as a single-process system only.

## 2. What Concepts Were Ported?

These Claude Code concepts transferred directly:[^1]

| Concept                      | How It Ported                                                                  |
| :--------------------------- | :----------------------------------------------------------------------------- |
| Fire-and-forget spawning     | Same model — spawn returns immediately, teammates run independently            |
| Explicit sub-agent isolation | Ported with dual enforcement (permission deny + visibility hiding)             |
| File-based inbox persistence | Per-agent JSONL files at `team_inbox/<projectId>/<teamName>/<agentName>.jsonl` |
| Built-in task management     | Ported with added dependency tracking and atomic claiming                      |
| Plan approval mechanisms     | First-class with tagged permission pattern                                     |
| Delegate mode                | Lead restricted to coordination-only tools                                     |

The article's conclusion:

> "The systems are more similar than different. Both use fire-and-forget spawning, file-based inbox persistence, and explicit sub-agent isolation."[^1]

## 3. Architecture Decisions Made Differently

### 3.1 Messaging: Event-Driven vs Polling

**Claude Code**: Polling-based. Teammates periodically check inbox files.[^3]

**OpenCode**: Event-driven with auto-wake. Two-component design:[^1]

1. **Inbox** (source of truth): Append message to recipient's JSONL file
2. **Session injection** (delivery): Inject into recipient's LLM session as synthetic user message, then `autoWake` restarts idle sessions

> "The insight wasn't about blocking semantics — it was that the messaging layer needed to be able to restart idle sessions."[^1]

### 3.2 Write Performance: JSONL vs JSON Array

**Claude Code**: JSON array requiring O(N) read-modify-write per message.[^1]

> "read the whole file, deserialize, push one entry, serialize, write it all back — O(N) per message."[^1]

**OpenCode**: JSONL append-only achieves O(1) writes. File rewriting only during `markRead`, which fires once per prompt loop completion, not per message.[^1]

### 3.3 Communication Topology: Peer-to-Peer vs Leader-Centric

**Claude Code**: Leader-centric — all messages route through the lead.[^3]

**OpenCode**: Full mesh peer-to-peer — teammates can directly message each other by name.[^1]

> "a betting analyst proactively broadcast findings to all teammates, and an injury scout cross-referenced that data without the lead having to relay it. The lead focused on orchestration instead of being a message router."[^1]

System prompt instruction: **"You can message any teammate by name — not just the lead."**[^1]

### 3.4 State Tracking: Two-Level State Machine vs Implicit

**Claude Code**: Implicit state tracking.[^3]

**OpenCode**: Two-level state machine:[^1]

- **Member Status** (coarse-grained): 5 states — ready, busy, shutdown_requested, shutdown, error
- **Execution Status** (fine-grained): 10 states tracking exact prompt loop position

> "The UI needs to show what each teammate is doing at any moment (the execution status), but recovery and cleanup logic needs a simpler model to reason about (the member status). Collapsing these into one state machine would have made either the UI too coarse or the recovery logic too complex."[^1]

Transition validation includes escape hatches:[^1]

- `guard: true` — prevents duplicate shutdown transitions during cleanup race conditions
- `force: true` — bypasses validation during crash recovery when state machine consistency is compromised

### 3.5 Sub-Agent Isolation: Dual Enforcement

Both systems isolate sub-agents from team messaging. OpenCode adds a second enforcement layer after a security audit:[^1]

**Layer 1 — Permission deny rules**:

```typescript
const TEAM_TOOLS = [
  "team_create", "team_spawn", "team_message", "team_broadcast",
  "team_tasks", "team_claim", "team_approve_plan",
  "team_shutdown", "team_cleanup",
] as const

...TEAM_TOOLS.map(t => ({
  permission: t, pattern: "*", action: "deny",
}))
```

**Layer 2 — Visibility hiding**:

```typescript
tools: {
  ...Object.fromEntries(TEAM_TOOLS.map(t => [t, false])),
}
```

> This dual approach emerged after "a security audit (commit `2ad270dc4`) found that sub-agents could accidentally access `team_message` through inherited parent permissions."[^1]

### 3.6 Task Claiming: Atomic Under Concurrency

OpenCode added atomic task claiming — Claude Code uses file locking.[^1][^3] The single-process constraint means OpenCode uses in-memory RW locks (writer priority).

### 3.7 Recovery: Ordered Bootstrap with Manual Restart

OpenCode's recovery sequence on server restart:[^1]

1. **Permission handler registration** — must be ready before recovery triggers cleanup
2. **State transition** — scan all teams for busy members, force-transition to ready
3. **Event subscription** — subscribe to auto-cleanup events AFTER recovery (prevents spurious cleanup from recovery-triggered transitions)

Critical design decision:

> "no automatic restart. Interrupted teammates get marked as ready but their prompt loops don't restart. The user has to re-engage them. This prevents runaway agents after a crash. You lose convenience, but you don't wake up to find four agents have been burning API credits all night on a stale task."[^1]

## 4. Lessons for Our Provider-Agnostic Vision

### Multi-Model Support Validates Our PRD

OpenCode tested three multi-provider scenarios:[^1]

1. Two Gemini agents researching NFL team history
2. Four Claude Opus agents for Super Bowl prediction
3. GPT-5.3 Codex + Gemini 2.5 Pro + Claude Sonnet 4 in one team

This directly validates the `agent-team` PRD's direction of provider-agnostic orchestration via MCP as an abstraction layer. OpenCode proves it's feasible to mix models in the same team.

### The Spawn Problem Is Universal

OpenCode went through three iterations:[^1]

1. Non-blocking spawn → lead's prompt loop exits, teammates orphaned
2. Blocking spawn → lead can't coordinate multiple teammates in parallel
3. Fire-and-forget + auto-wake → the working solution

> "The spawn stays fire-and-forget, but when a teammate sends a message to an idle lead, the system restarts the lead's prompt loop automatically."[^1]

This is the same spawn model we'd need for any provider-agnostic implementation. The auto-wake pattern is the key insight.

### MCP Boundary Alignment

Our PRD asks: "Where does the MCP boundary sit?" OpenCode's architecture implicitly answers this — the messaging layer and state management are the coordination primitives, while the LLM interaction is provider-specific.[^1] The MCP interface would sit between these layers:

```
Orchestration (provider-agnostic)
  → MCP interface (tool definitions, message passing)
    → Provider plugins (Claude, GPT, Gemini)
```

### Delivery Receipts Are Best-Effort

> "If the process crashes after `markRead()` but before the receipt is injected into the sender's session, the sender never learns the recipient read their message. The read state itself survives — it's the notification that's lost. This is the same trade-off XMPP and Matrix make."[^1]

Claude Code makes a simpler tradeoff: `markMessagesAsRead` flips a local flag with no sender notification at all.[^3]

## 5. Patterns and Anti-Patterns

### Patterns to Adopt

| Pattern                         | Rationale                                                                                                  |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| **Auto-wake for idle sessions** | Solves the spawn problem without blocking. Critical for multi-agent coordination.[^1]                      |
| **JSONL append-only inbox**     | O(1) writes vs O(N) for JSON arrays. Significant at scale.[^1]                                             |
| **Peer-to-peer messaging**      | Reduces lead bottleneck. Teammates can cross-reference findings directly.[^1]                              |
| **Two-level state machine**     | Separates UI concerns (fine-grained) from recovery logic (coarse-grained).[^1]                             |
| **Dual sub-agent isolation**    | Permission deny + visibility hiding. Belt and suspenders after security audit found inheritance leaks.[^1] |
| **Manual recovery after crash** | Intentional safety — prevents runaway agents burning credits on stale tasks.[^1]                           |
| **Ordered bootstrap sequence**  | Permission handlers → state transition → event subscription. Order prevents spurious cleanup.[^1]          |

### Anti-Patterns to Avoid

| Anti-Pattern                      | What Happened                                                                                                                                                                    |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No backpressure**               | "A fast sender can flood a slow receiver. There's a 10KB per-message limit but no bounded queue."[^1]                                                                            |
| **Single-process locking**        | "All locks are in-memory, so you can't run multiple server instances against the same storage."[^1] Our architecture should support multi-process from the start.                |
| **No cross-team communication**   | "Teams are isolated. No inter-team messaging primitive."[^1] Our nested orchestrator design should plan for inter-team coordination.                                             |
| **Model-specific behavior loops** | "the model generated ~50 near-identical 'task complete' messages in a loop, unable to stop. No unit test catches that."[^1] Integration testing with actual models is essential. |

### Comparative Summary

| Dimension            | Claude Code                      | OpenCode                               | Our Target                       |
| :------------------- | :------------------------------- | :------------------------------------- | :------------------------------- |
| Message storage      | JSON array (O(N))[^3]            | JSONL append (O(1))[^1]                | JSONL or event stream            |
| Message notification | Polling[^3]                      | Event-driven auto-wake[^1]             | Event-driven                     |
| Spawn model          | Fire-and-forget (3 backends)[^3] | Fire-and-forget (in-process)[^1]       | Fire-and-forget (multi-backend)  |
| Communication        | Leader-centric[^3]               | Full mesh peer-to-peer[^1]             | Full mesh                        |
| State tracking       | Implicit[^3]                     | Two-level state machine[^1]            | Explicit state machine           |
| Multi-model          | Single provider[^3]              | Multi-provider per team[^1]            | Multi-provider (MCP)             |
| Locking              | File locks[^3]                   | In-memory RW lock[^1]                  | TBD (multi-process capable)      |
| Recovery             | Not documented                   | Ordered bootstrap + manual restart[^1] | Ordered bootstrap + configurable |
| Cross-team           | Not supported                    | Not supported[^1]                      | Nested orchestrators (planned)   |

## References

[^1]: https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol

[^2]: https://github.com/sst/opencode

[^3]: https://code.claude.com/docs/en/agent-teams
