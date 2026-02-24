# Flexibility Category Re-Review — Arcane Docker Compose Deploy v3

**PR**: nsheaps/github-actions#1
**Review round**: v3 (re-review after targeted fixes for M8 and N2)
**Category**: FLEXIBILITY
**Previous score**: 82/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Fixed Findings — Verification

### M8 (Medium): compose-dir scan depth (maxdepth 2) undocumented → FIXED

**Evidence**: 

`action-v3.yml` line 24:
```yaml
compose-dir:
  description: 'Directory to scan for compose files (relative to repo root, up to 2 levels deep). Files matching compose.y[a]ml or docker-compose.y[a]ml are auto-discovered.'
```

`action-readme-v3.md` line 69:
```
| `compose-dir`      | No       |                       | Directory to scan for compose files (up to 2 levels deep)                       |
```

**Status: FIXED** ✓

The two-level depth limitation is now explicitly documented in both the `action.yml` input description and the README Inputs table. Users will see this constraint in IDEs (via action.yml hover), in the GitHub Marketplace, and in the README. The silent failure risk is eliminated because the limitation is now transparent.

---

### N2 (Low): `compose-dir` description missing depth → FIXED

**Evidence**: Same as M8 above. The fix addresses both findings simultaneously.

**Status: FIXED** ✓

---

## Remaining Findings — Status

### N1 (Medium): `--argjson syncInterval` passes unquoted shell variable into jq

**File**: `action-v3.sh` lines 254, 279

**Status: STILL PRESENT**

**Evidence**: `action-v3.sh` lines 249-261 (update) and 272-288 (create):

```bash
--argjson syncInterval "${SYNC_INTERVAL}" \
'{
  name: $name,
  branch: $branch,
  composePath: $composePath,
  autoSync: $autoSync,
  syncInterval: $syncInterval
}'
```

The validation at lines 382-386 ensures `SYNC_INTERVAL` is a positive integer before these functions are called:

```bash
if [[ ! "${SYNC_INTERVAL}" =~ ^[1-9][0-9]*$ ]]; then
  log_error "sync-interval must be a positive integer, got '${SYNC_INTERVAL}'"
  exit 1
fi
```

**Analysis**: The current code works correctly for the main execution path because validation runs before `upsert_sync` is called. However, this remains a fragile coupling: if `upsert_sync` is ever invoked from a different context (refactor, test harness, external call) without passing through this validation point, `--argjson` with a non-integer would fail mid-payload construction with a cryptic jq error.

**Recommendation**: Either:
- **Option A**: Re-validate `SYNC_INTERVAL` inside the `upsert_sync` function itself
- **Option B**: Use `--arg syncInterval` with a type cast: `--arg syncInterval "${SYNC_INTERVAL}"` and then `syncInterval: ($syncInterval | tonumber)` in the jq expression

This makes the function self-contained and removes the ordering dependency entirely.

---

### N3 (Low): `auto-sync: false` + `sync-interval` produces no warning

**File**: `action-v3.sh` lines 253-260, 278-288

**Status: STILL PRESENT**

**Evidence**: When `AUTO_SYNC` is `false`, the `syncInterval` field is still included in the API payload:

```bash
--argjson autoSync "${AUTO_SYNC}" \
--argjson syncInterval "${SYNC_INTERVAL}" \
'{
  name: $name,
  branch: $branch,
  composePath: $composePath,
  autoSync: $autoSync,
  syncInterval: $syncInterval
}'
```

If a user sets `auto-sync: false` and also specifies `sync-interval: 10`, the interval value is included in the payload even though auto-sync is disabled. There is:
- No conditional check
- No warning or log message
- No documentation explaining the interaction

**Impact**: User confusion. A user can set a sync interval value that appears to be accepted, but is meaningless when auto-sync is disabled. They have no feedback to know their configuration is contradictory.

**Recommendation**: Either:
- **Option A**: Emit a `log_info` warning when both `AUTO_SYNC == false` and `SYNC_INTERVAL` is set to a non-default value
- **Option B**: Conditionally exclude `syncInterval` from the payload when `AUTO_SYNC` is `false`
- **Option C**: Document this interaction explicitly in the action.yml descriptions and README

