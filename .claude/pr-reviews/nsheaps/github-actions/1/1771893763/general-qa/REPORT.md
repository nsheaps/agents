# General Quality Assurance & Engineering Review

**Score**: 62/100

## Summary

This action is a functional first cut that handles the happy path reasonably well: it discovers compose files, upserts repository and sync records against the Arcane API, and produces GitHub Action outputs. The core logic is readable and the use of `jq --arg` for payload construction avoids shell injection in JSON. However, the script has a meaningful cluster of reliability and correctness defects that make it unsuitable for production use without fixes. The most serious issues are: the API key is logged in plaintext before the mask is applied (it appears in the startup banner at line 284 via `log_info "Instance: ${ARCANE_URL}"` — that's fine, but `API_KEY` itself is read at line 307 *after* the banner already ran, leaking the first characters in the runner log via the `::error::` path on failure before the mask is registered), `GITHUB_ENV` is written with raw user-controlled values creating env-injection risk, temp files are not cleaned up on failure paths, `SYNC_INTERVAL` is passed as a string to `--argjson` which will cause `jq` to error if the value is non-numeric, the `http_code` comparison treats an empty string as zero (curl failure gives `|| true` but leaves `http_code` empty), and duplicate compose file paths are not detected — a second identical explicit entry will fire two upserts for the same sync. There are no tests, no shellcheck annotations, and several edge cases around paths with spaces, the `sync_name_from_path` collision logic, and multi-level directory structures are unhandled or subtly wrong.

## Findings

### API key logged before mask is applied
**File**: action.sh:282-307
**Severity**: High
**Description**: The script logs `ARCANE_URL`, `ENV_ID`, `REPO_URL`, and `BRANCH` at lines 282-285 before any validation runs. More critically, if validation fails before line 307 (e.g., `ARCANE_URL` strips to empty), `log_error` prints to stderr and the key has never been masked. Even on the success path, `echo "::add-mask::${API_KEY}"` at line 307 happens *after* all the startup log lines. Any `::error::` emitted before line 307 that accidentally includes the API_KEY value (e.g., via a future logging change) would be unmasked. The mask should be the very first thing the script does, before any logging.
**Expected**: `echo "::add-mask::${API_KEY}"` executed before any `log_info` or `log_error` calls that could reference secrets.
**Actual**: Mask applied at line 307, after ~25 lines of logging and validation that run first.
**Steps to reproduce**: Set `arcane-url` to empty string; the script reaches `log_error "arcane-url is required"` at line 290 while the key is still unmasked.

---

### `GITHUB_ENV` write accepts unsanitized values — env injection risk
**File**: action.sh:275-276, 384
**Severity**: High
**Description**: The `export_env_vars` function writes lines from the user-supplied `env-vars` input directly to `$GITHUB_ENV` with no validation beyond stripping leading/trailing whitespace and skipping comment lines. A malicious or accidental value containing a newline followed by `MY_SECRET=injected` would inject an additional environment variable. GitHub's recommended mitigation is to use the heredoc delimiter format for multi-line values, or to validate that neither key nor value contains newlines. Additionally, the key extraction at line 381 (`local key="${line%%=*}"`) does not validate that the key is a legal environment variable name — a key with spaces or special characters will produce a malformed `GITHUB_ENV` entry.
**Expected**: Keys validated against `[A-Za-z_][A-Za-z0-9_]*`; values checked for embedded newlines before writing; or use of the `{delimiter}` GITHUB_ENV format for multi-line safety.
**Actual**: Raw `key=value` written directly without sanitization.
**Steps to reproduce**: Pass `env-vars` input containing `FOO=bar\nGITHUB_TOKEN=leaked`.

---

### `SYNC_INTERVAL` passed as `--argjson` without numeric validation
**File**: action.sh:203-210, 230-241
**Severity**: High
**Description**: `SYNC_INTERVAL` is passed to `jq` via `--argjson syncInterval "${SYNC_INTERVAL}"`. The `--argjson` flag requires the value to be valid JSON — for an integer input `5` this works, but if the user passes a non-numeric string (e.g., `"five"` or an empty string via a misconfigured workflow), `jq` will exit with a non-zero status, causing the entire action to fail with a cryptic `jq` error rather than an actionable validation message. Because `set -e` is active, this abort happens mid-deploy after the repository may already have been created.
**Expected**: `SYNC_INTERVAL` validated to be a positive integer before first use; or passed as `--arg` and coerced with `tonumber` inside the jq expression.
**Actual**: Passed directly as `--argjson`; any non-numeric value causes `jq` to abort silently mid-operation.
**Steps to reproduce**: Set `sync-interval: "five"` in the workflow; both `upsert_sync` calls will fail with a `jq` compile error.

---

### `http_code` comparison is unsafe when curl fails entirely
**File**: action.sh:47-60
**Severity**: High
**Description**: The curl invocation uses `|| true` at line 53 to suppress exit code failures. If curl exits non-zero (DNS failure, timeout, TLS error, connection refused), `http_code` will be an empty string. The subsequent arithmetic comparison `[[ "${http_code}" -ge 400 ]]` at line 55 silently treats an empty string as `0` in bash arithmetic context — so the function proceeds as if it received a successful response, then `cat "${tmp_body}"` outputs the empty temp file, and the caller receives an empty string. Downstream `jq` calls on empty input will fail with an error, but the failure origin is obscured. The API being down would not produce a useful error message.
**Expected**: After curl, check whether `http_code` is a non-empty numeric string before the comparison; return a clear error if curl failed to connect at all.
**Actual**: Empty `http_code` passes the `>= 400` gate and the function returns empty output silently.
**Steps to reproduce**: Point `arcane-url` at a non-existent host; the curl will fail, `http_code` will be empty, the `[[ "" -ge 400 ]]` comparison returns false (empty treated as 0 < 400), and the function returns empty string without error.

---

### Temp files not cleaned up on error paths
**File**: action.sh:44, 58, 63
**Severity**: Medium
**Description**: `arcane_api` creates a temp file via `mktemp` at line 44. On the error path (line 58) the file is removed before `return 1`, and on the success path (line 63) it is removed before returning. However, if `curl` itself exits non-zero and the `|| true` suppresses the error, or if some other unexpected signal or subshell exit occurs between `mktemp` and `rm -f`, the file is leaked. There is no `trap` to guarantee cleanup. In a long-running deploy with many API calls, leaked temp files accumulate in `/tmp`.
**Expected**: A `trap 'rm -f "${tmp_body}"' EXIT` registered immediately after `mktemp`, or a global cleanup trap on the script.
**Actual**: Manual `rm -f` calls on two known paths; no trap.
**Steps to reproduce**: Kill the runner process mid-curl; temp files remain in `/tmp`.

---

### `sync_name_from_path` produces collisions for multi-level directory structures
**File**: action.sh:111-127
**Severity**: Medium
**Description**: The function only uses the immediate parent directory name as the sync suffix. If compose files exist at `stacks/prod/app/compose.yml` and `stacks/staging/app/compose.yml`, both will produce a sync name of `${prefix}-app`, colliding in Arcane. The `find` scan has `-maxdepth 2`, which means `stacks/prod/compose.yml` (depth 1) and `stacks/staging/compose.yml` (depth 1) would both produce `${prefix}-prod` and `${prefix}-staging` respectively — safe here. But if the user supplies explicit `compose-files` paths deeper than two levels, the naming collision is possible.
**Expected**: Either document the naming limitation clearly and error on detected collisions, or use a path-based name that incorporates more path segments.
**Actual**: Last path segment used unconditionally; no collision detection.
**Steps to reproduce**: Set `compose-files` to `a/app/compose.yml` and `b/app/compose.yml`; both produce `${prefix}-app`.

---

### No deduplication of compose files — duplicate entries cause double-upsert
**File**: action.sh:314-315, 330-336
**Severity**: Medium
**Description**: If both `compose-dir` and `compose-files` are provided, and a file path appears in both, it will be processed twice. Additionally, if the user provides duplicate lines in `compose-files`, both are processed. The second `upsert_sync` call for the same path will match the existing sync (now just created), update it identically, and increment `SYNCS_UPDATED`. This is mostly harmless but produces misleading output counts and triggers redundant syncs.
**Expected**: Deduplicate the `files` array in `discover_compose_files` before returning.
**Actual**: No deduplication; duplicates cause redundant API calls and inflated `SYNCS_UPDATED`.
**Steps to reproduce**: Set `compose-files` to the same path twice; it will be processed twice.

---

### `REPOSITORY_ID` left empty on `jq` null result — silent failure in downstream calls
**File**: action.sh:138-140, 170, 279
**Severity**: Medium
**Description**: If `jq -r '.id'` at line 170 or 279 returns `null` (e.g., the API response doesn't include an `id` field), `REPOSITORY_ID` is set to the string `"null"`. All subsequent API calls that embed `REPOSITORY_ID` in URLs (lines 152, 212, 254, etc.) will use the literal string `null` in the path, generating 404s or creating records keyed on `"null"`. The same risk applies to `new_id` at line 247 and `existing_id` at line 186-189.
**Expected**: Validate that `REPOSITORY_ID`, `new_id`, and `existing_id` are non-empty and non-`"null"` after `jq` extraction; fail with a useful message if the API returned an unexpected shape.
**Actual**: `jq -r '.id'` output assigned directly without validation; string `"null"` treated as a valid ID.
**Steps to reproduce**: Have the Arcane API return `{}` (no `id` field) from the create repository endpoint; `REPOSITORY_ID` becomes `"null"` and all subsequent calls use `/customize/git-repositories/null`.

---

### `auth-type: none` still sends an empty token in the create payload
**File**: action.sh:159-165
**Severity**: Medium
**Description**: When `AUTH_TYPE` is `none`, the repository creation payload still includes `"token": ""`. Depending on the Arcane API, this may be rejected or may unnecessarily expose that token handling is occurring. The `token` field should be omitted from the payload when `AUTH_TYPE` is `none`.
**Expected**: Payload constructed conditionally based on `AUTH_TYPE`; `token` field omitted when `auth-type` is `none`.
**Actual**: Token always included, even as empty string.
**Steps to reproduce**: Set `auth-type: none` and observe the POST body sent to `/customize/git-repositories`.

---

### `GITHUB_WORKSPACE` not set in non-GitHub environments — fallback silently broken
**File**: action.sh:82, 89
**Severity**: Low
**Description**: `${GITHUB_WORKSPACE:-.}` uses the current directory as a fallback when `GITHUB_WORKSPACE` is unset. In a GitHub Actions composite action this variable is always set. However, this fallback behavior is surprising and undocumented — if the action were ever run in a custom shell environment or tested locally without setting `GITHUB_WORKSPACE`, the path computation at line 82 (`"${GITHUB_WORKSPACE:-.}/${COMPOSE_DIR}"`) would resolve to `./${COMPOSE_DIR}`, which may be different from what the user expects.
**Expected**: Either assert `GITHUB_WORKSPACE` is set (since this is a GitHub Action), or document the fallback behavior explicitly.
**Actual**: Silent fallback to `.` with no warning.

---

### No validation that `compose-files` paths are relative
**File**: action.sh:71-77
**Severity**: Low
**Description**: The explicit `compose-files` input accepts any path string. An absolute path (e.g., `/etc/passwd`) or a path with `..` traversal (`../../sensitive/compose.yml`) would be accepted and sent to Arcane as the `composePath` field. While the impact depends on Arcane's own validation, this is a defense-in-depth gap. The `compose-dir`-discovered paths strip the workspace prefix (line 89) but the explicit list does not.
**Expected**: Validate that explicit paths do not begin with `/` and do not contain `..` components.
**Actual**: Paths accepted as-is from user input.

---

### No tests
**File**: action.sh (entire file)
**Severity**: Medium
**Description**: There are no unit tests, no integration test stubs, and no shellcheck configuration in this PR. A script of this complexity (API interaction, file discovery, payload construction, error handling) warrants at minimum a shellcheck run in CI, and ideally bats-core tests for `discover_compose_files`, `sync_name_from_path`, and `export_env_vars`. The CI check workflow referenced in the root README runs security linters but does not appear to include shellcheck or any script tests for new actions.
**Expected**: shellcheck run in CI against action.sh; bats tests for pure-logic functions.
**Actual**: No tests, no shellcheck configuration.

---

### `existing_syncs` fetched once but stale after first upsert creates a new sync
**File**: action.sh:327, 330-336
**Severity**: Low
**Description**: `existing_syncs` is fetched once before the loop at line 327. If multiple compose files are being processed and a sync for file A is newly created, the creation of sync B correctly won't match A's record. However, if a sync is created and then the workflow is re-run before Arcane processes it, the local snapshot of `existing_syncs` may differ from server state in edge cases. This is a minor consistency concern that would only surface under high-concurrency re-runs, not a day-to-day issue — but worth noting.
**Expected**: Either document this as a known limitation (re-runs within milliseconds of a previous run may create duplicates), or re-fetch `existing_syncs` between iterations.
**Actual**: Single fetch before loop; not refreshed.

