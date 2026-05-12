# Simplicity Re-Review — Arcane Docker Compose Deploy v3

**PR**: nsheaps/github-actions#1
**Review round**: v3 (re-review after targeted fixes)
**Category**: SIMPLICITY
**Previous score**: 82/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Fixed Findings — Verification

### N1 (Medium): AUTO_SYNC not validated before --argjson → FIXED

**Evidence**: `action-v3.sh` lines 377-380:

```bash
if [[ "${AUTO_SYNC}" != "true" && "${AUTO_SYNC}" != "false" ]]; then
  log_error "auto-sync must be 'true' or 'false', got '${AUTO_SYNC}'"
  exit 1
fi
```

The validation is clear, concise (3 lines + comment), and follows the same pattern as the existing SYNC_INTERVAL validation (lines 383-386) and auth-type validation (lines 371-374). The error message is explicit about what values are accepted.

**Simplicity assessment**: The fix adds minimal complexity (4 lines including comment) while preventing a class of cryptic jq errors. This is a net simplicity improvement — replacing a hidden failure mode with a clear, early rejection.

**Status: FIXED** ✓

---

## Remaining Findings — Unchanged from v2

### M4 (Medium): sync_name_from_path collisions on multi-level directories

**Status: STILL PRESENT**

**File**: `action-v3.sh:162-179`

```bash
sync_name_from_path() {
  local path="$1"
  local dir
  dir=$(dirname "${path}")
  local name
  if [[ "${dir}" == "." ]]; then
    name="${SYNC_NAME_PREFIX}"
  else
    name=$(basename "${dir}")
    if [[ "${name}" != "${SYNC_NAME_PREFIX}" ]]; then
      name="${SYNC_NAME_PREFIX}-${name}"
    fi
  fi
  echo "${name}"
}
```

The function uses only the immediate parent directory name (`basename`) to derive sync names. This creates collisions when different subtrees share leaf directory names:

```
stacks/backend/api/compose.yml  →  prefix-api
stacks/frontend/api/compose.yml →  prefix-api  (collision!)
```

The simplicity concern is that the function's behavior is **deceptively simple** — it looks correct for single-level nesting but silently produces wrong results for deeper structures. The `maxdepth 2` scan limit (line 142) reduces but does not eliminate this risk.

**Impact**: Collision overwrites one sync with another, potentially deploying the wrong stack.
**Recommendation**: Either encode the full relative path in the sync name, or detect collisions and error out.

---

## New Observations in v3

### Validation Section Consistency

The validation section (lines 354-392) now follows a consistent pattern:

```bash
# 1. Required inputs
require_input "arcane-url" "${ARCANE_URL}"
require_input "arcane-api-key" "${API_KEY}"
require_input "environment-id" "${ENV_ID}"

# 2. Mutual exclusivity
if [[ -z "${COMPOSE_DIR}" && -z "${COMPOSE_FILES_INPUT}" ]]; then ...

# 3. Conditional requirements
if [[ "${AUTH_TYPE}" == "http" && -z "${GIT_TOKEN}" ]]; then ...

# 4. Enum validation
if [[ "${AUTH_TYPE}" != "none" && "${AUTH_TYPE}" != "http" ]]; then ...

# 5. Boolean validation (NEW in v3)
if [[ "${AUTO_SYNC}" != "true" && "${AUTO_SYNC}" != "false" ]]; then ...

# 6. Numeric validation
if [[ ! "${SYNC_INTERVAL}" =~ ^[1-9][0-9]*$ ]]; then ...

# 7. URL scheme validation (NEW in v3)
if [[ "${ARCANE_URL}" != https://* ]]; then ...
```

This is well-organized. Each validation is self-contained, uses the same `log_error` + `exit 1` pattern, and is clearly separated by comments. The new additions (items 5 and 7) fit naturally into the existing structure without increasing cognitive complexity.

### Script Length

The script is now 430 lines (up from ~420 in v2). The 10-line increase comes from the two new validation blocks. This is acceptable — the script remains under 500 lines, and the added validation reduces net complexity by preventing hidden failure modes.

---

## Score Calculation

| Finding                       | v2 Status     | v3 Status     | Weight     | Change      |
| ----------------------------- | ------------- | ------------- | ---------- | ----------- | --- | --- |
| M12: Trigger-sync duplication | FIXED (v2)    | Still fixed   | —          | 0           |
| L3: Bare log_info strings     | FIXED (v2)    | Still fixed   | —          | 0           |
| L4: redundant                 |               | true          | FIXED (v2) | Still fixed | —   | 0   |
| M4: sync_name collisions      | STILL PRESENT | Still present | -6         | 0           |
| N1: AUTO_SYNC unvalidated     | STILL PRESENT | **FIXED**     | —          | +4          |

**Previous score**: 82
**Adjustments**: +4 (N1 fixed)
**v3 Score: 86/100**

---

## Summary

v3 fixes the one targeted simplicity finding (N1: AUTO_SYNC validation) cleanly and consistently. The fix follows established patterns and adds minimal complexity.

The remaining medium finding (M4: sync_name collisions) is a genuine design issue that requires more thought to address — it's not a simple fix. The current `basename`-only approach is deceptively simple and can produce silent collisions for multi-level directory structures.

**Recommendation**: Merge as-is. The AUTO_SYNC fix is correct and minimal. M4 should be tracked as a known limitation and addressed in a follow-up PR if users report multi-level directory structures.

**Remaining risk**: M4 is the only finding keeping this category below 90. A collision detection guard (5-10 lines) would push the score to ~92.
