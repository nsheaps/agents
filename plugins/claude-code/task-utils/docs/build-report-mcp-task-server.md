# Build Report — MCP task server for `task-utils`

**Date:** 2026-05-21
**Branch:** `claude/ai-3d-model-generator-XjoUi` (PR #157)
**Version:** `task-utils` `0.1.1` → `0.1.2`

This report records the execution-phase build of the `task-utils` MCP task
server, per the plan [`docs/plans/mcp-task-server.md`](plans/mcp-task-server.md)
plus the corrections that overrode it (flat CWD-repo storage, bun runtime,
legacy-store coexistence, git auto-commit).

---

## 1. What was built

### MCP server (`mcp/`)

A stdio MCP server (`task-mcp`) in TypeScript using `@modelcontextprotocol/sdk`
v1.29.0, exposing four tools that mirror the built-in Claude Code Task tools:

| Tool          | Mirrors      | Behavior                                                          |
| ------------- | ------------ | ----------------------------------------------------------------- |
| `task_create` | `TaskCreate` | Creates a `pending` task (never born `in_progress`).              |
| `task_update` | `TaskUpdate` | Patches a task; enforces lifecycle invariants; `deleted` removes. |
| `task_list`   | `TaskList`   | Read-only; optional `status` filter.                              |
| `task_get`    | `TaskGet`    | Read-only; single task by id.                                     |

Source modules:

- `mcp/src/validation-steps.ts` — a faithful TypeScript port of the awk
  `<validation-steps>` parser in `hooks/task-invariant.sh`.
- `mcp/src/store.ts` — flat-storage resolution + task-file read/write/delete.
- `mcp/src/git-helper.ts` — best-effort templated git auto-commit + push.
- `mcp/src/tasks.ts` — `TaskManager`, the in-process lifecycle invariants.
- `mcp/src/server.ts` — `McpServer` + four `registerTool` calls + stdio transport.

Built artifact: `mcp/dist/server.js` — a single self-contained bundle
(`bun build --target=node`, 0.68 MB, deps inlined). Committed; the runtime
needs neither `node_modules` nor a network install.

### Storage model (per the corrections — overrides the plan)

Tasks are stored **FLAT** in the CWD git repo:
`<repo-root>/.claude/tasks/<task-id>.json` — no `<session_id>` subdirectory, no
`-mcp` suffix. Resolution order:

1. `TASK_UTILS_TASK_DIR` (absolute path) — used verbatim.
2. `<git-repo-root>/.claude/tasks` — repo root via `git rev-parse --show-toplevel`.
3. `<cwd>/.claude/tasks` — fallback when not in a git repo.

### Hook changes (`hooks/`)

- `hooks/task-store-lib.sh` — NEW shared library: flat-store resolution, legacy
  per-session store resolution, in_progress counting. Sourced by both hooks.
- `hooks/require-task-in-progress.sh` — now resolves the flat store AND scans the
  legacy per-session store (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/`).
  An `in_progress` task in **either** store satisfies the write-gate, so
  built-in-Task-tool users and MCP-fallback users both keep working. The
  `TASK_UTILS_REQUIRE_TASK=0` opt-out is preserved.
- `hooks/task-invariant.sh` — id-addressed task lookup still uses the legacy
  store (where the built-in tools write); the 0-or-1 `in_progress` invariant is
  now scanned across **both** the flat MCP store and the legacy store, so the
  global invariant holds across the two task systems.

### Git auto-commit

On every `task_create` / `task_update` / `task_delete`, the server makes a
best-effort `git add` + `git commit` + `git push` of the task file. Commit
message is a TEMPLATED conventional commit (no AI generation):

- create → `chore(tasks): add task <id> <subject>`
- update → `chore(tasks): update task <id> (<status>)`
- delete → `chore(tasks): remove task <id>`

Any git failure (not a repo, no remote, nothing staged, push rejected, network)
is caught, logged to `<store-root>/.git-auto-commit.log`, and the tool STILL
succeeds. Git is attempted only when the store is inside a git working tree.

### Other deliverables

- `.mcp.json` — declares `task-mcp`, run via `bun`.
- `mise.toml` — new `build-task-mcp` and `test-task-mcp` tasks.
- `.claude-plugin/plugin.json` + repo `marketplace.json` — version `0.1.2`.
- `README.md` — documents the MCP fallback, storage model, git auto-commit.
- `skills/manage-tasks/SKILL.md` — MCP-fallback note + change-log entry.
- `skills/mcp-task-tools/SKILL.md` — NEW skill guiding MCP task-tool usage.

---

## 2. Test results (with evidence)

All tests use temp directories / temp git repos so real repos are not polluted.
Temp git repos set `commit.gpgsign=false` so tests are independent of the host's
signing backend.

### TypeScript typecheck

```
$ bunx tsc --noEmit -p tsconfig.json
TSC exit: 0
```

### Unit + protocol-integration tests (`bun test`)

```
$ cd mcp && bun test
 66 pass
 0 fail
 108 expect() calls
Ran 66 tests across 5 files.
```

Coverage:

- `test/validation-steps.test.ts` — parser parity with the awk parser
  (cross-checked against the actual awk: the middle-missing-RESULT fixture
  yields `MISSING_RESULT=2` from both).
- `test/store.test.ts` — store-root resolution (override / git-root / fallback),
  flat `<id>.json` writes, `nextId`.
- `test/git-helper.test.ts` — templated messages; commit in a real repo;
  push against a real bare remote (succeeds); push with no remote (swallowed);
  not-a-repo (skipped); delete staging.
- `test/tasks.test.ts` — every lifecycle invariant (born-pending, 0-or-1,
  validation-steps required, RESULT required, terminal-completed, deletion).
- `test/integration.test.ts` — drives the BUILT `dist/server.js` over stdio
  with the MCP SDK client; asserts the four tools, flat `<id>.json` writes,
  invariant rejection, and that auto-commit produced `chore(tasks)` commits.

### Hook integration test (`test/hook-integration.test.sh`)

```
$ bash mcp/test/hook-integration.test.sh
PASS — no in_progress task -> deny
PASS — task_create wrote flat <tmp>/tasks/1.json
PASS — task_update promoted task 1 to in_progress
PASS — MCP in_progress task -> allow (CORE ACCEPTANCE CRITERION)
PASS — completed task no longer satisfies the gate -> deny
PASS — opt-out -> no decision emitted (gate disabled)
PASS — Read tool -> hook exits silently (not gated)
PASS — task-invariant.sh denies a 2nd in_progress across flat+legacy stores
ALL HOOK-INTEGRATION TESTS PASSED
```

Test 3 is the **core acceptance criterion**: `require-task-in-progress.sh`
returns `allow` when an MCP-created task is `in_progress`, and `deny` when none
is (Tests 1 + 4).

### Auto-commit against a real remote (manual verification)

A task store inside a working tree with a bare remote produced:

```
git result: {"committed":true,"pushAttempted":true,"pushed":true,"stoppedAt":"done"}
working repo log:  chore(tasks): add task 1 auto-commit smoke task
remote received:   chore(tasks): add task 1 auto-commit smoke task
```

---

## 3. What is live in the cache vs what needs a reload

The plugin is installed as `task-utils@agents` at version `0.1.0`
(`installPath: ~/.claude/plugins/cache/agents/task-utils/0.1.0`). All updated
plugin files were copied into that active cache directory.

**Live immediately (no reload needed):**

- `hooks/require-task-in-progress.sh`, `hooks/task-invariant.sh`,
  `hooks/task-store-lib.sh` — PreToolUse hooks re-exec per tool call, so the
  flat-store + legacy-store dual-scan behavior is live now. Verified: the cached
  hook resolves its shared lib from its own dir and returns `deny` with no task.

**Needs a plugin reload / restart to take effect:**

- The `task-mcp` MCP server. A newly-added MCP server is connected at session
  start (or on `/reload-plugins`). The `.mcp.json`, `mcp/dist/server.js`, and
  `plugin.json` are in the cache dir, but Claude Code will not spawn the server
  process until the plugin is reloaded. The cached `dist/server.js` was verified
  to start and respond to `initialize` over stdio (`serverInfo.name=task-mcp`,
  `version=0.1.2`).

The `installed_plugins.json` entry still pins version `0.1.0`; the cache
directory contents were updated in place. A future `claude plugin install` /
marketplace refresh would resolve `0.1.2` cleanly.

---

## 4. Version, commits

- Version: `task-utils` `0.1.1` → `0.1.2` in both `.claude-plugin/plugin.json`
  and the repo `.claude-plugin/marketplace.json`.
- Commit hashes: see the branch `claude/ai-3d-model-generator-XjoUi` history
  (PR #157).

---

## 5. Genuine remaining issues / notes

1. **MCP tool-name prefix unverified.** The exact `mcp__…` prefix a
   plugin-provided server's tools receive (whether the plugin name is included)
   is not verified — it surfaces only after a real plugin reload. `/mcp` will
   show it.
2. **`mise run build-task-mcp` / `test-task-mcp`** are correctly defined but
   were verified by running their steps directly; `mise run` itself tries to
   re-fetch pinned tools (jq) and hit a GitHub API rate limit in this sandbox —
   an environmental issue, not a task defect. The build + test steps themselves
   all pass.
3. **`task-invariant.sh` legacy lookup.** The id-addressed task lookup still
   reads the legacy per-session store because that is where the built-in Task
   tools write. If a consumer sets `TASK_UTILS_TASK_DIR` AND uses the built-in
   tools, the built-in tools still write to the legacy path; this is expected —
   a context uses either the built-ins or the MCP fallback, not both.
4. **Follow-up (from the plan §10):** extracting the validation-steps parser
   into a single shared spec consumed by both the awk hook and the TS server,
   so the two cannot drift. Currently kept in parity by a cross-checked test.

---

## References

- Plan: [`docs/plans/mcp-task-server.md`](plans/mcp-task-server.md)
- Research: [`docs/research/`](research/)
- MCP SDK: <https://github.com/modelcontextprotocol/typescript-sdk> (v1.29.0)
