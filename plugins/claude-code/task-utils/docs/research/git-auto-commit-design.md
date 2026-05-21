# Design — Git Auto-Commit + Push on Task Write

When the task-utils MCP server writes, updates, or deletes a task file, it should attempt to `git add` + `git commit` + `git push` the change automatically.

## Requirements

- **Conventional commit message**, TEMPLATED (no AI model calls):
  - Create: `chore(tasks): add task <id> <subject>`
  - Update: `chore(tasks): update task <id> (<status>)`
  - Delete: `chore(tasks): remove task <id>`
- **Best-effort**: Any failure (not a git repo, no remote, staging failure, push rejected, network error) is caught, logged, and the tool still succeeds. Task writes must never fail on git.
- **Condition**: Only attempt git when the store is inside a git working tree.

## Git Command Sequence

```bash
# 1. Check if in a git repo
if ! git -C "$STORE_ROOT" rev-parse --git-dir > /dev/null 2>&1; then
  # Not a git repo — skip all git ops
  return
fi

# 2. Stage the file
git -C "$STORE_ROOT" add "$FILE_PATH" 2>/dev/null || return

# 3. Commit
git -C "$STORE_ROOT" commit -m "$COMMIT_MSG" 2>/dev/null || return

# 4. Push (no retry on conflict — log and proceed)
git -C "$STORE_ROOT" push origin 2>/dev/null || return
```

## Error Handling

Each step wraps stderr to a log file. If ANY step fails:
- Log the error with context (which file, which step, error message)
- Continue (do not re-throw)
- The tool still returns success to the caller
- The task file was written; git just didn't persist it

Example logging structure:
```
[2026-05-21T14:23:45.678Z] mcp-task-server git auto-commit
  file: /path/to/tasks/abcd-mcp/123.json
  operation: create
  git-status: failed at push stage
  error: remote error: Repo is read-only
  action: logged; task file written; commit + push abandoned
```

## Implementation Strategy

- Wrap git sequence in a helper function `tryGitAutoCommit(filePath, operation)`
- Call helper AFTER file write succeeds (so file is guaranteed on disk)
- Never throw on git failure; log and return `true` (success)
- Place helper in `src/git-helper.ts` (separate from `store.ts` for clarity)

## Runtime Checks

- `node` has subprocess spawn capability (`child_process.execSync` or `execa`)
- `git` must be on PATH (reasonable assumption for a dev machine)
- If `git` is not found, log and skip

## Interaction with `.mcp.json`

The `.mcp.json` `env` block should explicitly pass `TASK_UTILS_TASK_DIR` so the server and hooks agree on the store root. Git operations use the same store root.

## Follow-Up Work

- Monitor auto-commit success rates in early adopters
- Consider fallback behavior (e.g., queue commits for manual push if in a readonly sandbox)
- Track which errors occur most often (push rejected? readonly fs? git not found?)

---

[Design for NEW requirement 2 — auto-commit & push on write]
