# Best Practices Adherence Review

**Score**: 74/100

## Summary

The action.sh script has a strong foundation: `set -euo pipefail` is present, variables are consistently double-quoted, `jq` is used with `--arg`/`--argjson` for safe parameterization, `GITHUB_OUTPUT` and `GITHUB_ENV` are used correctly, `::group::`/`::endgroup::` and `::error::` annotations are applied appropriately, and `::add-mask::` is used for the API key. The curl invocation captures the HTTP status code separately from the response body, which is a solid pattern. The composite action in `action.yml` passes inputs as environment variables in the standard way. However, the score is reduced by several concrete defects: the API key masking fires after output has already begun (not before all output), the `git-token` is never masked at all, the `|| true` suppression on curl creates an unhandled empty-variable arithmetic failure on network errors, and environment variables from the `env-vars` input (which may include secrets) are written to `GITHUB_ENV` without masking. These issues represent a mix of security gaps and reliability problems significant enough to push the score into the low-to-mid 70s.

## Findings

### Masking fires too late — after initial log output has started
**File**: action.sh:307
**Severity**: Medium
**Description**: `::add-mask::${API_KEY}` is called at line 307, after the informational log block at lines 282–286 and after the validation checks at lines 289–304. While the current log lines do not print the API key directly, any future log line added between lines 1 and 307 could leak the key before the mask is registered. The mask should be applied as the first action in the script, before any output.
**Expected**: `::add-mask::${API_KEY}` at the top of the script, before any `echo` or `log_*` call.
**Actual**: Mask is applied at line 307, after approximately 30 lines of output-generating code.

### git-token is never masked
**File**: action.sh:14, action.sh:307
**Severity**: High
**Description**: `GIT_TOKEN` is a secret credential used for HTTP git authentication. It is passed via `INPUT_GIT_TOKEN` into the script but `::add-mask::` is never called for it. If `GIT_TOKEN` appears in any log output — for example, if it is echoed in an error message from `arcane_api` or if debugging is enabled — it will appear in plain text in the Actions log. The API key is masked, but the git token is not.
**Expected**: `echo "::add-mask::${GIT_TOKEN}"` immediately after setting `GIT_TOKEN`, guarded so it only runs when non-empty.
**Actual**: `GIT_TOKEN` is assigned at line 14 and used at lines 150 and 165, with no masking applied anywhere.

### `|| true` on curl creates empty `http_code` on network failure, causing unhandled arithmetic error
**File**: action.sh:47–55
**Severity**: High
**Description**: `curl ... || true` at line 53 suppresses curl's own non-zero exit code. If curl fails due to a network error (DNS failure, timeout, connection refused), `http_code` will be empty. Line 55 then evaluates `[[ "${http_code}" -ge 400 ]]`. The `-ge` operator requires an integer operand; an empty string causes bash to emit `integer expression expected` and exit via `set -e`. The script dies with an opaque arithmetic error rather than a clear "could not reach Arcane API" message. The `|| true` was presumably intended to allow HTTP 4xx responses to reach the error-handling path, but it also swallows genuine transport failures.
**Expected**: Distinguish between curl transport failures (non-zero exit, empty `http_code`) and HTTP-level failures (4xx/5xx). A guard like `[[ -z "${http_code}" ]] && { log_error "curl failed"; return 1; }` should precede the HTTP status check.
**Actual**: An empty `http_code` reaches the `-ge` comparison and crashes with a misleading error.

### env-vars written to GITHUB_ENV without masking
**File**: action.sh:275
**Severity**: Medium
**Description**: The `export_env_vars` function reads `KEY=VALUE` pairs and appends them to `GITHUB_ENV`. The log line at 274 redacts values with `***`, but the actual values are written to `GITHUB_ENV` unmasked. Any subsequent workflow step that reads or echoes these variables will expose their values in the Actions log. If callers use `env-vars` for secrets (tokens, passwords), those secrets will leak. The function should call `echo "::add-mask::${value}"` for each value before writing it to `GITHUB_ENV`.
**Expected**: Each value is masked before being exported: `echo "::add-mask::${value}"` then `echo "${key}=${value}" >> "${GITHUB_ENV}"`.
**Actual**: Values are written to `GITHUB_ENV` at line 275 without a preceding `::add-mask::` call.

### jq failures on malformed API responses are unguarded
**File**: action.sh:138, action.sh:170, action.sh:186–189, action.sh:247
**Severity**: Medium
**Description**: Every `jq` invocation that extracts `.id` or matches records assumes the API response is a well-formed JSON array or object. If the Arcane API returns an error body (e.g., HTML, plain text, or a non-array JSON object) due to a misconfiguration or server error, jq will fail with a parse error and exit via `set -e`. There is no `jq ... // empty` guard at the top level, no `if ! result=$(... | jq -e ...); then` error handler, and no check that the response is valid JSON before extracting fields. The script relies entirely on `arcane_api` returning only valid JSON, which is an assumption that will not hold in all error scenarios.
**Expected**: Validate jq output before use; use `jq -e` and check the exit code, or wrap jq calls in error-handling logic that produces a clear error message.
**Actual**: Raw jq output is captured into variables without validation; a bad API response will cause an obscure jq exit or an empty-variable reference downstream.

### Redundant auto_sync_val conversion
**File**: action.sh:191–192
**Severity**: Low
**Description**: `auto_sync_val` is assigned by comparing `${AUTO_SYNC}` to the string `"true"` and then setting it to either `"false"` or `"true"`. Since `${AUTO_SYNC}` is already constrained to `"true"` or `"false"` by the `action.yml` input default and the GitHub Actions expression system, the conversion at lines 191–192 is logically a no-op. It adds noise and creates a subtle discrepancy: if a caller passes `"True"` or `"1"`, `auto_sync_val` will be `"false"` instead of the expected `"true"`. The value should be passed through directly or normalized more defensively.
**Expected**: Either pass `${AUTO_SYNC}` directly to `--argjson autoSync`, after normalizing to lowercase, or validate the value at the top of the script.
**Actual**: Lines 191–192 perform an identity-like conversion that silently coerces unexpected values to `false`.

### Composite action missing `env-vars` input in README security guidance
**File**: action-README.md:56–60
**Severity**: Low
**Description**: The README example for `env-vars` shows plaintext values (`DOMAIN=example.com`, `NETWORK=traefik`, `TZ=America/New_York`). There is no guidance that secret values should come from `${{ secrets.* }}` interpolation rather than hardcoded strings, and no warning that values written via this input are exported to the entire workflow's `GITHUB_ENV` (making them available to all subsequent steps, including potentially untrusted third-party actions). Given that the masking gap noted above means these values are not protected, users need explicit guidance to avoid placing secrets here.
**Expected**: A security note in the `env-vars` documentation warning that values are exported to `GITHUB_ENV` unmasked and that secrets should not be passed through this input without understanding the exposure.
**Actual**: Example shows benign values with no security caveat.

### Composite action does not set `working-directory` for the shell step
**File**: action.yml:102–105
**Severity**: Low
**Description**: The `run` step at line 105 executes `action.sh` relative to `github.action_path`. If `GITHUB_WORKSPACE` is not set (unusual but possible in test/local environments), the file discovery at line 82 falls back to `.` (the current working directory), which may not be the repo root. This is documented behavior but not explicitly guarded. Not a defect in standard GitHub Actions runs, but a fragility worth noting.
**Expected**: Either assert `GITHUB_WORKSPACE` is set before use, or document the fallback behavior clearly.
**Actual**: Silent fallback to `.` at line 82 with no log warning.
