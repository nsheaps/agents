# Flexibility Category Re-Review — Arcane Docker Compose Deploy v2

**PR**: nsheaps/github-actions#1
**Review round**: v2 (re-review after fixes)
**Category**: FLEXIBILITY
**Previous score**: 62/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Previous Findings — Status

### H3 (High): SYNC_INTERVAL unvalidated — jq aborts mid-deploy

**Status: FIXED**

**Evidence**: `action-v2.sh` lines 376-380:
```bash
# [H3] Validate sync-interval is a positive integer
if [[ ! "${SYNC_INTERVAL}" =~ ^[1-9][0-9]*$ ]]; then
  log_error "sync-interval must be a positive integer, got '${SYNC_INTERVAL}'"
  exit 1
fi
```

Validation runs before any API call or jq usage. The regex `^[1-9][0-9]*$` correctly rejects zero, negative integers, floats, and non-numeric strings. A mid-deploy abort from a bad interval value is no longer possible. The default `'5'` in `action-v2.yml` line 68 passes this regex. Fix is complete and correct.

---

### H4 (High): SSH auth-type advertised but unusable

**Status: FIXED**

**Evidence**: `action-v2.sh` lines 370-374:
```bash
# [H4] Reject unsupported auth-type values
if [[ "${AUTH_TYPE}" != "none" && "${AUTH_TYPE}" != "http" ]]; then
  log_error "auth-type '${AUTH_TYPE}' is not supported. Valid values: none, http."
  exit 1
fi
```

`action-v2.yml` line 50-52:
```yaml
auth-type:
  description: 'Git authentication type: none or http'
  default: 'http'
```

`action-readme-v2.md` line 74:
```
| `auth-type`        | No       | `http`                | Git auth type: `none` or `http`
```

The advertised values (`none`, `http`) are the only accepted values. The `ssh` option that existed in v1 is gone from both the description and the validation guard. The explicit rejection with a clear error message prevents silent failures. Fix is complete.

---

### M8 (Medium): compose-dir scan depth (maxdepth 2) hardcoded, undocumented

**Status: STILL PRESENT**

**Evidence**: `action-v2.sh` line 142:
```bash
done < <(find "${search_dir}" -maxdepth 2 -type f \( \
```

The depth cap remains hardcoded at `maxdepth 2`. There is no `compose-scan-depth` input in `action-v2.yml`. The README (`action-readme-v2.md`) makes no mention of this limitation anywhere — not in the Inputs table, not in the How It Works section, not in any note or caveat.

**Impact**: A user with a directory structure three or more levels deep (e.g. `infra/apps/web/compose.yml`) will get a silent empty result from the scanner and the action will exit with "No compose files found", with no indication that depth is the cause. This is a usability trap that is still completely invisible to the user.

**What is needed to resolve**:
- Option A: Add a `compose-scan-depth` input with a sensible default and document it.
- Option B: Document the two-level limit explicitly in the README and in the `compose-dir` input description in `action-v2.yml`.

---

### M13 (Medium): env-vars + compose-dir combination undocumented

**Status: FIXED**

**Evidence**: `action-readme-v2.md` lines 45-60 show a dedicated "With workflow environment variables" example that combines `compose-dir` and `env-vars` in the same action invocation. The `env-vars` input description in `action-v2.yml` (line 82-84) now explicitly clarifies:

> "Environment variables (KEY=VALUE per line) to export to the GitHub Actions runner via $GITHUB_ENV. These are available to subsequent workflow steps, NOT inside deployed containers."

This unambiguously documents the scope (runner, not container) and the combination is demonstrated. Fix is complete.

---

### L9 (Low): Optional inputs with computed defaults show `default: ''` in action.yml

**Status: STILL PRESENT — PARTIAL IMPROVEMENT**

**Evidence**: `action-v2.yml` lines 37, 40, 47, 57, 84 still carry `default: ''` for inputs whose effective defaults are computed at runtime in the shell:

```yaml
repository-url:
  default: ''          # actual default: https://github.com/${GITHUB_REPOSITORY}.git

repository-name:
  default: ''          # actual default: ${GITHUB_REPOSITORY##*/}

branch:
  default: ''          # actual default: ${GITHUB_REF_NAME:-main}

git-token:
  default: ''          # no computed default; genuinely empty — this one is fine

sync-name-prefix:
  default: ''          # actual default: ${GITHUB_REPOSITORY##*/}
```

The README input table does carry human-readable default descriptions ("GitHub repo HTTPS URL", "GitHub repo name", "Triggering branch") which is an improvement over v1. However, the `action.yml` itself still shows `default: ''` for inputs that have real computed defaults, which is the file tooling reads first. IDEs, schema validators, and the GitHub Marketplace all surface the `action.yml` defaults — a reader who never opens the README or the shell script sees no hint that these inputs have meaningful defaults.

The `git-token` `default: ''` case is genuinely empty and is fine as-is.

