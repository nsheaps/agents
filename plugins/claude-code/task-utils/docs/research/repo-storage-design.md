# Design Decision — Task Storage When TASK_UTILS_TASK_DIR Points Into a Git Repo

**Context:** The consuming project (farish) will set `TASK_UTILS_TASK_DIR` to its own repo's `.claude/tasks/` (making task state a repo-tracked artifact). The hooks' model is per-session (`<root>/<session_id>[-mcp]/`). Committing one `<uuid>-mcp/` directory per session into a repo creates clutter.

## Decision

**Keep storage session-scoped** — the hooks read session-agnostically; require-task hook uses an AND logic.

The key insight: **the hooks already support session-agnostic reads.** The `require-task-in-progress.sh` hook (line 67–74) scans the directory for ALL `*.json` files with `status: "in_progress"` — it does NOT filter by session id. It returns allow if ANY in_progress task exists, from any session.

Therefore:

- Store tasks in `$TASK_UTILS_TASK_DIR/<session_id>[-mcp]/` as specified
- When `TASK_UTILS_TASK_DIR` points into a git repo, each session creates its own subdirectory
- The hooks' read logic is unchanged: scan the entire root for in_progress tasks
- In practice, only the current session's directories exist; past sessions are inert (committed snapshots)
- This yields a clean, persistent, git-tracked task list (one directory per session) while keeping the write-gate correct

## Why This Works

1. **Hook behavior unchanged**: `require-task-in-progress.sh` scans `<store_root>` looking for `<session_id>/` and `<session_id>-mcp/` directories with in_progress tasks. It doesn't care about session ids during read — it just looks for the presence of in_progress.

2. **No flat renaming needed**: Stable task ids (like "1", "2", "3") are already unique within a session. Moving to flat storage would require prefixing (e.g., "s1-1", "s1-2") to avoid collisions across sessions, adding noise.

3. **Clean repo state**: Committing `tasks/<session-uuid>/` and `tasks/<session-uuid>-mcp/` directories is reasonable. Each session owns its subtree. Over time, the repo accumulates sessions, making task history auditable.

4. **Write-gate correctness**: The hook returns allow if ANY in_progress task exists in ANY session directory. This is actually desirable: if a task from a previous session is still in_progress, the user should finish it before starting new work. (In practice, sessions are short-lived; this edge case is rare.)

## Alternative Considered (Rejected)

**Flat storage with session-agnostic ids** (e.g., task "1" committed, no session scoping):

- Pro: No per-session directory clutter in git
- Con: Conflicting task ids across sessions (user runs session A, creates task "1"; later runs session B, tries to create task "1" — collision)
- Con: Hook logic to handle collisions (scan for id match across all sessions, enforce uniqueness — complex)
- Con: Violates the original design principle "distinct id" (§2.2 of the plan)

**Reject this: session scoping is cleaner.**

## Resulting Hook Behavior

The hooks are modified to:

1. Resolve `TASK_UTILS_TASK_DIR` (new env var) instead of hard-coding `~/.claude/tasks`
2. Scan **both** `<resolved-root>/<session_id>/` and `<resolved-root>/<session_id>-mcp/` for in_progress tasks
3. Return allow if any in_progress exists in either directory

This is the same behavior as today, just with configurable store root and support for the MCP-managed `-mcp` directory.

## Git Workflow Example (farish)

```
User sets: TASK_UTILS_TASK_DIR=/home/user/farish/.claude/tasks

Session 1 (abc-def-123):
  MCP creates task 1 → /home/user/farish/.claude/tasks/abc-def-123-mcp/1.json

  Hook scans /home/user/farish/.claude/tasks/ for in_progress
  → finds abc-def-123-mcp/1.json with status=in_progress
  → allows write

User runs: git add .claude/tasks && git commit -m "chore: session snapshots"
  → Commits abc-def-123-mcp/1.json to repo

Session 2 (xyz-ghi-456):
  New task created → /home/user/farish/.claude/tasks/xyz-ghi-456-mcp/2.json

  Hook scans again
  → finds xyz-ghi-456-mcp/2.json in_progress
  → allows write

  abc-def-123-mcp/ remains committed but inactive (no live session reads it)
```

## Implication for Git Auto-Commit (Requirement 2)

When the MCP server auto-commits task files, it commits them within the session directory. Over time:

```
.claude/tasks/
  ├── session-A/
  │   ├── 1.json (created, updated, completed, committed)
  │   └── 2.json (created, updated, committed)
  ├── session-A-mcp/
  │   └── 1.json (created, updated, completed, auto-committed)
  └── session-B-mcp/
      ├── 1.json (current session, in_progress, auto-committing)
      └── 2.json (current session)
```

The repo grows a persistent audit trail of all task activity, scoped by session.

---

[Design for NEW requirement 1 — storage in the consuming repo]
