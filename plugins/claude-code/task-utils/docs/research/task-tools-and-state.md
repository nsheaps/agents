# Research — Built-in Task tools and on-disk task state

Research output for the `task-utils` MCP-task-server feature. This file documents
(a) what the built-in Task tools are and their data model, and (b) the exact JSON
shape the `task-utils` hooks read off disk, inferred from the hook scripts.

> **Status:** the Task-tool data model in §1–2 is sourced from official Claude Code
> docs. The **on-disk JSON file format** in §3 is **inferred** from the hook
> scripts — Anthropic does not publish the per-task JSON file schema. Items
> marked "unverified" could not be confirmed against an official source and must
> be validated empirically before implementation (see §5).

---

## 1. The built-in Task tools

Claude Code exposes four built-in task tools — `TaskCreate`, `TaskUpdate`,
`TaskList`, `TaskGet` — which replaced the older single `TodoWrite` tool.[^1]

> "As of TypeScript Agent SDK 0.3.142 and Claude Code v2.1.142, sessions use the
> structured Task tools `TaskCreate`, `TaskUpdate`, `TaskGet`, and `TaskList`
> instead of `TodoWrite`."[^1]

Task lifecycle, per the docs:[^1]

> 1. **Created** as `pending` when tasks are identified
> 2. **Activated** to `in_progress` when work begins
> 3. **Completed** when the task finishes successfully
> 4. **Removed** when all tasks in a group are completed

The migration section notes the structural change relevant to this plugin:[^1]

> "The Task tools split the single `TodoWrite` call into `TaskCreate` for each new
> item and `TaskUpdate` for each status change, with `TaskList` and `TaskGet`
> available for the model to read back the current list ... maintains a map keyed
> by task ID instead of replacing the whole list on every call."

**Why a fallback is needed:** the built-in Task tools are gated behind
`CLAUDE_CODE_ENABLE_TASKS` and are not enabled in every context — notably Claude
Code on the web. When they are absent, no `TaskCreate`/`TaskUpdate` calls are
possible, so `require-task-in-progress.sh` can never see an `in_progress` task and
the write-gate becomes permanently unsatisfiable. The docs confirm the toggle
exists (examples set `CLAUDE_CODE_ENABLE_TASKS=0` to keep `TodoWrite`).[^1] The
specific claim "the Task tools are disabled on Claude Code web" is asserted in the
`task-utils` hook comments themselves[^2][^3] and treated here as the project's
established premise — it is **unverified** against an Anthropic doc page.

---

## 2. Task-tool input/output schemas (official)

From the migration comparison table:[^1]

| Tool         | Input shape (official)                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `TaskCreate` | `{ subject, description, activeForm?, metadata? }`                                                       |
| `TaskUpdate` | `{ taskId, status?, subject?, description?, activeForm?, addBlocks?, addBlockedBy?, owner?, metadata? }` |

- `status` is one of `"pending"`, `"in_progress"`, `"completed"`; `status: "deleted"` deletes a task.[^1]
- The assigned task **id is not in the `TaskCreate` input** — it is returned in the
  `tool_result` as `{ task: { id, subject } }`.[^1]
- `addBlocks` / `addBlockedBy` express dependency edges; `owner` is an assignee
  field; `metadata` is free-form.[^1]
- `TaskList` / `TaskGet` are read-only — they let the model read back the current
  list or a single task snapshot.[^1]

`TaskGet`'s and `TaskList`'s exact result shapes are **not** specified in this doc
page beyond "a snapshot of the current list" — **unverified**; the MCP
replacements (see the plan) should return a superset that includes every field
the hooks and `manage-tasks` skill reference.

---

## 3. On-disk task state — inferred from the hook scripts

The two `task-utils` PreToolUse hooks read task state from **per-task JSON files**,
not from the tools' return values. The location and shape below are read directly
out of the hook source.

### 3.1 Storage location

Both hooks compute the directory identically:[^2][^3]

```sh
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
TASKS_DIR="$CLAUDE_DIR/tasks/$SESSION_ID"
```

- `CLAUDE_CONFIG_DIR` — Claude Code's config dir; defaults to `$HOME/.claude`.
- `$SESSION_ID` — taken from the hook stdin JSON field `.session_id`.[^2][^3]
- Each task is a file `*.json` directly under `TASKS_DIR` (the hooks enumerate
  with `find "$TASKS_DIR" -maxdepth 1 -name '*.json'`).[^2][^3]
- `task-invariant.sh` additionally addresses a single task by id:
  `TASK_FILE="$TASKS_DIR/${TASK_ID}.json"`.[^3] **This pins the filename
  convention: the file is named `<id>.json`.**

So the built-in Task tools are understood (by the hooks) to materialise each task
as `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/<task_id>.json`. That
the built-in tools actually write files at this exact path is **inferred from the
hooks** (the hooks were "designed around" the built-ins per the feature brief) and
is **unverified** against an official doc — it must be confirmed empirically
before relying on it (§5).

### 3.2 JSON fields the hooks read

Every field the hooks `jq`-extract from a task file:

