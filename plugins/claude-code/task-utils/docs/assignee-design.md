# task-utils assignee schema — design note v1

**Date**: 2026-05-25
**Branch**: `feat/task-utils-assignee-redesign`
**Issue**: [alex/.ai-agent-alex task #460](https://github.com/nsheaps/.ai-agent-alex) — task-utils redesign: subagent assignment + hook-friction removal
**Source directive**: Nate Discord [1508291931611070674](https://discord.com/channels/1490863845252665415/1497431286661517353/1508291931611070674) (2026-05-25 02:13Z), restated [1508312033677021297](https://discord.com/channels/1490863845252665415/1497431286661517353/1508312033677021297) (2026-05-25 03:33Z) "get it done."

---

## 1. Problem

The `require-task-in-progress.sh` PreToolUse hook gates Write/Edit/MultiEdit/NotebookEdit by checking `$CLAUDE_DIR/tasks/$SESSION_ID/*.json` for any `status=in_progress` task. When a parent agent dispatches a sub-agent via `Agent(...)`:

- Sub-agent runs in a fresh session — different `SESSION_ID`, empty tasks dir.
- Sub-agent's Write/Edit calls fire the hook, find no in_progress task in its own session, and are denied.
- Sub-agent has no TaskCreate/TaskUpdate authority in the doctrine — only the parent does — so it can't simply create a task to satisfy the gate.
- Workaround so far: parent says "save to <path>" so the sub-agent uses Write-permitted tools or skips the hook by going through Bash. Brittle and bypasses the discipline the hook exists to enforce.

Same problem on the parent side: when alex dispatches 3 sub-agents in parallel and assigns each a task, those 3 in_progress tasks now occupy the 0-or-1 invariant slot meant for alex's *own* in-progress work.

## 2. Rules (from directive, verbatim)

1. Tasks have an "assignee": me (alex) OR a sub-agent name (e.g. `arch-reader`).
2. Hook doesn't block Write/Edit by a sub-agent if the sub-agent is the assignee of an in-progress task.
3. Sub-agent-assigned tasks DO NOT count toward my open-ticket invariant (0 or 1 in-progress for ME).
4. When sub-agent finishes: I MUST stop any other in-progress work before reassigning that task to ME. If not coming back to it immediately, move it back to pending (assignee stays as me-or-empty).
5. I control ticket state + assignment. Sub-agent is oblivious.
6. Workflow: tell sub-agent what to do → assign ticket to them → dispatch → sub-agent works → returns → I take it from there.

## 3. Schema decision — `assignee` lives in task `metadata.assignee`

TaskCreate/TaskUpdate already accept an arbitrary `metadata` object that round-trips into the task JSON at `$CLAUDE_DIR/tasks/$SESSION_ID/${TASK_ID}.json` under `.metadata`. Use that field directly — no new file, no frontmatter parsing, no migration.

**Field shape**:
```json
{
  "metadata": {
    "assignee": "alex"                    // or empty / absent → me
                                          // or "arch-reader" / "<sub-agent-name>" → sub-agent
  }
}
```

**Why metadata, not description-frontmatter or a sidecar file**:
- Already supported by the TaskUpdate tool surface (`metadata` param) — no schema fight.
- Stored on disk in the same JSON file the hook already reads — zero new I/O.
- Independent of the description, so it isn't disturbed by event-log appends.
- Empty / absent assignee = me, so existing tasks keep working without backfill.

**Sub-agent name source**: the parent passes a `name` to `Agent({name: "<n>"})`. That same string is the assignee. Pre-dispatch, parent calls `TaskUpdate(id, metadata={assignee: "<n>"})`. The Agent invocation conventionally uses `AGENT(<n>):` subject prefix already — `<n>` matches.

## 4. Hook changes

### 4a. `task-invariant.sh` 0-or-1 invariant

When checking "any other in_progress task" before allowing pending→in_progress:

```bash
# Old: count any in_progress task with different id
# New: count only tasks where metadata.assignee is "alex" or empty/absent
f_assignee="$(jq -r '.metadata.assignee // empty' "$f" 2>/dev/null)"
case "$f_assignee" in
  ""|alex) : ;;            # counts toward my invariant
  *) continue ;;           # sub-agent task, skip
esac
```

This satisfies rule 3 — parent can have one alex-in_progress + N sub-agent-in_progress simultaneously.

The new-task-being-promoted is also checked: if I'm trying to move a sub-agent-assigned task to in_progress *from my session*, that's the parent dispatching — allowed regardless of the count (the parent doesn't "occupy" its own slot by assigning).

Edge case (rule 4): when a sub-agent finishes and I want to reassign to myself, I must first ensure no other alex-task is in_progress. The existing invariant handles this once I flip `metadata.assignee` from `<n>` → `alex`.

### 4b. `require-task-in-progress.sh` sub-agent recognition

Sub-agent's hook fires with the sub-agent's `SESSION_ID`. It needs to discover:
1. *Am I a sub-agent?* — if so, what's my name?
2. *Does my parent have an in_progress task assigned to me?*

**Detection path — TBD, needs validation**:

Hook stdin JSON in PreToolUse may include `parent_session_id` or similar when invoked inside an Agent() dispatch. Need to capture a fresh hook-input dump from a sub-agent context to confirm. Fallback: env var injection by the parent (set `CLAUDE_AGENT_NAME=<n>` for the sub-agent process — workable if Agent() preserves env).

**Lookup path** (once name resolved):

```bash
# Scan ALL session tasks dirs (not just current SESSION_ID)
for task in "$CLAUDE_DIR"/tasks/*/*.json; do
  jq_status="$(jq -r '.status // empty' "$task" 2>/dev/null)"
  jq_assignee="$(jq -r '.metadata.assignee // empty' "$task" 2>/dev/null)"
  if [[ "$jq_status" == "in_progress" && "$jq_assignee" == "$AGENT_NAME" ]]; then
    # Allow — sub-agent has a parent-assigned in_progress task
    log_fire allow ...
    emit_decision allow ""
    exit 0
  fi
done
# Fall through to existing me-side check
```

For self (alex) calls (`AGENT_NAME` unset/empty), behavior is unchanged.

### 4c. Coach text

`task-invariant.sh` coaches stay mostly as-is, with one addition: when TaskCreate sets `metadata.assignee` to a non-alex value, append: *"Sub-agent-assigned task — won't count toward your in_progress invariant. Remember rule 4: when the sub-agent returns, stop your other in-progress work before reassigning back to yourself."*

## 5. Workflow examples

### 5a. Parent dispatches a sub-agent

```text
1. TaskCreate(subject="AGENT(arch-reader): Read ARCH_DRAFT and synthesize", ...)
   → task #500 created, pending, no metadata
2. TaskUpdate(500, metadata={assignee: "arch-reader"}, status=in_progress)
   → assignee set, status flipped (doesn't bump my count)
3. Agent({name: "arch-reader", prompt: "..."})  [background]
   → sub-agent starts; its own hook lookup finds task #500 with assignee=arch-reader, allows writes
4. Sub-agent returns
5. TaskUpdate(500, metadata={assignee: "alex"}, status=pending OR in_progress)
   → reassign; rule 4 applies if going to in_progress
```

### 5b. Solo task (no change from today)

```text
1. TaskCreate(subject="...")  → pending
2. TaskUpdate(id, status=in_progress)  → 0-or-1 enforced on alex-tasks only
3. ...work...
4. TaskUpdate(id, status=completed)  → done
```

## 6. Skill rename

Per Nate 03:34Z + 03:34Z (msgs [1508312167160742079](https://discord.com/channels/1490863845252665415/1497431286661517353/1508312167160742079), [1508312231312494653](https://discord.com/channels/1490863845252665415/1497431286661517353/1508312231312494653)): follow the skill naming pattern in the arch draft / scratch. Suffixes in `ARCHITECTURE_DRAFT.md` lines 22–46 (`-controller`, `-service`, `-cli`, `-manager`) indicate `<thing>-<role>` shape. Apply: `manage-tasks` → `task-manage` (noun-verb, matches the suffix pattern).

Rename happens in this PR alongside the schema/hook changes — single coherent unit.

## 7. Out of scope (for this design)

- TaskGet/TaskList tool surface changes — using `metadata.assignee` keeps the schema flat; clients see the field for free.
- Cross-machine sub-agent dispatch (no current use case).
- Sub-agent-of-sub-agent assignment (depth > 1) — flag as TBD; rule 5 ("I control state") implies depth-1 only for now.

## 8. Validation plan (handed to subsequent sub-tasks)

1. Add a local marketplace pointer to alex's settings.local.json: `task-utils-dev` source = `/home/nsheaps/src/nsheaps/agents.worktrees/task-utils-redesign/plugins/claude-code/task-utils`.
2. Implement the hook changes + rename on this branch.
3. Install dev version: `claude plugin install task-utils@task-utils-dev`, restart alex.
4. Dispatch a real sub-agent with an assigned task — verify Write works.
5. Dispatch 3 sub-agents in parallel — verify alex can still claim 1 in_progress slot.
6. Reassign one back to alex — verify rule 4 enforcement kicks in.
7. If green: PR back to upstream nsheaps/agents, swap marketplace back to upstream.

---

## Probe findings (2026-05-25 03:44Z)

Ran the probe per OQ1/OQ2 plan. Temp PreToolUse hook dumped stdin + env on Write/Edit fires; dispatched one sub-agent via `Agent(subagent_type: "general-purpose")` to trigger a sub-agent Write. Both fires captured under `/home/nsheaps/src/nsheaps/.ai-agent-alex/docs/journal/2026/05/25/subagent-hook-probe/`.

### Parent hook input (sample)
```json
{
  "session_id": "6560d0ff-f5b1-4a9c-b585-d996c6a12250",
  "transcript_path": "...",
  "cwd": "/home/nsheaps/src/nsheaps/.ai-agent-alex",
  "permission_mode": "bypassPermissions",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {...},
  "tool_use_id": "toolu_..."
}
```
Notably absent: `agent_id`, `agent_type`, `parent_session_id`.

### Sub-agent hook input (sample)
```json
{
  "session_id": "6560d0ff-f5b1-4a9c-b585-d996c6a12250",   // SAME as parent
  "transcript_path": "...",                                // SAME path
  "cwd": "/home/nsheaps/src/nsheaps/.ai-agent-alex",
  "permission_mode": "bypassPermissions",
  "agent_id": "a114f63a6b8ebf8d0",                         // ← present
  "agent_type": "general-purpose",                         // ← present
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {...},
  "tool_use_id": "toolu_..."
}
```

### Env vars
Identical in both fires — no `CLAUDE_AGENT_ID`, no `CLAUDE_PARENT_SESSION_ID`. `AGENT_NAME=alex` is the launcher-injected human-name only.

### Implications

**OQ1 resolved**: there is NO `parent_session_id` because sub-agents run in the *same session* as the parent. `session_id` is shared. Sub-agent's `TASKS_DIR` at `$CLAUDE_DIR/tasks/$session_id/` IS the parent's task dir — no cross-session lookup needed. Big simplification over the v1 design.

**OQ2 resolved**: the sub-agent's *type* (`agent_type`) and auto-generated *id* (`agent_id`) ARE available in the hook stdin. The `name:` parameter to `Agent()` is NOT exposed to the hook directly — Claude appears to use `agent_id` as the canonical handle. The parent receives `agent_id` back in the Agent() result.

### Revised hook design (replaces v1 §4b)

`require-task-in-progress.sh`:
```bash
AGENT_ID="$(jq -r '.agent_id // empty' <<<"$INPUT")"

if [[ -n "$AGENT_ID" ]]; then
  # Sub-agent fire — look for in_progress task assigned to this agent_id
  for task in "$TASKS_DIR"/*.json; do
    [[ -f "$task" ]] || continue
    t_status="$(jq -r '.status // empty' "$task" 2>/dev/null)"
    t_assignee="$(jq -r '.metadata.assignee // empty' "$task" 2>/dev/null)"
    if [[ "$t_status" == "in_progress" && "$t_assignee" == "$AGENT_ID" ]]; then
      emit_decision allow ""
      exit 0
    fi
  done
  # Fall-through: no assigned task. DENY with coach text explaining the parent
  # must call TaskUpdate(taskId, metadata={assignee: "<agent_id>"}, status=in_progress)
  # BEFORE the sub-agent starts writing.
  REASON="Sub-agent (agent_id=$AGENT_ID, agent_type=$AGENT_TYPE) has no in_progress task assigned. Parent must call TaskUpdate(taskId, metadata={assignee: \"$AGENT_ID\"}, status=in_progress) before dispatching, OR after the agent_id is known (returned by Agent()) and before the sub-agent's first write."
  emit_decision deny "$REASON"
  exit 0
fi

# (existing parent-side logic)
```

`task-invariant.sh` change unchanged from v1 §4a (count `assignee in ["", "alex"]` toward the 0-or-1 invariant; ignore `assignee == <agent_id>` tasks).

### Parent dispatch workflow (revised — replaces v1 §5a)

There's a small ordering challenge: the parent gets `agent_id` back from the `Agent()` call, but if the sub-agent fires its hook before the parent can call `TaskUpdate(metadata={assignee: agent_id})`, the hook will deny. Two approaches:

**A. Foreground dispatch (simple)**: parent runs `Agent({...}, run_in_background: false)` and waits. Doesn't help — same window exists between `Agent()` and the sub-agent's first tool call (they're racing on the same thread? Need to test). Most likely: `Agent()` is synchronous in foreground and the sub-agent runs to completion before returning, so the parent CAN'T update mid-flight.

**B. Pre-mark + claim pattern**: parent creates the task with a placeholder assignee (e.g. `assignee: "PENDING:<task-id>"`), runs `Agent()` whose first instruction is to read its own `agent_id` from the hook input via Bash (Bash isn't gated) and write it to a known location, parent's hook reads that and substitutes. Awkward.

**C. Permissive default (recommended)**: hook ALLOWS when `agent_id` is present but no matching task — emits a WARNING in `additionalContext` instead of denying. Treats sub-agent dispatches as implicitly authorized by the parent's `Agent()` call. Parent still SHOULD call `TaskUpdate(metadata={assignee})` after dispatch for clean accounting, but it's not enforced.

**Recommendation: C**. The friction we're solving is "sub-agents can't write"; making sub-agents partially-trusted is the simplest fix that doesn't require dispatch-time coordination. The parent-side invariant (one alex-in_progress) still enforces discipline where it matters.

### OQ3 (deferred to next sub-task)

Whether `claude plugin install` from a local-directory marketplace requires restart for hook changes is still TBD — will validate when implementing hook changes in the next sub-task.
