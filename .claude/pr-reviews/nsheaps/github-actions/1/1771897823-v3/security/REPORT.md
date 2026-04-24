# Security Re-Review — Arcane Docker Compose Deploy v3

**PR**: nsheaps/github-actions#1
**Review round**: v3 (re-review after targeted fixes)
**Category**: SECURITY
**Previous score**: 82/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Fixed Findings — Verification

### M2 (Medium): No HTTPS enforcement on arcane-url → FIXED

**Evidence**: `action-v3.sh` lines 388-392:

```bash
if [[ "${ARCANE_URL}" != https://* ]]; then
  log_error "arcane-url must use HTTPS (got '${ARCANE_URL}')"
  exit 1
fi
```

The fix validates the URL scheme before any API calls are made. An accidental `http://` will now fail fast with a clear error message instead of silently transmitting API_KEY and GIT_TOKEN in cleartext.

Additionally, `action-readme-v3.md` line 66 now documents: "Base URL of the Arcane instance (must use HTTPS)".

**Status: FIXED** ✓

---

### N2 (Medium, was Low in v2): AUTO_SYNC not validated as JSON boolean → FIXED

**Evidence**: `action-v3.sh` lines 377-380:

```bash
if [[ "${AUTO_SYNC}" != "true" && "${AUTO_SYNC}" != "false" ]]; then
  log_error "auto-sync must be 'true' or 'false', got '${AUTO_SYNC}'"
  exit 1
fi
```

While primarily a best-practices fix, this has security relevance: `--argjson` with untrusted input is a jq injection vector (albeit low-risk in this context since the value doesn't flow to shell execution). The validation eliminates this vector entirely.

**Status: FIXED** ✓

---

## Remaining Findings — Unchanged from v2

### M3 (Medium): No trap for temp file cleanup on signals

**Status: STILL PRESENT**

**File**: `action-v3.sh:66-98`

The `arcane_api()` function creates temp files via `mktemp` (line 66) and cleans them up on normal return paths. However, there is no `trap` handler for SIGINT/SIGTERM. If the runner kills the process during an API call, temp files containing API responses (which may include sensitive data like repository credentials or sync configurations) persist on disk.

**Expected**: `trap` cleanup at function or script level.
**Actual**: Cleanup only on normal function return.
**Impact**: Residual temp files may contain sensitive API responses. Low probability on GitHub-hosted runners (ephemeral), higher risk on self-hosted runners with persistent filesystems.

---

### N3 (Low): TRIGGER_SYNC string comparison is safe but inconsistent

**Status: STILL PRESENT**

**File**: `action-v3.sh:301`

```bash
if [[ "${TRIGGER_SYNC}" == "true" ]]; then
```

`TRIGGER_SYNC` is compared as a string (safe), unlike `AUTO_SYNC` which was passed to `--argjson` (unsafe without validation). However, `TRIGGER_SYNC` has no input validation — values like `"yes"`, `"1"`, or `"True"` silently result in no sync trigger, with no error message.

**Impact**: User confusion, not a security risk. The pattern is inconsistent with the newly-added AUTO_SYNC validation.

---

## New Observations in v3

### Input Validation Ordering

The validation section (lines 354-392) now follows a logical order:

1. Required inputs (lines 355-357)
2. Mutual exclusivity check (lines 359-362)
3. Conditional requirements — git-token when auth-type=http (lines 365-368)
4. Enum validation — auth-type values (lines 371-374)
5. Boolean validation — auto-sync (lines 377-380)
6. Numeric validation — sync-interval (lines 383-386)
7. URL scheme validation — HTTPS (lines 389-392)

This ordering is correct: validation runs before any API calls or file operations. All secrets are masked at lines 22-23 before any logging. The defense-in-depth pattern is well-established.

### Secret Masking

Lines 22-23 mask API_KEY and GIT_TOKEN immediately:

```bash
[[ -n "${API_KEY}" ]] && echo "::add-mask::${API_KEY}"
[[ -n "${GIT_TOKEN}" ]] && echo "::add-mask::${GIT_TOKEN}"
```

This is correct and unchanged from v2. Both secrets are masked before any `log_info` calls.

---

## Score Calculation

| Finding                       | v2 Status     | v3 Status     | Weight | Change |
| ----------------------------- | ------------- | ------------- | ------ | ------ |
| C1: Secrets not masked        | FIXED (v2)    | Still fixed   | —      | 0      |
| C2: Token in logs             | FIXED (v2)    | Still fixed   | —      | 0      |
| M2: No HTTPS enforcement      | STILL PRESENT | **FIXED**     | —      | +6     |
| M3: No trap cleanup           | STILL PRESENT | Still present | -4     | 0      |
| N2: AUTO_SYNC unvalidated     | STILL PRESENT | **FIXED**     | —      | +2     |
| N3: TRIGGER_SYNC inconsistent | STILL PRESENT | Still present | -1     | 0      |

**Previous score**: 82
**Adjustments**: +6 (M2 fixed) +2 (N2 fixed) = **+8**
**v3 Score: 90/100**

---

## Summary

v3 addresses the two most significant open security findings:

1. **M2 (HTTPS enforcement)**: Credentials are no longer at risk of cleartext transmission. The fix is correctly positioned before any API calls and produces a clear error message.
2. **N2 (AUTO_SYNC validation)**: The jq injection vector via `--argjson` is eliminated.

The remaining findings are low-to-medium severity:

- **M3 (trap cleanup)**: Temp file persistence on signal interruption. Low probability on GitHub-hosted runners. Would require adding a trap handler.
- **N3 (TRIGGER_SYNC)**: Inconsistent validation pattern. Not a security risk, just a UX gap.

**Recommendation**: Merge as-is. The critical and high security risks are fully addressed. M3 is the only remaining medium finding and affects self-hosted runners only. Consider a follow-up PR to add `trap` cleanup for defense-in-depth.
