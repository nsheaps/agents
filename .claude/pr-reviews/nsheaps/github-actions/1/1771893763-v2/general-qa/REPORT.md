# General QA Re-Review: Arcane Docker Compose Deploy v2

**PR**: nsheaps/github-actions#1
**Review ID**: 1771893763-v2
**Category**: General QA
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23
**Previous Score**: 62/100

---

## Summary

This is a re-review after fixes were applied to the v1 findings. Five of the fourteen
previous findings are fully fixed. Four are still present. Five have partial fixes or
remain unchanged. Three new findings are identified.

**Revised Score: 76/100**

Score rationale: The critical masking bug and the two high-severity silent-failure bugs
are resolved. Three medium findings remain open (M5 dedup, M7 empty token, M14 no tests),
two lows remain (L5, L12, L14), and there are three new findings including one medium
(AUTO_SYNC not validated as boolean).

---

## Previous Findings — Status

### C1 (Critical): API key masked after first use

**Status: FIXED**

`action-v2.sh` lines 22–23 mask both `API_KEY` and `GIT_TOKEN` immediately at script top,
before any `log_info` or API call.

```bash
[[ -n "${API_KEY}" ]] && echo "::add-mask::${API_KEY}"
[[ -n "${GIT_TOKEN}" ]] && echo "::add-mask::${GIT_TOKEN}"
```

---

### H2 (High): `|| true` on curl creates silent failure

**Status: FIXED**

`arcane_api()` (lines 70–81) now captures the curl exit code and uses `|| { log_error ...; return 1; }`
instead of `|| true`. An empty `http_code` guard is present at lines 84–88. Transport failures
are no longer swallowed.

---

### H3 (High): SYNC_INTERVAL passed as --argjson without numeric validation

**Status: FIXED**

Lines 377–380 validate `SYNC_INTERVAL` with `^[1-9][0-9]*$` before it reaches `--argjson`.
Non-integer or zero values now produce a clean error and exit.

---

### H7 (High): jq failures on malformed API responses unguarded

**Status: FIXED**

`jq_extract_id()` (lines 104–116) validates both parse success and non-null/non-empty value.
It is called at lines 223 (repository create) and 294 (sync create). The `// empty` pattern
in `ensure_repository` (line 192) cleanly handles absent match without producing literal "null".

---

### M3 (Medium): Temp files not cleaned up on signals (no trap)

**Status: STILL PRESENT**

`arcane_api()` uses `mktemp` (line 66) and cleans up on every normal return path (lines 79, 87,
93–95, 98). However, there is no `trap` at script level or function level to handle SIGINT,
SIGTERM, or unexpected exits mid-curl. If the runner is cancelled while a curl call is in flight,
`${tmp_body}` leaks in `/tmp`.

**File**: `action-v2.sh:66`
**Expected**: `trap 'rm -f "${tmp_body}"' EXIT INT TERM` or equivalent cleanup
**Actual**: cleanup only on normal function return paths

---

### M4 (Medium): sync_name_from_path collisions on multi-level dirs

**Status: STILL PRESENT (partial improvement)**

The fix changed from `basename "${path}"` to `basename "$(dirname "${path}")"`, which correctly
handles one level of nesting. `stacks/myapp/compose.yml` now yields `prefix-myapp` (correct).

However, two files at different deep paths with the same leaf directory name still collide:

```
services/backend/api/compose.yml  ->  prefix-api
services/frontend/api/compose.yml ->  prefix-api   (collision)
```

**File**: `action-v2.sh:162–178`
**Expected**: Full relative path encoded in sync name, or collision detection with error
**Actual**: Only the immediate parent directory name is used; identical leaf names across
different subtrees produce identical sync names

---

### M5 (Medium): No deduplication of compose files

**Status: STILL PRESENT**

Lines 123–148 append both explicit `compose-files` entries and `compose-dir` scan results
to the same `files` array with no deduplication. A user who specifies a file explicitly
AND whose directory scan also finds it will process and upsert it twice in the same run.

**File**: `action-v2.sh:119–156`
**Reproduction**: Set `compose-files: stacks/myapp/compose.yml` and
`compose-dir: stacks`. The file appears twice in `compose_files`.

---

### M6 (Medium): REPOSITORY_ID set to "null" on unexpected API response

**Status: FIXED**

`ensure_repository` (lines 190–194) now explicitly guards `[[ -n "${REPOSITORY_ID}" && "${REPOSITORY_ID}" != "null" ]]`.
The `jq_extract_id` helper on the create path ensures "null" is never silently accepted.

---

### M7 (Medium): auth-type: none still sends empty token in create payload

**Status: STILL PRESENT**

Lines 212–217 build `create_payload` unconditionally including `--arg token "${GIT_TOKEN}"`.
When `AUTH_TYPE` is `none`, `GIT_TOKEN` is empty string, and the payload becomes:

```json
{ "name": "...", "url": "...", "authType": "none", "token": "" }
```

The Arcane API may reject this or silently ignore it, but the intent is clearly to send
no token field at all when `authType` is `none`. The update path (lines 198–207) is
correctly guarded with `if [[ "${AUTH_TYPE}" == "http" && -n "${GIT_TOKEN}" ]]`, making
the inconsistency more visible.

