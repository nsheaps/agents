# Best Practices Re-Review — Arcane Docker Compose Deploy v2

**PR**: nsheaps/github-actions#1 v2
**Category**: BEST PRACTICES
**Previous score**: 74/100
**Revised score**: 95/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Previous Findings: Status

### C1 — FIXED
**Previous**: `::add-mask::` called at line 307, after `API_KEY` was already used in curl calls.

**Evidence of fix**: Lines 22–23 of `action-v2.sh`:
```bash
[[ -n "${API_KEY}" ]] && echo "::add-mask::${API_KEY}"
[[ -n "${GIT_TOKEN}" ]] && echo "::add-mask::${GIT_TOKEN}"
```
Both secrets are masked immediately after variable assignment at the top of the script, before any logging, curl, or helper function call. The ordering is correct.

---

### C2 (shared) — FIXED
**Previous**: Git token never masked, embedded in API payloads.

**Evidence of fix**: Line 23 masks `GIT_TOKEN` alongside `API_KEY`. The token is also correctly passed through `jq --arg token` (line 200, line 216) rather than interpolated into shell strings, which is the correct injection-safe pattern.

---

### H2 — FIXED
**Previous**: `|| true` on curl silently swallowed network failures; empty `http_code` caused cascading errors.

**Evidence of fix**: Lines 70–88 of `arcane_api()`:
```bash
http_code=$(curl -s -w "%{http_code}" ... "${url}") || {
  log_error "API ${method} ${path} failed: curl transport error ..."
  rm -f "${tmp_body}"
  return 1
}

if [[ -z "${http_code}" ]]; then
  log_error "API ${method} ${path} failed: no HTTP response code received"
  rm -f "${tmp_body}"
  return 1
fi
```
Transport failures are caught and returned as explicit errors. The empty `http_code` guard is a belt-and-suspenders check. HTTP 4xx/5xx are also handled (lines 90–95). The `|| true` is gone from the main API call path.

---

### H7 — FIXED
**Previous**: `jq` failures on malformed API responses were unguarded; `REPOSITORY_ID` could become the string `"null"`.

**Evidence of fix**: Lines 104–116 introduce `jq_extract_id()`:
```bash
jq_extract_id() {
  local json="$1" filter="$2" context="$3"
  local value
  value=$(echo "${json}" | jq -r "${filter}" 2>/dev/null) || {
    log_error "${context}: failed to parse API response as JSON"
    return 1
  }
  if [[ -z "${value}" || "${value}" == "null" ]]; then
    log_error "${context}: expected a valid ID but got '${value}'"
    return 1
  fi
  echo "${value}"
}
```
This handles: jq parse failure, empty string, and literal `"null"`. Used at lines 223 (`create repository`) and 294 (`create sync`).

---

### H1 (shared) — FIXED
**Previous**: `ENV_VARS` written to `GITHUB_ENV` without masking.

**Evidence of fix**: Lines 326–341 of `export_env_vars()`:
1. Key format validated against `^[A-Za-z_][A-Za-z0-9_]*$` (line 326) — rejects injection via malformed keys
2. Embedded newlines rejected (lines 332–335) — prevents env injection via multiline values
3. `echo "::add-mask::${value}"` (line 338) called **before** `echo "${key}=${value}" >> "${GITHUB_ENV}"` (line 341) — masking happens before the value ever reaches the env file

All three vectors are addressed.

---

### L3 — FIXED
**Previous**: Redundant `auto_sync_val` intermediate variable.

**Evidence of fix**: No `auto_sync_val` variable exists anywhere in v2. `--argjson autoSync "${AUTO_SYNC}"` is used directly in both `upsert_sync` call sites (lines 253 and 279).

---

## New Findings

### N1 — Medium: `|| true` on trigger-sync silently eats all failures, including transport errors
**File**: `action-v2.sh:303`
**Severity**: Medium
**Description**: The trigger-sync call uses `|| true` unconditionally:
```bash
arcane_api POST "/environments/${ENV_ID}/gitops-syncs/${sync_id}/sync" > /dev/null || true
```
`arcane_api` returns non-zero on both transport errors (DNS failure, timeout) AND HTTP 4xx/5xx errors. The `|| true` suppresses both. A DNS failure or a 404 (wrong sync ID) will be logged to stderr by `arcane_api`'s `log_error`, but execution continues silently and the overall action exits 0.

