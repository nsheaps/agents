# Security Concerns Review

**Score**: 42/100

## Summary

This action has several significant security defects that range from high to critical severity. The most serious issue is that the API key masking call (`::add-mask::`) happens on line 307 — after the API key has already been validated and used in curl calls as early as line 49. While curl does not log request headers by default, any workflow with step debug logging enabled (`ACTIONS_STEP_DEBUG=true`) will expose the key in curl verbose output before the mask is registered. The git token (`GIT_TOKEN`) is never masked at all despite being transmitted in API request bodies. The `ENV_VARS` input writes raw `KEY=VALUE` pairs to `$GITHUB_ENV` without masking values, which means any secrets passed through that mechanism will appear unmasked in subsequent steps' environment dumps. There is no input validation on `auth-type`, which accepts arbitrary strings sent directly to an external API. Temp files created by `mktemp` have no signal-trap cleanup, leaving them on disk if the script is killed. Taken together, the action is not safe for use with real secrets in its current form — a workflow with debug logging enabled would leak both the Arcane API key and any git token on nearly every run.

## Findings

### API Key Masked After First Use
**File**: action.sh:307
**Severity**: Critical
**Description**: `::add-mask::${API_KEY}` is called on line 307, but `API_KEY` is already used in curl at line 49 (inside `arcane_api`). The script calls `arcane_api GET "/customize/git-repositories"` on line 136 and `arcane_api GET "/environments/..."` on line 327, both of which execute before the mask is registered. With `ACTIONS_STEP_DEBUG=true`, curl emits full verbose output including request headers, exposing `X-Api-Key: <value>` in the unmasked log window. GitHub Actions guidance requires masking secrets before any operation that might emit them.
**Expected**: `::add-mask::${API_KEY}` must be called before any curl invocation that transmits the key — ideally as the very first statement in the script.
**Actual**: The mask is registered after multiple API calls have already occurred.
**Steps to reproduce**: Enable `ACTIONS_STEP_DEBUG: true` in the calling workflow. Run the action. Observe the curl verbose output in the step log prior to the mask registration line.

### Git Token Never Masked
**File**: action.sh:14, action.sh:149, action.sh:165
**Severity**: Critical
**Description**: `GIT_TOKEN` is read from input on line 14 but `::add-mask::${GIT_TOKEN}` is never called anywhere in the script. The token is embedded in JSON request bodies (lines 148-150 and 159-165) sent to the Arcane API. With step debug logging, curl verbose output will include the request body containing the token in plaintext. Even without debug logging, the token is logged indirectly through jq-constructed payloads if any intermediate variable is echoed.
**Expected**: `::add-mask::${GIT_TOKEN}` should be called immediately after the token is read from the environment, alongside the API key mask.
**Actual**: No mask registration exists for `GIT_TOKEN`.
**Steps to reproduce**: Enable `ACTIONS_STEP_DEBUG: true`. Provide a `git-token` input. Observe the request body in curl verbose output.

### ENV_VARS Values Written to GITHUB_ENV Without Masking
**File**: action.sh:275
**Severity**: High
**Description**: The `export_env_vars` function (lines 260-278) reads `KEY=VALUE` pairs from `INPUT_ENV_VARS` and writes them directly to `$GITHUB_ENV` via `echo "${key}=${value}" >> "${GITHUB_ENV}"`. While the log line on 274 redacts the value with `***`, the actual value is written unmasked into the environment file. Subsequent workflow steps that print their environment (e.g., `env` command, debug tooling, third-party actions) will expose these values. If users pass secrets through `env-vars`, they will leak.
**Expected**: Each value should be masked with `::add-mask::${value}` before being written to `GITHUB_ENV`, so GitHub's log scrubber redacts it in all downstream output.
**Actual**: Values are written to `GITHUB_ENV` without any masking.
**Steps to reproduce**: Pass `MY_SECRET=supersecret` as `env-vars`. Add a subsequent step that runs `env` or `printenv`. The value `supersecret` appears unredacted.

### No Input Validation on `auth-type`
**File**: action.sh:13, action.sh:146, action.sh:163
**Severity**: Medium
**Description**: `AUTH_TYPE` accepts any arbitrary string from the user input (line 13) with no allowlist validation. It is embedded in a JSON payload sent to the Arcane API on line 163 (`authType: $authType`). While `jq --arg` correctly escapes the value for JSON (preventing JSON injection), an unexpected `authType` value could trigger unintended API behavior on the Arcane server side. The documented valid values are `none`, `http`, and `ssh`. No check enforces this constraint.
**Expected**: Validate `AUTH_TYPE` against an allowlist (`none`, `http`, `ssh`) before use, exiting with an error on unrecognized values.
**Actual**: Any string is accepted and forwarded to the external API.
**Steps to reproduce**: Pass `auth-type: "malicious-value"`. The value is transmitted to the Arcane API without rejection.

