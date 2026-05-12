# General QA Re-Review: Arcane Docker Compose Deploy v3

**PR**: nsheaps/github-actions#1
**Review ID**: 1771897823-v3
**Category**: General QA
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23
**Previous Score**: 76/100

---

## Summary

This is the v3 re-review after targeted fixes to N1 (AUTO_SYNC validation). One finding is fully resolved. The remaining 13 findings from v2 persist unchanged. No regressions detected.

**Revised Score: 80/100**

Score rationale: N1 is now fixed with explicit validation at lines 376-380. This removes one medium-severity finding (+4 points from 76/100 baseline). However, five medium-severity findings remain open (M3, M4, M5, M7, M14), plus three lows (L5, L12, L14). The accumulation of medium findings prevents the score from rising above 82, as general QA scoring reflects both breadth (how many categories have issues) and depth (how many issues per category) of remaining problems.

---

## N1 Finding — Status Update

### N1 (Medium): AUTO_SYNC not validated as JSON boolean

**Status: FIXED**

**File**: `action.sh:376-380`

The v3 source now includes explicit validation:

```bash
# Validate auto-sync is a boolean (required for jq --argjson)
if [[ "${AUTO_SYNC}" != "true" && "${AUTO_SYNC}" != "false" ]]; then
  log_error "auto-sync must be 'true' or 'false', got '${AUTO_SYNC}'"
  exit 1
fi
```

This validation is positioned BEFORE the first use of AUTO_SYNC with `--argjson` at line 253. The fix prevents invalid values ("yes", "1", "True", etc.) from reaching jq, which would abort with a parse error. The error message is clear and user-actionable. **N1 is resolved.**

---

## Remaining Findings — Unchanged from v2

All findings listed below remain present in v3 with no changes detected.

### M3 (Medium): Temp files not cleaned up on signals (no trap)

**Status: STILL PRESENT**

**File**: `action.sh:66`

The `arcane_api()` function uses `mktemp` at line 66 and cleans up via `rm -f "${tmp_body}"` on all normal return paths (lines 79, 87, 93-95, 98). However, there is no signal handler (`trap`) to clean up if the script is cancelled via SIGINT or SIGTERM, or if the runner kills the process unexpectedly.

**Expected**: `trap 'rm -f "${tmp_body}"' EXIT INT TERM` or equivalent cleanup at script or function level.
**Actual**: Cleanup only on normal function return paths.
**Impact**: Long-running API calls that are interrupted will leak temp files.

---

### M4 (Medium): sync_name_from_path collisions on multi-level dirs

**Status: STILL PRESENT**

**File**: `action.sh:162-178`

The function derives a sync name from a compose file path:

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

The logic extracts only the immediate parent directory name via `basename "${dir}"`. This correctly handles one level of nesting but fails on deeper paths with identical leaf directory names:

```
services/backend/api/compose.yml  →  prefix-api
services/frontend/api/compose.yml →  prefix-api  (collision)
```

Both paths collide to the same sync name despite being in different subtrees.

**Expected**: Full relative path encoded in sync name, or collision detection with error.
**Actual**: Only the immediate parent directory name is used.
**Reproduction**: Create two compose files in different deep paths with the same leaf directory name. Both will produce identical sync names.
**Impact**: The second sync will overwrite or conflict with the first.

---

### M5 (Medium): No deduplication of compose files

**Status: STILL PRESENT**

**File**: `action.sh:119-156`

The `discover_compose_files()` function appends files from two sources to the same array without checking for duplicates:

```bash
discover_compose_files() {
  local files=()

  # From explicit list
  if [[ -n "${COMPOSE_FILES_INPUT}" ]]; then
    while IFS= read -r file; do
      file="$(trim "${file}")"
      [[ -z "${file}" ]] && continue
      files+=("${file}")
    done <<< "${COMPOSE_FILES_INPUT}"
  fi

  # From directory scan
  if [[ -n "${COMPOSE_DIR}" ]]; then
    # ... scan and append ...
    while IFS= read -r -d '' file; do
      local rel_path="${file#"${GITHUB_WORKSPACE:-.}/"}"
      files+=("${rel_path}")
    done < <(find ... -print0 | sort -z)
  fi

  printf '%s\n' "${files[@]}"
}
```

A file specified explicitly in `compose-files` that is also discovered by the directory scan will appear twice in the returned list and be processed twice.

**Expected**: Deduplication before returning the file list.
**Actual**: Both explicit and discovered files are appended without checking for duplicates.
**Reproduction**: Set `compose-files: stacks/myapp/compose.yml` and `compose-dir: stacks`. The file appears twice in the final list.
**Impact**: The same compose file is upserted twice in a single run.

---

### M7 (Medium): auth-type: none still sends empty token in create payload

**Status: STILL PRESENT**

**File**: `action.sh:212-217`

When creating a repository, the code builds a payload unconditionally including the token:

```bash
local create_payload
create_payload=$(jq -n \
  --arg name "${REPO_NAME}" \
  --arg url "${REPO_URL}" \
  --arg authType "${AUTH_TYPE}" \
  --arg token "${GIT_TOKEN}" \
  '{name: $name, url: $url, authType: $authType, token: $token}')
```

When `AUTH_TYPE` is `none`, `GIT_TOKEN` is an empty string, resulting in:

```json
{ "name": "...", "url": "...", "authType": "none", "token": "" }
```

The update path (lines 198-207) correctly guards this with `if [[ "${AUTH_TYPE}" == "http" && -n "${GIT_TOKEN}" ]]`, but the create path does not.

**Expected**: Omit the `token` field entirely when `authType` is `none`, not include `"token":""`.
**Actual**: Token field always included, with empty string when AUTH_TYPE is none.
**Impact**: The Arcane API may reject the payload or silently ignore it. Either way, the inconsistency between create and update paths is a defect.

