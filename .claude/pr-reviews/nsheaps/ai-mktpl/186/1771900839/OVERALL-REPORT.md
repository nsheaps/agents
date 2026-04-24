## Review: ai-mktpl#186 — claude-team plugin — Score: 75/100

| Category         | Score | Notes                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :--------------- | ----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simplicity       |    70 | Plugin scope is well-bounded, but hooks.json uses empty matcher `""` for PostToolUseFailure — unclear intent                                                                                                                                                                                                                                                                                                               |
| Flexibility      |    78 | Config paths are hardcoded to `$HOME/.claude/tasks/${team_name}` with no override mechanism                                                                                                                                                                                                                                                                                                                                |
| Usability        |    80 | Clear SKILL.md documentation, banner messages are informative, escape-hatch counter is a good UX affordance                                                                                                                                                                                                                                                                                                                |
| Documentation    |    82 | README, SKILL.md, and inline comments are solid; specs (agent-representation.md, github-token-refresh-plugin.md) are well-structured drafts                                                                                                                                                                                                                                                                                |
| Security         |    72 | **settings.json safety concern** — plugin does not manipulate settings.json, so blank-settings bug is not reproduced here. However, the `teammate-deletion-failure-banner.sh` script echoes team config file paths to stderr without sanitizing them, and `check-tasks-before-idle.sh` reads `~/.claude/tasks/${team_name}/*.json` with an unquoted glob that will error if the directory is empty and nullglob is not set |
| Pattern Matching |    75 | New plugins follow the established `.claude-plugin/plugin.json` pattern. Large gs-stack-status.sh deletion is appropriate (moved to gs-stack-status repo). `.release-it.js` files in agent-tab-titles/context-bloat-prevention/fix-pr are copy-pasted boilerplate — could be DRY                                                                                                                                           |
| Best Practices   |    73 | `check-tasks-before-idle.sh` uses `for task_file in "$task_dir"/*.json` which fails with `set -euo pipefail` if the glob matches no files (word splitting error). Script uses `set -euo pipefail` but the glob expansion is unguarded. Cache file counter could be race-conditioned by concurrent hook calls                                                                                                               |
| General QA       |    72 | The empty matcher `""` on PostToolUseFailure hook is suspicious — does it match all tools or match nothing? Needs explicit `"*"` if catch-all is intended. The escape-hatch counter at 3 rejections has no timestamp — stale rejection counts could incorrectly gate teammates across sessions                                                                                                                             |

> ⚠️ Multiple categories below 85% — Needs fixes before merge

---

### Findings

#### P2 — High

**File**: `plugins/claude-team/hooks/hooks.json:14`
**Severity**: High
**Description**: `PostToolUseFailure` hook has an empty string `"matcher": ""` instead of `"*"`. If this is intended to match all tool failures, it should be `"*"`. An empty matcher likely matches nothing or causes undefined behavior, silently disabling the teammate-deletion-failure-banner entirely.
**Expected**: `"matcher": "*"` if intended to fire on all tool failures
**Actual**: `"matcher": ""` — matcher semantics for empty string are not documented
**Steps to reproduce**: Trigger a TeamDelete or SendMessage failure — check whether the banner fires

---

**File**: `plugins/claude-team/hooks/scripts/check-tasks-before-idle.sh:95-106`
**Severity**: High
**Description**: `for task_file in "$task_dir"/*.json` with `set -euo pipefail` active will expand to the literal string `"$task_dir/*.json"` and then fail with `[: too many arguments` or silently mismatch when no `.json` files exist. The `[ -f "$task_file" ] || continue` guard helps but only partially — bash word splitting behavior with unquoted globs under `-u` is fragile.
**Expected**: Use a safe glob pattern: `shopt -s nullglob; for task_file in "$task_dir"/*.json; do`
**Actual**: Unguarded glob that may fail on empty directories depending on bash version/options
**Steps to reproduce**: Run the hook against a team directory with no task files

---

#### P3 — Medium

