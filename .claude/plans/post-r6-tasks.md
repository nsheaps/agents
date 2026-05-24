# Post-R6 task breakdown

Date: 2026-05-24
Branch: `claude/ai-3d-model-generator-XjoUi` (PR [#157](https://github.com/nsheaps/agents/pull/157))

## Context

PR #157 landed phases R1–R6 of the task-utils redesign on this branch (4 commits + an auto-fix lint commit). R7 (in-session validation) was deferred because the new PreToolUse/PostToolUse hooks only load at SessionStart. Several follow-up items came up during the redesign that don't belong in #157 and need their own tracking issues.

This file enumerates those items and the order they should be picked up in. Each item below maps 1:1 to a GitHub issue created in `nsheaps/agents` or `nsheaps/farish`. Issues are chained `Blocked by` so they execute sequentially.

## Items

### 1. R7 — in-session validation of task-utils 0.2.0 redesign — [nsheaps/agents#168](https://github.com/nsheaps/agents/issues/168)

- **Repo**: nsheaps/agents
- **Blocks**: merge of [#157](https://github.com/nsheaps/agents/pull/157)
- **What**: With this branch checked out and Claude Code restarted (so new hooks load), verify:
  1. `task-native-warning.sh` fires `additionalContext` advisory when `TaskCreate` / `TaskUpdate` is used (mode: warn).
  2. `task-sync-from-legacy.sh` (PostToolUse) copies native Task tool files from `~/.claude/tasks/<sid>/<id>.{json,yaml}` into the project-local flat YAML store and commits them.
  3. `require-task-in-progress.sh` denies `Write` / `Edit` / `MultiEdit` / `NotebookEdit` when no flat-store task is `in_progress`; allows once an MCP task is `in_progress`.
  4. `requireTaskInProgress: false` settings opt-out actually disables the gate.
  5. `mcp__task-utils__task_create` + `mcp__task-utils__task_update(status=in_progress)` round-trips through `git-helper.ts` auto-commit.

### 2. fix: `auto-version-bump` workflow false-positive on `nsheaps/agents` — [nsheaps/agents#169](https://github.com/nsheaps/agents/issues/169)

- **Repo**: nsheaps/agents
- **Blocked by**: #168
- **What**: The `auto-version-bump` workflow tries to bump versions that have already been bumped manually in the same PR (e.g. R6 bumped task-utils 0.1.5→0.2.0 manually) and hits a git checkout conflict, failing the run. The workflow should detect "already at target version" and exit cleanly. Confirmed not transient — repros on every push to this branch.
- **Reference**: failing runs on PR [#157](https://github.com/nsheaps/agents/pull/157).

### 3. chore(task-utils): promote `plugin-settings-lib.sh` to shared-lib plugin — [nsheaps/agents#170](https://github.com/nsheaps/agents/issues/170)

- **Repo**: nsheaps/agents
- **Blocked by**: #169
- **What**: R2 introduced an inline `plugin-settings-lib.sh` (3-tier yq-backed config reader) in the task-utils plugin because the agents repo cannot currently depend on ai-mktpl's shared-lib. Once that dependency story is resolved, the inline lib should be deleted and task-utils should source the canonical version from shared-lib.
- **Prerequisite**: agents repo gains a way to depend on ai-mktpl plugins (out of scope here — track separately if it doesn't already exist).

### 4. chore(tasks): migrate legacy JSON tasks to YAML format — [nsheaps/farish#3](https://github.com/nsheaps/farish/issues/3)

- **Repo**: nsheaps/farish
- **Blocked by**: nsheaps/agents#170
- **What**: Pre-existing JSON task files left over before task-utils standardised on YAML need to be converted. Was tagged "skipped" in the R1–R6 report ([report `.claude/tmp/task-utils-redesign-report.md`](https://github.com/nsheaps/agents/blob/claude/ai-3d-model-generator-XjoUi/.claude/tmp/task-utils-redesign-report.md) §"Skipped Items"). Should use the same conversion logic as `task-sync-from-legacy.sh` (jq pipeline).
- **Related**: nsheaps/farish PR #2 (legacy migration in progress).

## Items intentionally NOT created as issues

- **`jack#83` lint flake** (aqua/401 on `cli/cli`, `mikefarah/yq`, `claude-utils` during mise install when GH App token isn't ready before mise runs) — already tracked at [nsheaps/.ai-agent-jack#83](https://github.com/nsheaps/.ai-agent-jack/issues/83). Comment there rather than duplicate.
- **Stale `~/.claude/tasks/<sid>/<id>.{json,yaml}` legacy in_progress files on the agents host** — handler decision in plan §"Decisions for handler" item 5: leave alone (won't be scanned post-redesign; become unreachable when native is off).
- **PR #157 title/body update + monitor to merge** — operational; handled directly via `gh pr edit` + the existing PR-monitoring discipline, not a separate issue.

## Dependency chain

```
#168 R7 validation  →  #169 auto-version-bump fix  →  #170 plugin-settings-lib promotion  →  farish#3 YAML migration
```

Linear chain at the handler's request ("execute in order"). True dependencies are weaker:

- #168 genuinely blocks merge of PR #157.
- #169 is independent of #168 in code, but #157 must merge before any follow-on PR has a clean CI baseline.
- #170 requires #157 to be merged AND an ai-mktpl-dependency mechanism to exist on agents repo.
- farish#3 is independent of #168/#169/#170 but lower priority than fixing CI.