---

### M14 (Medium): No tests, no shellcheck

**Status: STILL PRESENT**

**File**: `action.sh` (entire script)

No test files are present in the PR. The GitHub Actions workflow does not include a shellcheck or bats step. The script now includes several guard clauses and conditional paths that are not covered by automated tests:

- `jq_extract_id` returning failure on malformed JSON (lines 104-116)
- `SYNC_INTERVAL` validation rejecting `0`, `-1`, `abc` (lines 382-386)
- `AUTO_SYNC` validation rejecting non-boolean values (lines 376-380) — newly added in v3
- `M7` token-in-none-auth-create path (lines 212-217)
- `M5` deduplication absence under combined inputs (lines 119-156)

**Expected**: Test suite covering validation, error paths, and conditional logic.
**Actual**: No automated tests.
**Impact**: New fixes (like N1) cannot be verified to work correctly. Regressions may be introduced in future versions without detection.

---

### L5 (Low): REPOSITORY_ID as mutable global state

**Status: STILL PRESENT**

**File**: `action.sh:27`

`REPOSITORY_ID` is declared as a global variable and mutated by `ensure_repository()`. While acceptable for a linear script, this pattern introduces risk if the script is ever refactored for modularity or concurrency.

**Expected**: Consider using local variables or return values instead of globals.
**Actual**: `REPOSITORY_ID=""` at line 27, mutated at line 223.

---

### L12 (Low): existing_syncs stale after first upsert in loop

**Status: STILL PRESENT**

**File**: `action.sh:400, 408, 412, 420`

`existing_syncs` is fetched once at line 412 and passed unchanged to every `upsert_sync()` call in the loop (line 420). A sync created in iteration N is not visible to iterations N+1 onwards. In practice, this only causes issues when the same compose path appears multiple times (which M5 can produce), resulting in duplicate-create attempts.

**Expected**: Refresh `existing_syncs` after each successful upsert, or maintain an in-memory index of newly created syncs.
**Actual**: Syncs created in the loop are not visible to subsequent iterations.
**Impact**: Combined with M5, can result in duplicate syncs.

---

### L14 (Low): GITHUB_WORKSPACE fallback undocumented

**Status: STILL PRESENT**

**File**: `action.sh:133`

The script uses `${GITHUB_WORKSPACE:-.}` silently falling back to `.` when `GITHUB_WORKSPACE` is unset:

```bash
local search_dir="${GITHUB_WORKSPACE:-.}/${COMPOSE_DIR}"
```

The action's YAML file does not document this variable as a requirement or document the fallback behavior.

**Expected**: Document in action.yml that GITHUB_WORKSPACE is used and that it defaults to the current working directory if unset.
**Actual**: Silent fallback, undocumented in the action specification.
**Impact**: Users running the action in non-standard environments will not know the script falls back to cwd.

---

### N2 (Low): trigger-sync failure silently suppressed

**Status: STILL PRESENT**

**File**: `action.sh:303`

```bash
arcane_api POST "/environments/${ENV_ID}/gitops-syncs/${sync_id}/sync" > /dev/null || true
```

The `|| true` is intentional (sync trigger is non-blocking by design), but the absence of a warning log means that failed triggers produce no output. Users cannot distinguish success from failure.

**Expected**: Log a warning when trigger returns non-2xx, even if the script continues.
**Actual**: Silent success/failure indistinguishable in output.

---

### N3 (Low): GITHUB_ENV and GITHUB_OUTPUT used without existence check

**Status: STILL PRESENT**

**File**: `action.sh:341, 425-427`

```bash
echo "${key}=${value}" >> "${GITHUB_ENV}"
echo "syncs-created=${SYNCS_CREATED}" >> "${GITHUB_OUTPUT}"
echo "syncs-updated=${SYNCS_UPDATED}" >> "${GITHUB_OUTPUT}"
echo "repository-id=${REPOSITORY_ID}" >> "${GITHUB_OUTPUT}"
```

Both `GITHUB_ENV` and `GITHUB_OUTPUT` are set by the GitHub Actions runner. If either is empty (non-GitHub environment, local debugging, runner misconfiguration), the redirection silently fails or creates blank-named files. No guard exists.

**Expected**: Check that `GITHUB_ENV` and `GITHUB_OUTPUT` are non-empty before using them, consistent with how other required variables are validated.
**Actual**: Unconditional use without existence check.

---

## Score Summary

| Category     | v2  | v3     | Delta |
| ------------ | --- | ------ | ----- |
| Critical     | 0   | 0      | 0     |
| High         | 0   | 0      | 0     |
| Medium       | -8  | -4     | +4    |
| Low          | -6  | -6     | 0     |
| New findings | -6  | 0      | +6    |
| **Total**    | 76  | **80** | +4    |

**Score: 80/100**

---

## Conclusions

The N1 fix (AUTO_SYNC validation) is implemented correctly and effectively prevents jq parse errors. The validation is positioned before use and produces a clear, actionable error message.

However, the score ceiling remains at 80 due to the accumulation of five medium-severity findings (M3, M4, M5, M7, M14). General QA assesses the entire codebase holistically — a single script with five medium defects cannot score above 82 regardless of how well individual fixes are implemented.

Recommendations for the next iteration:

1. **M7** (empty token in none-auth create) is a quick fix: add conditional token inclusion matching the update path.
2. **M5** (dedup) can be fixed by converting the files array to a unique set before returning.
3. **M14** (no tests) requires creating a test suite; this is higher effort but critical for confidence.
4. **M3** and **M4** are moderate effort and should be prioritized if targeting a score above 85.

Until these findings are addressed, the script will remain in the 78-82 point range despite individual fixes being clean and correct.
