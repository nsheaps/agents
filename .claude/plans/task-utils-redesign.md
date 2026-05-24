# task-utils redesign — built-in task decoupling

> Handler correction 2026-05-23 / 24. Step-2 added a dual-scan in
> `require-task-in-progress.sh` / `task-store-lib.sh` / `task-invariant.sh` so
> both project-local YAML AND legacy per-session JSON satisfy the in_progress
> gate. Handler now wants the opposite architecture: MCP tools decoupled from
> built-in, hooks env-var-aware, with a PostToolUse sync fallback for when
> built-in is left enabled.

## Authoritative env var

**`CLAUDE_CODE_ENABLE_TASKS`** — controls native Claude Code Task tools
(`TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`).

| Value           | Effect                                                   |
| --------------- | -------------------------------------------------------- |
| `0`/`false`/`off`/`no` | Native tasks DISABLED — only MCP path                |
| unset + TTY     | DEFAULT ON — native tasks active                         |
| unset + non-TTY | DEFAULT OFF — Claude Code web, headless, piped contexts  |
| `1`/`true`/`on` | Forced ON (VSCode bug per [GH#23874](https://github.com/anthropics/claude-code/issues/23874) — `=1` may not re-enable in VSCode) |

Source: [Tools Reference v2.1.142+](https://code.claude.com/docs/en/tools-reference.md).

## Target architecture

```
┌──────────────────────────────────────────────────────────────┐
│ MCP server (task_create, task_update, ...)                   │
│ • Reads/writes project-local YAML ONLY                       │
│ • No awareness of ~/.claude/tasks/<session>/                 │
│ • git-helper.ts auto-commits on every write (unchanged)       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Hooks                                                         │
│                                                               │
│ PreToolUse:Write|Edit|MultiEdit|NotebookEdit                  │
│   → task-sync-pull.sh (throttled pull, unchanged)             │
│   → require-task-in-progress.sh                                │
│      • Scans ONLY flat (project-local) YAML store              │
│      • No legacy / JSON scan                                   │
│                                                               │
│ PreToolUse:TaskCreate|TaskUpdate                              │
│   → task-invariant.sh (0-or-1 scan, flat YAML only)            │
│   → task-native-warning.sh (NEW)                               │
│      • Skip if CLAUDE_CODE_ENABLE_TASKS=0                      │
│      • Else mode-based: silent | warn | block                  │
│                                                               │
│ PostToolUse:TaskCreate|TaskUpdate                             │
│   → task-sync-from-legacy.sh (NEW, replaces task-auto-commit) │
│      • Skip if CLAUDE_CODE_ENABLE_TASKS=0                      │
│      • Copy ~/.claude/tasks/<sid>/<id>.{json,yaml}             │
│        → <flat_store>/<id>.yaml                                │
│      • git add + commit + push                                 │
└──────────────────────────────────────────────────────────────┘
```

## Phase plan

### Phase R1 — Unwind dual-scan (sub-agent's RC3 fix reversal)
Files in `plugins/claude-code/task-utils/`:
- `hooks/task-store-lib.sh`: `count_in_progress_flat` back to YAML-only.
- `hooks/task-invariant.sh`: 0-or-1 scan back to flat YAML only.
- `hooks/require-task-in-progress.sh`: drop `LEGACY_STORE` resolution + count.
- Update affected hook-integration tests.

### Phase R2 — Env-var detection helper
- New `hooks/builtin-tasks-detect.sh` (sourceable lib):
  ```bash
  # is_builtin_tasks_enabled — returns 0 (true) if native Task tools active
  # Respects CLAUDE_CODE_ENABLE_TASKS env var with same semantics as
  # Claude Code itself; falls back to TTY check when var is unset.
  ```
- Doc in plugin README: env var semantics + `TASK_UTILS_NATIVE_TASK_MODE`.

### Phase R3 — PostToolUse sync hook
- New `hooks/task-sync-from-legacy.sh`:
  - Skip if built-in disabled (sourced helper).
  - Resolve legacy file `~/.claude/tasks/<sid>/<id>.{json,yaml}` from tool result.
  - Convert JSON → YAML if needed; copy to `<flat_store>/<id>.yaml`.
  - `git add <file> && git commit -m 'chore(tasks): sync task <id> from native' && git push` (best-effort, exit 0 always).
  - Log to `.claude/logs/task-sync-from-legacy.log`.
- `hooks/hooks.json`: remove `task-auto-commit.sh` entry, register the new hook.
- Delete `hooks/task-auto-commit.sh`.

### Phase R4 — PreToolUse warning/block
- New `hooks/task-native-warning.sh`:
  - Skip if built-in disabled.
  - Read `TASK_UTILS_NATIVE_TASK_MODE` (default `warn`).
  - `silent` → exit 0.
  - `warn` → `additionalContext` recommending `CLAUDE_CODE_ENABLE_TASKS=0` + use MCP `mcp__task-utils__task_create` etc. Allow.
  - `block` → `permissionDecision: deny` with same recommendation.
- `hooks/hooks.json`: register PreToolUse on `TaskCreate|TaskUpdate` after `task-invariant.sh`.

### Phase R5 — MCP decoupling audit
- Grep `mcp/src/` for `legacy`, `~/.claude/tasks`, `session_id`-keyed paths.
- Remove any references to the legacy store from the MCP server (per the step-2 report, server already writes project-local — verify and clean up).

### Phase R6 — Tests + version + docs
- Update bun test suite to reflect:
  - Single-store scan in hooks (YAML only).
  - Env-var-aware skip in sync + warning hooks.
  - 3-mode warning behavior.
- Update SKILL.md (`task-utils:manage-tasks`), README.
- Bump version `0.1.5` → `0.2.0` (behavior change; minor bump since users who relied on dual-scan need to adjust).

### Phase R7 — Validate in this session
- Add to `agents/.claude/settings.json` `"env"` block: `"CLAUDE_CODE_ENABLE_TASKS": "0"`.
- Restart this session.
- Verify native Task tools absent (no `TaskCreate` in available tools).
- Verify MCP `mcp__task-utils__task_create` works + auto-commits.
- Verify write-gate denies with no in_progress, allows after MCP task is in_progress.

## Decisions for handler

1. **Default `TASK_UTILS_NATIVE_TASK_MODE`?** Recommend `warn` — least surprising; surfaces the issue without breaking workflows that left native on.
2. **Config mechanism — env var or plugin config file?** Recommend env var (`TASK_UTILS_NATIVE_TASK_MODE`). Simpler. Can promote to a config file later if it grows.
3. **Version bump — patch (`0.1.6`) or minor (`0.2.0`)?** Recommend `0.2.0`. The gate's accepted-tasks set changes; that's user-visible.
4. **Disable native tasks for agents repo?** Recommend yes — add `CLAUDE_CODE_ENABLE_TASKS=0` to `agents/.claude/settings.json` so the session this PR ships with uses MCP-only.
5. **Stale legacy `~/.claude/tasks/<sid>/` in_progress tasks (4 found on disk)** — leave them alone (won't be scanned post-redesign), or sweep them as part of R7? Recommend: leave; they're per-session and become unreachable when native is off.

## What does NOT change

- MCP server's `git-helper.ts` auto-commit on MCP task writes (already correct).
- `task-sync-pull.sh` throttled pre-write pull (unchanged).
- `task-scope-guard.sh` UserPromptSubmit advisory (unchanged).
- The YAML migration of farish tasks (committed `c8fb2ca` in nsheaps/farish).
- `data-storage-using-the-filesystem` skill in the new `plugin-dev` plugin.

## Out of scope (separate tickets)

- The `auto-version-bump` CI workflow failure on `nsheaps/agents` — confirmed not transient; the workflow tries to bump a version that's already been bumped manually, hitting a git checkout conflict. Needs a workflow fix (detect already-bumped state and exit cleanly).
- `jack#83` lint failure — pre-existing aqua/401 with mise + `gh`/`jq` tool pins. Out of scope here.
- RC2 atomicity veto + RC4 scope-creep advisory — added in step-2e and left alone for now.
