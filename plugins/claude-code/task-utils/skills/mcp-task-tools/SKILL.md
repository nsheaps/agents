---
name: mcp-task-tools
description: This skill should be used when the built-in Claude Code Task tools (TaskCreate / TaskUpdate / TaskList / TaskGet) are unavailable — notably Claude Code on the web — and task tracking must instead go through the task-utils `task-mcp` MCP server. Trigger phrases — "TaskCreate is not available", "there are no Task tools", "the write-gate keeps denying my edits and I can't create a task", "how do I track tasks on Claude Code web", "use the MCP task tools", "task_create / task_update / task_list / task_get".
---

# mcp-task-tools

The `task-utils` plugin bundles an MCP server, `task-mcp`, that exposes four
task-management tools — `task_create`, `task_update`, `task_list`, `task_get` —
as a **fallback** for contexts where the built-in `TaskCreate` / `TaskUpdate` /
`TaskList` / `TaskGet` tools are not enabled (notably Claude Code on the web).

Use this skill to drive the MCP task tools correctly. The task-management
_doctrine_ (atomicity, breakdown, validation-steps, 0-or-1 in_progress) is
unchanged — see `Skill(manage-tasks)`. This skill covers only the MCP tool
mechanics.

## When to use the MCP tools instead of the built-ins

Use the MCP tools when the built-in Task tools are absent. Symptoms:

- `TaskCreate` / `TaskUpdate` are not in the available tool set.
- The `require-task-in-progress.sh` write-gate denies `Write` / `Edit` /
  `MultiEdit` / `NotebookEdit` with "No task in_progress" and there is no
  built-in `TaskUpdate` to satisfy it.

When the built-in Task tools ARE available, prefer them — the MCP server is a
fallback, not a replacement. Do not run both task systems in one session.

The tools surface under the MCP namespace (confirm the exact prefix with
`/mcp` — typically `mcp__task-utils__task-mcp__task_create` and similar).

## The four tools

### `task_create`

Creates a task. The task is **born `pending`** — there is no `status` input, so
a task can never be created `in_progress` (mirrors the built-in invariant).

- Input: `subject` (required), `description?`, `activeForm?`, `metadata?`.
- Output: `{ task: { id, subject }, git: {...} }`. The assigned `id` is the
  small integer to use in subsequent `task_update` calls.
- Include a `<validation-steps>` block in `description` when the task is meant
  to be startable (or add it later in the `task_update` that promotes it).

### `task_update`

Updates a task by id. Enforces the lifecycle invariants in-process.

- Input: `taskId` (required), `status?`, `subject?`, `description?`,
  `activeForm?`, `addBlocks?`, `addBlockedBy?`, `owner?`, `metadata?`.
- `status: "deleted"` removes the task file.
- The server merges `description` with the stored task before evaluating
  invariants — set the `<validation-steps>` block and `status: "in_progress"`
  in the SAME call.

Rejected transitions return an error result whose text explains the fix:

| Transition                | Requirement                                                                  |
| ------------------------- | ---------------------------------------------------------------------------- |
| `pending → in_progress`   | a `<validation-steps>` block with ≥1 unchecked `- [ ]`; 0 others in_progress |
| `in_progress → completed` | every step `- [x]` and each `- [x]` followed by a `RESULT(...)` line         |
| `pending → completed`     | always allowed (skips the validation-step check)                             |
| `* → in_progress`         | denied if another task is already in_progress (0-or-1 invariant)             |

### `task_list`

Read-only. Lists all tasks; optional `status` filter. Output:
`{ tasks: [...], count: N }`.

### `task_get`

Read-only. Fetches one task by `taskId`. Returns an error result if the id is
unknown.

## Typical flow

1. `task_create({ subject: "fix the broken import" })` → note the returned `id`.
2. `task_update({ taskId: id, status: "in_progress", description: "<validation-steps>\n - [ ] import resolves; build passes\n</validation-steps>" })`.
3. Do the work. The `require-task-in-progress.sh` write-gate now allows edits.
4. `task_update({ taskId: id, status: "completed", description: "<validation-steps>\n - [x] import resolves; build passes\n       RESULT(<ISO-8601 UTC>): build green, see output\n</validation-steps>" })`.

## Storage and git

- Tasks are stored FLAT at `<store-root>/<id>.json`. `<store-root>` is
  `TASK_UTILS_TASK_DIR` if set, else `<git-repo-root>/.claude/tasks`, else
  `<cwd>/.claude/tasks`.
- Every create / update / delete triggers a **best-effort** templated git
  commit + push (`chore(tasks): …`) when the store is in a git working tree.
  Git failures are logged to `<store-root>/.git-auto-commit.log` and swallowed —
  the tool result still reports success, and the `git` field describes what
  happened.

## Anti-patterns

- Trying to create a task already `in_progress` — impossible by design; create
  `pending`, then promote with `task_update`.
- Promoting to `in_progress` without a `<validation-steps>` block — denied. Add
  the block in the same `task_update` call.
- Marking `in_progress → completed` with unchecked steps or missing `RESULT`
  lines — denied. Check every step off with a `RESULT(...)` evidence line first.
- Running the MCP tools alongside the built-in Task tools in the same session —
  pick one; the MCP server is the fallback for when the built-ins are absent.
