# Security Review — Arcane Docker Compose Deploy v2 (Re-review)

**PR**: nsheaps/github-actions#1  
**Reviewer**: Daffy D (qa)  
**Date**: 2026-02-23  
**Previous Score**: 42/100  
**This Score**: 82/100

---

## Previous Findings Status

| ID  | Severity | Finding                                                                                  | Status                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------- | ---------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Critical | API key masked after first use (`::add-mask::` at line 307, key used in curl at line 49) | **FIXED**               | `action-v2.sh` lines 22-23: both `API_KEY` and `GIT_TOKEN` are masked immediately at script start, before any logging or API calls.                                                                                                                                                                                                                                                                              |
| C2  | Critical | `GIT_TOKEN` never masked — embedded in API payloads without masking                      | **FIXED**               | `action-v2.sh` line 23: `[[ -n "${GIT_TOKEN}" ]] && echo "::add-mask::${GIT_TOKEN}"` — masked at top of script before any use. `jq -n --arg token` construction at lines 200, 212-217 passes value via jq argument, not shell interpolation into a string that appears in logs.                                                                                                                                  |
| H1  | High     | `ENV_VARS` written to `GITHUB_ENV` without masking — secrets leak to downstream steps    | **FIXED**               | `action-v2.sh` lines 325-342: key format validated with regex, embedded newlines rejected, and `::add-mask::${value}` emitted before writing to `GITHUB_ENV`.                                                                                                                                                                                                                                                    |
| M1  | Medium   | No `auth-type` input validation                                                          | **FIXED**               | `action-v2.sh` lines 371-374: explicit allowlist check — rejects anything other than `none` or `http`, exits with error.                                                                                                                                                                                                                                                                                         |
| M2  | Medium   | No HTTPS enforcement on `arcane-url`                                                     | **STILL PRESENT**       | No URL scheme check exists anywhere in `action-v2.sh`. A caller can pass `http://...` and credentials will be transmitted in cleartext. The `ARCANE_URL` variable is used directly at line 64 without validation.                                                                                                                                                                                                |
| M3  | Medium   | Temp files not cleaned up on signal (`SIGINT`, `SIGTERM`)                                | **STILL PRESENT**       | `arcane_api` creates `tmp_body=$(mktemp)` at line 66 and cleans up on normal and error paths (lines 79, 88, 93, 98), but there is no `trap` registered for signal termination. If the script is killed mid-`curl`, `tmp_body` is orphaned.                                                                                                                                                                       |
| L6  | Low      | `compose-files` allows arbitrary path strings                                            | **PARTIALLY ADDRESSED** | The directory scan path (`compose-dir`) is now validated to exist at line 134. However, explicit paths in `compose-files` (lines 123-129) are still accepted verbatim with no existence check or path-traversal guard. Paths like `../../etc/passwd` are structurally accepted. The risk is low because these paths are only sent to the Arcane API as strings, not opened locally, but they remain unvalidated. |
| L7  | Low      | `repository-id` exposed as workflow output                                               | **STILL PRESENT**       | `action-v2.sh` line 415: `echo "repository-id=${REPOSITORY_ID}" >> "${GITHUB_OUTPUT}"`. `action-v2.yml` lines 95-97 surfaces this as a named output. This is an internal Arcane ID, not a credential, but it remains exposed. Severity unchanged — this is a low finding and acceptable if the ID has no standalone auth value.                                                                                  |

---

## New Findings

### N1 — Medium: `ARCANE_URL` not validated for HTTPS (same as M2, now clearly the only remaining medium)

Already captured as M2 above.

### N2 — Low: `auto-sync` boolean not validated before passing to `--argjson`

**File**: `action-v2.sh` lines 253, 280  
**Severity**: Low  
**Description**: `AUTO_SYNC` is passed as `--argjson autoSync "${AUTO_SYNC}"` to `jq`. If `AUTO_SYNC` contains anything other than `true` or `false` (e.g., `"yes"`, `1`, or an injection string), `jq` will either error out or produce unexpected JSON. There is no validation that `AUTO_SYNC` is strictly `true` or `false` before use.  
**Expected**: Validate `AUTO_SYNC` is `true` or `false` before the `jq` call, similar to `SYNC_INTERVAL` validation at line 377.  
**Actual**: Any string from `INPUT_AUTO_SYNC` flows through unchecked.  
**Reproduction**: Set `auto-sync: "yes"` in the workflow YAML. `jq` will exit with error `Invalid numeric literal at EOF` and the script will fail at runtime instead of at input validation time.

### N3 — Low: `TRIGGER_SYNC` not validated

**File**: `action-v2.sh` line 301  
**Severity**: Low  
**Description**: `TRIGGER_SYNC` is compared only with `== "true"` at line 301. If the caller passes an unexpected value, the sync is silently skipped with no warning — not a security issue, but a behavioral correctness gap. Consistent with N2, a validation step would make the failure explicit.

---

## Summary Assessment

The three Critical and one High findings from v1 are all fixed. The masking ordering problem (C1, C2) is properly resolved — secrets are masked at the very top of the script before any logging or API calls. The `ENV_VARS` leak (H1) is resolved with key format validation, newline rejection, and masking before write.

Two Medium findings remain open: HTTPS enforcement (M2) and signal-based temp file cleanup (M3). M2 is the more significant of the two — an operator who accidentally configures an HTTP endpoint will transmit their API key and git token in cleartext.

The score is held below 85 because M2 (HTTPS enforcement) is a medium-severity finding that is substantively absent rather than partially addressed. A complete fix would require one line of validation near line 355 in `action-v2.sh`.

**Recommended actions before merge:**

1. Add HTTPS scheme validation on `ARCANE_URL` (fixes M2, would likely push score to 88+).
2. Register a `trap` for `SIGINT`/`SIGTERM` in `arcane_api` or at script level to clean temp files (fixes M3).
3. Optional: add `auto-sync` boolean validation for consistency with other input guards.