**What is needed to resolve**: Use YAML comments in `action.yml` adjacent to the affected inputs to document the computed default inline, e.g.:
```yaml
branch:
  description: 'Branch to sync from. Defaults to the branch that triggered the workflow.'
  required: false
  default: ''   # computed default: $GITHUB_REF_NAME (the triggering branch)
```

This is Low severity; it does not break functionality. It is a documentation clarity gap.

---

## New Findings

### N1 (Medium): `--argjson syncInterval` passes an unquoted shell variable into jq

**File**: `action-v2.sh` lines 253-255, 278-280

**Severity**: Medium

**Description**: The `upsert_sync` function uses `--argjson syncInterval "${SYNC_INTERVAL}"` in both the create and update payloads:

```bash
--argjson syncInterval "${SYNC_INTERVAL}" \
```

`--argjson` tells jq to parse the value as a JSON literal rather than a string. This works correctly when `SYNC_INTERVAL` is a validated positive integer. However, the validation at line 377 only runs in the main flow — it runs before `export_env_vars` and before `discover_compose_files`, but it does run before `upsert_sync` is called. So the risk is effectively mitigated for the standard execution path.

The remaining concern is that if `upsert_sync` is ever called from a different context (refactor, test harness, direct invocation) without passing through main validation, `--argjson` with a non-integer value would produce a jq error mid-payload construction. This is low-risk for the current codebase but worth noting as a fragile coupling between validation placement and function safety.

**Recommendation**: Either re-validate inside `upsert_sync`, or use `--arg syncInterval` with a type cast in the jq expression: `syncInterval: ($syncInterval | tonumber)`. This makes the function self-contained and removes the ordering dependency.

---

### N2 (Low): `compose-dir` description in action.yml does not mention the two-level scan depth

**File**: `action-v2.yml` line 24

**Severity**: Low (supplements M8 which is still present)

**Description**: The `compose-dir` input description reads:

> "Directory to scan for compose files (relative to repo root). Files matching compose.y[a]ml or docker-compose.y[a]ml are auto-discovered."

There is no mention that discovery is limited to two directory levels. This is the same gap identified in M8 but specifically in the machine-readable input description, which IDEs and tooling render on hover. A user will not see the depth limit until they hit it.

---

### N3 (Low): `auto-sync: false` with `sync-interval` set produces no warning

**File**: `action-v2.sh`, `action-v2.yml`

**Severity**: Low

**Description**: If a user sets `auto-sync: false` and also sets `sync-interval: 10`, the `sync-interval` value is still included in the API payload (lines 254, 279) even though auto-sync is disabled. The interval is a meaningless field in that state. There is no warning, no documentation note, and no skip of the field. While this is unlikely to cause a runtime error (the API presumably ignores the value when auto-sync is off), it creates user confusion: setting a sync interval when auto-sync is disabled silently does nothing, and the user has no feedback to know their configuration is contradictory.

**Recommendation**: Either emit a `log_info` warning when both conditions are true, or exclude `syncInterval` from the payload when `AUTO_SYNC` is `false`.

---

## Score

| Finding | v1 Status | v2 Status | Weight |
|---------|-----------|-----------|--------|
| H3: SYNC_INTERVAL unvalidated | Present | FIXED | +12 |
| H4: SSH auth-type unusable | Present | FIXED | +10 |
| M8: maxdepth 2 undocumented | Present | STILL PRESENT | 0 |
| M13: env-vars + compose-dir undocumented | Present | FIXED | +6 |
| L9: computed defaults show `default: ''` | Present | STILL PRESENT (partial) | -2 (partial credit) |
| N1: `--argjson` ordering coupling | New | Medium | -4 |
| N2: compose-dir description missing depth | New | Low | -2 |
| N3: auto-sync=false + sync-interval silent | New | Low | -2 |

**Previous score**: 62  
**Adjustments**: +12 (H3 fixed) +10 (H4 fixed) +6 (M13 fixed) -0 (M8 still present) -0 (L9 partial, no improvement) -4 (N1 new) -2 (N2 new) -2 (N3 new)  
**Net delta**: +20

**Score: 82/100**

---

## Summary

V2 is a meaningful improvement. The two critical-path failures from v1 — unvalidated `SYNC_INTERVAL` causing jq aborts and the unusable `ssh` auth type — are both fixed cleanly. The `env-vars` scoping confusion is resolved in both the description and the README with a dedicated example.

Two findings carry forward: the undocumented `maxdepth 2` scan limit (M8) remains the most user-visible gap, and the computed-default documentation gap (L9) is slightly better in the README but unchanged in the machine-readable `action.yml`. Three new low-to-medium findings were identified, all minor.

The action is now solid enough to merge for most use cases. Resolving M8 before merge is strongly recommended — the silent empty-result behavior when compose files are beyond depth 2 will genuinely surprise users.