---

### L9 (Low): Optional inputs with computed defaults show `default: ''` in action.yml

**File**: `action-v3.yml` lines 37, 40, 47, 57, 78

**Status: STILL PRESENT**

**Evidence**: `action-v3.yml` still carries `default: ''` for inputs with computed runtime defaults:

```yaml
repository-url:
  description: 'Git repository URL for Arcane to clone. Defaults to the current GitHub repository HTTPS URL.'
  required: false
  default: ''    # actual default: https://github.com/${GITHUB_REPOSITORY}.git (computed in action.sh line 10)

repository-name:
  description: 'Name for the repository in Arcane. Defaults to the GitHub repository name.'
  required: false
  default: ''    # actual default: ${GITHUB_REPOSITORY##*/} (computed in action.sh line 11)

branch:
  description: 'Branch to sync from. Defaults to the branch that triggered the workflow.'
  required: false
  default: ''    # actual default: ${GITHUB_REF_NAME:-main} (computed in action.sh line 12)

sync-name-prefix:
  description: 'Prefix for sync names in Arcane. Defaults to the GitHub repository name.'
  required: false
  default: ''    # actual default: ${GITHUB_REPOSITORY##*/} (computed in action.sh line 19)
```

The human-readable descriptions mention the computed defaults, and the README Inputs table carries human-readable defaults ("GitHub repo HTTPS URL", "GitHub repo name", etc.). However, the machine-readable `action.yml` itself still shows `default: ''`, which is what IDEs, GitHub Marketplace, and schema validators surface first.

**Recommendation**: Add YAML comments in `action.yml` adjacent to the affected inputs to document the computed default inline:

```yaml
branch:
  description: 'Branch to sync from. Defaults to the branch that triggered the workflow.'
  required: false
  default: ''   # computed at runtime: $GITHUB_REF_NAME (or 'main' if not set)
```

This adds only a single comment line per input and makes the computed defaults visible to tooling and first-time readers.

---

## Score Calculation

| Finding | v2 Status | v3 Status | Weight | Change |
|---------|-----------|-----------|--------|--------|
| H3: SYNC_INTERVAL unvalidated | FIXED | Still fixed | +12 | 0 |
| H4: SSH auth-type unusable | FIXED | Still fixed | +10 | 0 |
| M8: maxdepth 2 undocumented | STILL PRESENT | **FIXED** | — | +6 |
| M13: env-vars + compose-dir | FIXED | Still fixed | +6 | 0 |
| L9: computed defaults show `default: ''` | STILL PRESENT | Still present | -2 | 0 |
| N1: `--argjson` ordering coupling | Medium (new) | Still present | -4 | 0 |
| N2: compose-dir missing depth | Low (new) | **FIXED** | — | +2 |
| N3: auto-sync=false + sync-interval silent | Low (new) | Still present | -2 | 0 |

**Previous score**: 82  
**Adjustments**: +6 (M8 fixed) +2 (N2 fixed) = **+8**  
**Net delta**: +8

**v3 Score: 90/100**

---

## Summary

V3 is a solid focused improvement. The two previously-identified documentation gaps (M8 and N2) regarding the `compose-dir` two-level depth limitation are now completely resolved. Both the machine-readable `action.yml` and the human-readable README explicitly document this constraint, eliminating the silent failure risk that existed in v2.

The three remaining findings are low-to-medium severity and do not block merge:

- **N1** (Medium): Fragile coupling between validation placement and jq argument safety. Low immediate risk but worth addressing to improve code robustness.
- **N3** (Low): Silent acceptance of contradictory `auto-sync=false` + `sync-interval` configuration. A user-experience gap rather than a functional failure.
- **L9** (Low): Machine-readable `action.yml` still shows `default: ''` for computed-default fields, despite human-readable descriptions being accurate.

**Recommendation**: Merge as-is. M8/N2 fixes are complete and correct. Consider addressing N1 and N3 in a follow-up PR for further refinement.

**Final Assessment**: The action is production-ready. The most user-visible documentation gap has been eliminated. Remaining findings are minor and can be addressed in future iterations.
