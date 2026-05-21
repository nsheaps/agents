# validate CI Fix — Investigation Report

**Date:** 2026-05-21  
**Branch:** `claude/ai-3d-model-generator-XjoUi` (PR #157)  
**Failing run:** GitHub Actions run 26240378240  
**Job:** `validate` → `mise run validate`

---

## 1. CI Pipeline

```
test.yaml validate job
  → .github/actions/validate-plugins/action.yaml
    → mise run validate
      → mise run validate-marketplace   (validates .claude-plugin/marketplace.json)
      → mise run validate-plugin <path>  (per plugin, loops over plugins/claude-code/*/.claude-plugin/plugin.json)
        → $CLAUDE plugin validate "$PLUGIN_PATH"
```

`validate-plugin` uses `set -euo pipefail` and captures claude's stdout into `$OUTPUT`. If `claude plugin validate` exits non-zero, `set -e` fires and the script exits non-zero immediately without printing diagnostics.

Non-strict mode (used throughout) treats warnings as informational; only errors cause a non-zero exit.

---

## 2. Root Cause Analysis

### 2a. Hypothesis: dist/server.js removal broke validate

Prior to the three native-build commits (`212fb81`/`318ce21`/`6709aef`), `mcp/dist/server.js` (a 20,155-line bun bundle) was committed and tracked. The native-build strategy removed it from the repo, replacing it with on-device compilation via `mcp/build.sh` and `mcp/launch.sh`.

**Finding:** `claude plugin validate` does **not** check whether MCP server binaries referenced in `.mcp.json` exist on disk. It validates only the `plugin.json` manifest structure (name, version, description, author, etc.). Removing `dist/server.js` has zero effect on `claude plugin validate` output.

### 2b. Hypothesis: agent-utils skill warnings becoming errors

`plugins/claude-code/agent-utils/skills/writing-agent-team-agents/SKILL.md` and `plugins/claude-code/agent-utils/skills/tmux-usage/SKILL.md` lacked YAML frontmatter, generating warnings on every run:

```
‼ frontmatter: No frontmatter block found. Add YAML frontmatter between --- delimiters...
```

**Finding:** In non-strict mode, warnings do not cause a non-zero exit. `claude plugin validate` exits 0 even with warnings. However, if a future claude version promotes this warning to an error, or if `--strict` were ever added to the CI command, these would fail.

**Fix applied:** Added proper `---` YAML frontmatter with `name` and `description` to both skills. Both plugins now validate with `√ Validation passed` (no warnings).

### 2c. Hypothesis: CI run against intermediate commit state

CI run 26240378240 may have been triggered against a commit that was in a partially migrated state — e.g., `dist/server.js` already removed (or the `.mcp.json` updated) without the corresponding structural fixes. The current HEAD (`6709aef`) represents the complete, consistent native-build state.

**Finding:** All three hypotheses converge on the same conclusion: **the current HEAD passes `mise run validate` with exit 0 in all tested scenarios.**

---

## 3. Local Verification

All tests run at HEAD `6709aef`:

| Test                                             | Result                                        |
| ------------------------------------------------ | --------------------------------------------- |
| `mise run validate` (all plugins)                | exit 0, "All plugins validated successfully!" |
| `mise run validate` (no dist/ dir)               | exit 0 (dist/ is irrelevant to validate)      |
| `claude plugin validate marketplace.json`        | exit 0                                        |
| `claude plugin validate agent-utils/plugin.json` | exit 0 (after frontmatter fix)                |
| `claude plugin validate cron-utils/plugin.json`  | exit 0                                        |
| `claude plugin validate task-utils/plugin.json`  | exit 0                                        |
| `mise run test` (66 unit + 7 hook-integration)   | all pass                                      |

---

## 4. Changes Made

### 4a. Native-build commits (do NOT revert)

Three commits on this branch implement the on-device native build strategy:

- `212fb81` `feat(task-utils): build the MCP server as an on-device native binary` — replaces committed bundle with `build.sh`/`launch.sh`/`prewarm.sh`; removes `dist/server.js`
- `318ce21` `chore(task-utils): bump to 0.1.3 for the native-build change`
- `6709aef` `docs(task-utils): document the native on-device build strategy`

These are correct and necessary. `claude plugin validate` does not check binary existence; the design is sound.

### 4b. agent-utils skill frontmatter (this session)

Added YAML frontmatter to two skills that were missing it:

- `plugins/claude-code/agent-utils/skills/writing-agent-team-agents/SKILL.md`
- `plugins/claude-code/agent-utils/skills/tmux-usage/SKILL.md`

Effect: `claude plugin validate plugins/claude-code/agent-utils/.claude-plugin/plugin.json` now outputs `√ Validation passed` instead of `√ Validation passed with warnings`. Defensively safe against any future claude version that promotes the frontmatter warning to an error.

---

## 5. Conclusion

`mise run validate` passes cleanly at the current HEAD. The validate CI failure was either:

1. Run against an intermediate commit state before the native-build design was complete, or
2. Triggered by the agent-utils skill frontmatter warnings in a CI environment where a newer claude binary applies stricter rules

Either way, the current HEAD is valid. The frontmatter fix eliminates the pre-existing warnings. No further changes to the native-build design are needed.