The intent appears to be "a sync trigger failure should not abort the deploy," which is a reasonable policy. However:
1. The policy is not documented — a future maintainer may not realize this is intentional.
2. There is no distinction between "sync was queued but may fail later" (acceptable) and "the API couldn't even be reached" (potentially a sign of a larger problem worth surfacing as a warning).

**Expected**: A comment explaining why sync trigger failures are tolerated, and ideally at minimum a `log_info` on failure rather than silent suppression. Example:
```bash
# Trigger failure is non-fatal: the sync will run on next auto-sync cycle if polling is enabled.
arcane_api POST "..." > /dev/null || log_info "  Sync trigger skipped (non-fatal): see above for details"
```
**Steps to reproduce**: Configure an environment with a valid sync ID but take the Arcane instance offline after upsert. `TRIGGER_SYNC=true`. The action exits 0, `arcane_api` logs a transport error to stderr, but the caller never sees a non-zero exit.

---

### N2 — Low: Repository list-and-match path uses raw `jq -r`, not `jq_extract_id`
**File**: `action-v2.sh:190-194`
**Severity**: Low
**Description**: The `ensure_repository` function finds an existing repository with:
```bash
REPOSITORY_ID=$(echo "${repos}" | jq -r \
  --arg url "${REPO_URL}" \
  '[.[] | select(.url == $url)] | first // empty | .id')
```
If `repos` contains valid JSON but is not an array (e.g., `{"error": "unauthorized"}`), `jq` will return an empty string (not fail), `REPOSITORY_ID` is empty, and the code falls into the create branch — potentially creating a duplicate repository entry on every workflow run.

The `"null"` case is handled by line 194's check. The malformed-but-valid-JSON case is not. This is low probability because `arcane_api` would have already returned an HTTP error for a 401/403 before we get here, but the defense-in-depth pattern established by `jq_extract_id` is not applied consistently.

**Expected**: Either use `jq_extract_id` on the find-by-URL path, or add an `jq -e 'if type == "array" then . else error end'` guard before the select.
**Steps to reproduce**: Mock the `/customize/git-repositories` endpoint to return `{}` instead of `[]`. `REPOSITORY_ID` will be empty, and the create branch runs on every invocation.

---

### N3 — Low: `find` with `-type f` silently skips symlinked compose files
**File**: `action-v2.sh:142`
**Severity**: Low
**Description**:
```bash
find "${search_dir}" -maxdepth 2 -type f \( -name "docker-compose.yml" ... \) -print0
```
`-type f` matches only regular files, not symlinks. If a compose file is a symlink (common in monorepos that share a base compose file), it is silently skipped. No warning is emitted.

**Expected**: Either document the limitation, or use `-type f -o -type l` (or `find -L` to follow symlinks) with a note about the behavior.
**Steps to reproduce**: Create `stacks/app/compose.yml` as a symlink to `../../base/compose.yml`. Run with `compose-dir: stacks`. The file is not discovered, no error is raised, and the action may exit 0 having done nothing for that stack.

---

## Score Breakdown

| Area | v1 | v2 | Delta |
|------|----|----|-------|
| Secret masking (C1, C2) | -12 | 0 | +12 |
| Network/transport error handling (H2) | -5 | 0 | +5 |
| JSON null guard (H7) | -4 | 0 | +4 |
| ENV_VARS injection/masking (H1) | -4 | 0 | +4 |
| Code quality / redundancy (L3) | -1 | 0 | +1 |
| Trigger-sync `\|\| true` undocumented (N1) | 0 | -2 | -2 |
| Repository list jq guard inconsistency (N2) | 0 | -1 | -1 |
| Symlink miss in file discovery (N3) | 0 | -1 | -1 |

**Final score: 95/100**

---

## Summary

All six findings from the v1 review are fixed. The critical secret-masking ordering issue (C1) and the git token masking gap (C2) are both addressed correctly and in the right order. The `|| true` transport failure hole (H2) is plugged with a proper error-propagation pattern. The `jq_extract_id` helper (H7) is clean and used consistently on create paths. The `ENV_VARS` injection vectors (H1) are all addressed — key validation, newline rejection, and pre-write masking.

The three new findings are low-to-medium. N1 (undocumented `|| true` on trigger-sync) is the most worth addressing: the policy is defensible but the silence is not. N2 and N3 are edge cases unlikely to hit in normal use but worth a comment or defensive check.

This is solid work. The fix author clearly read the previous findings carefully and addressed each one.