**File**: `plugins/claude-team/hooks/scripts/check-tasks-before-idle.sh:122-128`
**Severity**: Medium  
**Description**: The rejection counter cache file `${team_name}_${teammate_name}_idle_rejections` has no TTL or timestamp. A counter that hits 3 in one session will carry over to future sessions (the file persists). A teammate correctly completing all tasks and starting fresh could find themselves at rejection count 2 from a previous session crash.
**Expected**: Cache file should be timestamped or scoped to session ID (available from hook input as `session_id`)
**Actual**: Unbounded persistence

---

**File**: `plugins/claude-team/hooks/scripts/teammate-deletion-failure-banner.sh:1196-1197`
**Severity**: Medium
**Description**: The `grep -qiE 'team|teammate|member|shutdown|spawn|agent'` keyword match on error messages is extremely broad. Any error message containing the word "agent" (e.g., a `gh` CLI error mentioning "agent mode") will trigger the banner, creating false positives.
**Expected**: Tighter keyword matching or restrict to specific tool names only
**Actual**: Overly broad error message scanning

---

**File**: `plugins/claude-team/skills/claude-team/SKILL.md` (full file)
**Severity**: Medium
**Description**: The SKILL.md references `--dangerously-skip-permissions` in the reconnection command. This is a significant security flag and should be flagged with a warning in the docs, noting it should only be used in trusted environments.
**Expected**: Prominent warning about the security implications of `--dangerously-skip-permissions`
**Actual**: Listed inline without caveat

---

#### P4 — Info

**File**: `plugins/agent-tab-titles/.claude-plugin/plugin.json`, `plugins/context-bloat-prevention/.claude-plugin/plugin.json`, `plugins/fix-pr/.claude-plugin/plugin.json`
**Severity**: Info
**Description**: Each new plugin has an identical `.release-it.js` boilerplate. This is WET (Write Everything Twice). Consider a shared `../.release-it.base.json` that already handles the bumper plugin and plugins just `extend` it without override, or document that this is intentional copy-paste.
**Actual**: Three identical files added

---

**File**: `plugins/fix-pr/commands/relentlessly-fix.md:7`
**Severity**: Info
**Description**: Command uses `model: claude-4-5-opus` which appears to be a non-existent model name (likely should be `claude-opus-4-5` or similar). Worth verifying the model ID is correct before this command is used.

---

**File**: `.claude/skills/code-review/SKILL.md`
**Severity**: Info
**Description**: File starts with a TODO comment: `<!-- TODO: compare this to the code review skill in scm-utils -->` — this should be resolved before this file ships, not left as an in-code TODO that may never get addressed.

---

### Settings.json Safety Assessment

The special attention item — "there was a known bug where plugins would blank settings.json" — was checked. The `claude-team` plugin does NOT modify settings.json at all. The `plugin.json` manifest has no `settings` key. The hooks (check-tasks-before-idle.sh, teammate-deletion-failure-banner.sh) and the set-tab-title.sh script in agent-tab-titles only interact with task files, cache files, and stdout/stderr. No settings.json risk found in this PR.

### What's Done Well

- The `check-tasks-before-idle.sh` escape hatch (3-rejection counter before allowing idle) is a thoughtful UX decision that prevents infinite blocking while still enforcing the quality gate
- `teammate-deletion-failure-banner.sh` provides clear, actionable recovery instructions with specific file paths — exactly what an operator needs at 2am
- The SKILL.md for `claude-team` captures genuine operational hard-won knowledge (silent SendMessage failures, wrong team name creating empty context, session reconnection gotchas)
- `context-bloat-prevention` README is honest about its own limitations (can't intercept built-in tool output) and links to upstream issues
- The large `gs-stack-status.sh` deletion is appropriate — 1100 lines of tool-specific script moved to its own repo is exactly right

### Verdict

**Fix then merge.** The empty matcher on PostToolUseFailure and the unguarded glob under pipefail are correctness defects that should be fixed before this ships. The settings.json safety concern that was flagged is not reproduced here. The rest of the issues are medium or low severity improvements.

Key fixes needed:

1. Fix `"matcher": ""` → `"matcher": "*"` in `plugins/claude-team/hooks/hooks.json:14`
2. Add `shopt -s nullglob` before the glob in `check-tasks-before-idle.sh:95`
3. Add session-scoping or TTL to the rejection counter cache file