**File**: `action-v2.sh:212–217`
**Expected**: `token` omitted from payload when `AUTH_TYPE` is `none`
**Actual**: `"token":""` always included in create payload

---

### L5 (Low): REPOSITORY_ID as mutable global state

**Status: STILL PRESENT**

`REPOSITORY_ID` is declared as a global on line 27 and mutated by `ensure_repository`.
This is the same pattern as v1. Acceptable for a linear script, but still a risk if the
script is ever refactored to be concurrent or modular. No change from v1.

---

### L12 (Low): existing_syncs stale after first upsert in loop

**Status: STILL PRESENT**

`existing_syncs` is fetched once at line 400 and passed unchanged to every `upsert_sync`
call. A sync created in iteration N is not visible to iterations N+1..N+k. In practice
this only causes a duplicate-create attempt if the same compose path appears more than
once in the list (which M5 can produce). The combination of M5 and L12 can result in
duplicate syncs being created for the same compose file in a single run.

**File**: `action-v2.sh:400, 408`

---

### L14 (Low): GITHUB_WORKSPACE fallback undocumented

**Status: STILL PRESENT**

Line 133 uses `${GITHUB_WORKSPACE:-.}` silently falling back to `.` when
`GITHUB_WORKSPACE` is unset. `action-v2.yml` does not document this variable as a
requirement or document the fallback behavior. Users running the action in non-standard
environments will not know the script falls back to the current working directory.

**File**: `action-v2.sh:133`

---

### M14 (Medium): No tests, no shellcheck

**Status: STILL PRESENT**

No test files are present. `action-v2.yml` does not include a shellcheck or bats step.
The script has grown in complexity (jq_extract_id helper, numeric validation, new guards)
without any automated test coverage to verify these branches work as intended.

Notable untested behaviors:

- `jq_extract_id` returning failure on malformed JSON
- `SYNC_INTERVAL` validation rejecting `0`, `-1`, `abc`
- `M7` token-in-none-auth-create path
- `M5` deduplication absence under combined inputs

---

## New Findings

### N1 (Medium): AUTO_SYNC not validated as JSON boolean

**File**: `action-v2.sh:253, 279`
**Severity**: Medium

`AUTO_SYNC` (default `"true"` from action.yml) is passed as `--argjson autoSync "${AUTO_SYNC}"`.
`--argjson` requires a valid JSON value. If a user passes `yes`, `1`, or `True` (all plausible
boolean-like strings), jq exits with a parse error that is uncaught, aborting the script with
an unhelpful message like `jq: error (at <stdin>:0): Invalid numeric literal`.

`SYNC_INTERVAL` received explicit validation (lines 377–380) in this version; `AUTO_SYNC` did not.

**Expected**: Validation that `AUTO_SYNC` is exactly `true` or `false` before use, consistent with
the treatment of `SYNC_INTERVAL`.
**Reproduction**: Set `auto-sync: yes` in workflow YAML. The script aborts mid-payload-build
with a jq error rather than a clear validation message.

---

### N2 (Low): trigger-sync failure silently suppressed

**File**: `action-v2.sh:303`
**Severity**: Low

```bash
arcane_api POST "/environments/${ENV_ID}/gitops-syncs/${sync_id}/sync" > /dev/null || true
```

The `|| true` here is intentional (sync trigger is non-blocking by design) but the intent is not
documented. A failed trigger — e.g. Arcane returning 500 on the sync endpoint — produces no
log entry. Users will not know the trigger failed.

**Expected**: Log a warning when the trigger returns a non-2xx, even if the script continues.
**Actual**: Silent success; failure is indistinguishable from success in the output.

---

### N3 (Low): GITHUB_ENV and GITHUB_OUTPUT used without existence check

**File**: `action-v2.sh:341, 413–415`
**Severity**: Low

```bash
echo "${key}=${value}" >> "${GITHUB_ENV}"
echo "syncs-created=${SYNCS_CREATED}" >> "${GITHUB_OUTPUT}"
```

Both `GITHUB_ENV` and `GITHUB_OUTPUT` are set by the GitHub Actions runner. If either is
empty (non-GitHub environment, debugging locally, or a runner misconfiguration), `>> ""` is
a no-op that silently discards output without error on most shells, or redirects to the
current directory's blank-named file on others. No guard or warning exists.

**Expected**: Guard or warning when `GITHUB_ENV`/`GITHUB_OUTPUT` are unset, consistent with
how other required variables are validated.

---

## Score Summary

| Category     | v1  | v2     | Delta |
| ------------ | --- | ------ | ----- |
| Critical     | -20 | 0      | +20   |
| High         | -18 | 0      | +18   |
| Medium       | -12 | -8     | +4    |
| Low          | -8  | -6     | +2    |
| New findings | 0   | -6     | -6    |
| **Total**    | 62  | **76** |       |

**Score: 76/100**

The critical and all addressed high findings are resolved cleanly. Remaining blockers for
a clean merge are M5 (dedup), M7 (empty token in none-auth create), and N1 (AUTO_SYNC
boolean validation). M3 (no signal trap) and M14 (no tests) are carry-over debt that
should be tracked as follow-up issues if not fixed before merge.