| JSON path      | Read by                 | Used for                                              |
| -------------- | ----------------------- | ----------------------------------------------------- |
| `.status`      | both hooks[^2][^3]      | counting `in_progress`; transition checks             |
| `.id`          | `task-invariant.sh`[^3] | skip-self when scanning for other `in_progress` tasks |
| `.subject`     | `task-invariant.sh`[^3] | human-readable conflict message                       |
| `.description` | `task-invariant.sh`[^3] | source of the `<validation-steps>` block              |

Minimum viable task file shape the hooks accept:

```json
{
  "id": "<string>",
  "subject": "<string>",
  "status": "pending | in_progress | completed",
  "description": "<string, may contain a <validation-steps> block>"
}
```

Notes:

- `jq -r '.<field> // empty'` is used throughout, so **missing fields degrade to
  empty** rather than erroring — extra fields are harmless and absent ones are
  tolerated, but `id`/`status`/`subject`/`description` should all be present for
  the hooks to behave correctly.
- `.id` in the file must equal the `<id>` in the filename for the self-skip logic
  in `task-invariant.sh` to work (`f_id == TASK_ID`, where `TASK_ID` comes from
  `tool_input.taskId`).[^3]

### 3.3 The `<validation-steps>` contract (description content)

`task-invariant.sh` parses a `<validation-steps>...</validation-steps>` block out
of the task `description` and enforces:[^3]

- `pending → in_progress` is denied unless the block has **≥1 unchecked `- [ ]`**
  item.
- `in_progress → completed` is denied if **any `- [ ]` remains**, or if any
  `- [x]` is **not followed by a `RESULT(...)` line**.
- `pending → completed` skips the validation-step check entirely.
- Open/close tags must each be alone on a line (`^[ \t]*<validation-steps>[ \t]*$`).

Format, per `manage-tasks/SKILL.md` §10:[^4]

```text
<validation-steps>
 - [ ] do a thing
 - [x] do another thing
       RESULT(2026-05-17 04:06Z, by alex): evidence — log line "X" confirms.
</validation-steps>
```

### 3.4 Lifecycle invariants the hooks enforce

| Invariant                                                                       | Hook                          | Source   |
| ------------------------------------------------------------------------------- | ----------------------------- | -------- |
| 0-or-1 task `in_progress`                                                       | `task-invariant.sh`           | [^3][^4] |
| `TaskCreate` may not be born `in_progress`                                      | `task-invariant.sh`           | [^3][^4] |
| Write tools (`Write/Edit/MultiEdit/NotebookEdit`) require an `in_progress` task | `require-task-in-progress.sh` | [^2][^4] |
| `pending → in_progress` requires a `<validation-steps>` block                   | `task-invariant.sh`           | [^3][^4] |
| `* → completed` requires all steps checked + `RESULT` lines                     | `task-invariant.sh`           | [^3][^4] |

`require-task-in-progress.sh` already supports `TASK_UTILS_REQUIRE_TASK=0` to
disable the write-gate where the Task tools are unavailable.[^2] The MCP-task-server
feature is the alternative to that opt-out: instead of disabling the gate, supply a
fallback mechanism that satisfies it.

---

## 4. Implications for the MCP fallback

For an MCP-created task to satisfy the existing hooks **unchanged**, the MCP
server must write a JSON file:

1. at a path the hooks scan (`<config>/tasks/<scan-id>/<task-id>.json`), and
2. containing at least `id`, `subject`, `status`, `description`, with
3. `description` carrying the `<validation-steps>` block when the task is meant
   to be startable, and
4. `id` matching the filename stem.

The collision risk: if MCP-managed tasks were written under the _same_
`<session_id>` directory as built-in tasks, the two systems' id spaces could
overlap and `task-invariant.sh`'s id-addressed `TASK_FILE` lookup could read the
wrong file. Hence the feature brief's requirement to store MCP tasks under a
**distinct id** — see the plan doc for the concrete proposal.

---

## 5. Open verification items (must confirm before implementation)

- [ ] **unverified** — that the built-in Task tools write files at
      `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/<task_id>.json`. Confirm
      by creating a task with the built-in tools in a normal session and inspecting
      the directory.
- [ ] **unverified** — the full JSON schema the built-in tools write (do they
      include `blockedBy`, `blocks`, `metadata`, `activeForm`, `owner`, timestamps?).
      The hooks only read four fields, but the MCP replacement should mirror the real
      shape so `TaskList`/`TaskGet` equivalents are faithful.
- [ ] **unverified** — whether Claude Code on the web actually disables the Task
      tools (the project premise). Confirm against the web environment or an
      Anthropic doc.
- [ ] **unverified** — whether `CLAUDE_CONFIG_DIR` is set in the MCP server's
      environment on Claude Code web (the MCP server needs it to find the same
      directory the hooks use).

---

[^1]: Claude Code docs — "Todo tracking" / "Migrate to Task tools": <https://code.claude.com/docs/en/agent-sdk/todo-tracking>

[^2]: `task-utils` hook — [`hooks/require-task-in-progress.sh`](https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/hooks/require-task-in-progress.sh)

[^3]: `task-utils` hook — [`hooks/task-invariant.sh`](https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/hooks/task-invariant.sh)

[^4]: `task-utils` skill — [`skills/manage-tasks/SKILL.md`](https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/skills/manage-tasks/SKILL.md)
