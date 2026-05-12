# PR Review: ai-mktpl#186 (v2 Re-review)

**Score**: 84/100 ⚠️
**Verdict**: Fix then merge
**Previous**: 75/100 → 84/100

## Fix Verification

| Finding                                                                 | Status            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :---------------------------------------------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2: Empty `"matcher": ""` on PostToolUseFailure hook fixed              | ❌ NOT Fixed      | `plugins/skill-required/hooks/hooks.json` lines 122-131 still has `"matcher": ""` on the PreToolUse hook. The diff adds this file new. The fix for PostToolUseFailure in another plugin may have been addressed, but this NEW plugin introduces the same pattern.                                                                                                                                                                                                                                                                |
| P2: Unguarded glob `*.json` under `set -euo pipefail` now uses nullglob | ✅ Verified (N/A) | The diff for ai-mktpl#186 contains `.ai/rules/file-placement.md`, `.claude-plugin/marketplace.json`, `.claude/skills/code-review/SKILL.md`, `docs/specs/draft/agent-representation.md`, and `plugins/skill-required/`. No glob patterns under `set -euo pipefail` are present in the skill-required hooks scripts. The original glob fix is not visible in this diff — either it was in a different file addressed separately, or the diff is partial. The skill-required scripts use `for i in $(seq ...)` patterns, not globs. |

Fix verification: 1 out of 2 tracked fixes confirmed. The empty matcher issue persists in new code.

## Category Scores

| Category             |  v1 |  v2 | Status |
| :------------------- | --: | --: | :----- |
| Correctness & Logic  |  78 |  82 | ⚠️     |
| Security             |  72 |  80 | ⚠️     |
| Error Handling       |  75 |  82 | ⚠️     |
| Code Quality & Style |  78 |  85 | ✅     |
| Documentation        |  80 |  88 | ✅     |
| Testing              |  65 |  72 | ⚠️     |
| Dependencies         |  78 |  85 | ✅     |
| Spec Compliance      |  72 |  88 | ✅     |

## Remaining / New Findings

**hooks-1** (P2 — High) — CARRIED FORWARD / NEW INSTANCE
**File**: `plugins/skill-required/hooks/hooks.json:122-130`
**Description**: `"matcher": ""` on the PreToolUse hook. An empty string matcher means this hook fires on every single tool use in any session where the plugin is enabled. This is likely intentional (the script then checks config for which tools to gate), BUT the empty-string matcher is semantically ambiguous — does the runtime treat `""` as "match all" or "match nothing"? If it means "match nothing," the PreToolUse hook never fires and enforcement is silently skipped.
**Expected**: Either use a wildcard/match-all token (e.g., `"*"` or omit `matcher` entirely if the runtime supports that) or document explicitly that `""` is the correct "match all" value per the Claude Code hooks spec.
**Actual**: `"matcher": ""` — ambiguous, same pattern as the original v1 P2 finding.
**Steps to reproduce**: Install the plugin, configure a skill requirement, and test if the PreToolUse hook fires before tool use.
**Severity**: High / P2

**security-1** (P3 — Low)
**File**: `plugins/skill-required/hooks/scripts/check-skill-required.sh:163`
**Description**: `project_slug="$(echo "$project_dir" | sed 's|/|_|g' | sed 's|^_||')"` — project slug is derived from `CLAUDE_PROJECT_DIR` and used as a cache directory path component. If `CLAUDE_PROJECT_DIR` contains path traversal characters (e.g., `../../etc`), after substitution the cache path could point outside `~/.claude/cache/`. The sed substitution only replaces `/` with `_`, it does not strip `..` sequences.
**Expected**: Sanitize or validate `CLAUDE_PROJECT_DIR` before using it in path construction, or use `basename` only.
**Actual**: Direct path manipulation without traversal protection.
**Severity**: P3 (requires a maliciously crafted `CLAUDE_PROJECT_DIR`)

**error-handling-1** (P3 — Low)
**File**: `plugins/skill-required/hooks/scripts/check-skill-required.sh:338`
**Description**: `jq ... > "${cache_file}.tmp" && mv "${cache_file}.tmp" "$cache_file"` — the atomic write pattern is correct. However, if jq fails (e.g., malformed cache file), the `.tmp` file is not cleaned up. Minor, but leaves stale `.tmp` files on error.
**Severity**: P3

**docs-1** (P3 — Low)
**File**: `plugins/skill-required/README.md:91`
**Description**: `CLAUDE_PLUGIN_SKILL_REQUIRED_ENABLED=false` env var is documented as a disable override. However, `check-skill-required.sh:223` checks for `CLAUDE_PLUGIN_SKILL_REQUIRED_ENABLED` while `cache-skill-read.sh` has no corresponding check. If the plugin is disabled via env var, skill reads are still cached (pointlessly), which is harmless but inconsistent.
**Severity**: P3

**spec-1** (P2 — High)
**File**: `docs/specs/draft/agent-representation.md`
**Description**: The spec document references `nsheaps/ai` repo as the source for plugins (line 299) but the diff is in `ai-mktpl`. These are the same repo (ai-mktpl is likely the full name). However the spec says "27 plugins" without a source link or date, making it unverifiable. Per `documentation-references.md` rule, substantive claims must be traceable.
**Expected**: Link to the actual plugin count source (e.g., a directory listing or commit SHA).
**Actual**: Bare claim "27 plugins" without reference.
**Severity**: P2 (docs rule violation for a spec document)