### Unvalidated `sync-interval` Input Used as JSON Number
**File**: action.sh:16, action.sh:208, action.sh:239
**Severity**: Medium
**Description**: `SYNC_INTERVAL` is passed as `--argjson syncInterval "${SYNC_INTERVAL}"` to `jq`. The `--argjson` flag requires valid JSON; if `SYNC_INTERVAL` is not a valid number (e.g., `"5; rm -rf /"` or an empty string), `jq` will fail. While `set -euo pipefail` causes the script to exit on failure, the error message from `jq` may echo the malformed value. More critically, there is no validation that the value is a positive integer before use — a value of `0` or `-1` could create pathological polling behavior in Arcane.
**Expected**: Validate that `SYNC_INTERVAL` is a positive integer before use.
**Actual**: The raw input is passed directly to `jq --argjson` without type checking.
**Steps to reproduce**: Pass `sync-interval: "abc"`. The `jq` command fails with an error that echoes the value.

### Temp Files Not Cleaned Up on Signal Interruption
**File**: action.sh:44, action.sh:58, action.sh:63
**Severity**: Medium
**Description**: `mktemp` creates a temp file on line 44 inside `arcane_api`. The file is removed on success (line 63) and on error (line 58). However, no `trap` is registered for signals (`INT`, `TERM`, `EXIT`). If the process is killed between `mktemp` and the `rm -f` call, the temp file remains on the runner's filesystem. Because the temp file holds API response bodies, it could contain sensitive data (repository IDs, sync configurations). On shared/persistent runners this is a concern.
**Expected**: Register a `trap` at the top of the script (or inside `arcane_api`) to clean up temp files on all exit paths, including signals.
**Actual**: Cleanup only happens on the two explicit `rm -f` calls within the normal flow.
**Steps to reproduce**: Kill the action process mid-flight (e.g., cancel the workflow run). Check `/tmp/tmp.*` on the runner for leftover files.

### No HTTPS Enforcement on `arcane-url`
**File**: action.sh:5, action.sh:42, action.sh:47-53
**Severity**: Medium
**Description**: The `ARCANE_URL` input is used directly to construct API endpoints (line 42) without any check that it uses HTTPS. If a user provides an `http://` URL (intentionally or through misconfiguration), the Arcane API key and git token are transmitted in plaintext over the network. curl does not enforce protocol security by default.
**Expected**: Validate that `ARCANE_URL` begins with `https://` and reject the run if it does not. Alternatively, pass `--proto https --proto-redir https` to curl.
**Actual**: HTTP URLs are accepted and credentials are sent over unencrypted connections.
**Steps to reproduce**: Set `arcane-url: "http://arcane.example.com"`. The API key is transmitted in plaintext.

### `compose-files` Input Allows Arbitrary Path Strings Sent to External API
**File**: action.sh:72-77
**Severity**: Low
**Description**: When `COMPOSE_FILES_INPUT` is provided, file paths are read line-by-line without any normalization or path traversal check (lines 72-77). These paths are passed as `composePath` values to the Arcane API (via `jq --arg`, which prevents JSON injection). The files are not read locally — only their path strings are forwarded. However, there is no guard against paths like `../../etc/passwd` or absolute paths being registered with the Arcane server, which could confuse its behavior or constitute a type of server-side path confusion depending on how Arcane processes `composePath`.
**Expected**: Validate that each supplied path is relative (does not start with `/`) and does not contain `..` segments before forwarding to the API.
**Actual**: Arbitrary path strings are accepted and forwarded to the external API without normalization.

### `repository-id` Exposed as Workflow Output
**File**: action.sh:342, action.yml:95-97
**Severity**: Low
**Description**: The Arcane internal repository ID is written to `$GITHUB_OUTPUT` (action.sh:342) and exposed as a public action output (action.yml:95-97). While not a secret, this leaks internal infrastructure identifiers into workflow logs and outputs. If Arcane IDs are guessable or enumerable, this could aid reconnaissance against the Arcane instance.
**Expected**: Consider whether this output is necessary for users. If it is, document that it should be treated as sensitive and not logged.
**Actual**: The ID is freely emitted as a workflow output without any masking or documentation of sensitivity.
