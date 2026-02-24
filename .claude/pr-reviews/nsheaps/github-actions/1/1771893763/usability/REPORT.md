# Usability Review

**Score**: 72/100

## Summary

The action is generally approachable for a new user who already understands Arcane's concepts. The README provides two clear copy-paste examples covering the two main usage patterns, defaults are well chosen (branch auto-detected, URL auto-derived, token credential refresh on re-runs), and the GitHub Actions log output is structured with collapsible groups and masked secrets. What holds the score back are a cluster of issues that will bite first-time adopters before they get past setup: `git-token` is listed as optional in both the README table and `action.yml` but is silently required in the `http` (default) auth flow — the script does not validate this and will produce a confusing API error rather than a clear message. The `environment-id` input accepts an arbitrary string and the only hint of what it looks like is `'1'` in the examples; there is no pointer to where a user finds this value in the Arcane UI. The `env-vars` input name and description imply it sets environment variables for the deployed containers, but it actually exports them into the GitHub Actions runner environment (`$GITHUB_ENV`), which is a significant mismatch between what the name implies and what the feature does. Sync naming is derived from directory structure in a non-obvious way that is only documented in one line at the bottom of the README, and there is no output or log entry showing users what sync names were assigned until they have already run the action. The `sync-interval` input has no documented unit constraints or validation — a user passing `"30 minutes"` or `0` will silently produce broken API payloads. These are all pre-flight friction points that a first-time user will hit, and none produce actionable error messages pointing back to the docs.

## Findings

### `git-token` is silently required when `auth-type` is `http` (the default)

**File**: `action.yml:55-57` / `action-README.md:75`
**Severity**: High
**Description**: `auth-type` defaults to `http` and `git-token` is listed as optional with an empty default. The script does not validate that `git-token` is set when `auth-type=http`. A new user who omits `git-token` will get a cryptic Arcane API error when `ensure_repository` tries to create or update the repository with an empty token, with no message pointing them to the missing input. The README usage examples all include `git-token`, but the contract stated by `action.yml` and the input table does not enforce it.
**Expected**: Either validate the combination at startup (`if [[ "${AUTH_TYPE}" == "http" && -z "${GIT_TOKEN}" ]]; then log_error ...`) or update the description to say "Required when auth-type is http (the default)".
**Actual**: No validation. Empty token is passed silently to the API.

### `environment-id` has no guidance on where to find it

**File**: `action.yml:18-19` / `action-README.md:67`
**Severity**: Medium
**Description**: The description is "Arcane environment ID to deploy to" with no hint of format (numeric string? UUID?) or where to locate it in the Arcane UI. The README example uses `'1'`, suggesting a numeric ID, but nothing tells a user where to find this value. A first-time user will need to leave the action docs and hunt through the Arcane interface.
**Expected**: Description should say something like "Arcane environment ID (found in Settings > Environments, or in the URL when viewing an environment)".
**Actual**: One-line description with no actionable guidance.

### `env-vars` name and description imply container environment variables; it actually sets runner environment variables

**File**: `action.yml:81-84` / `action.sh:260-278` / `action-README.md:80`
**Severity**: High
**Description**: The input is named `env-vars` and the README table says "Shared env vars (KEY=VALUE per line) for the workflow." The implementation writes these values to `$GITHUB_ENV`, which makes them available as environment variables in subsequent GitHub Actions steps — not inside the deployed containers. However, the README example in the "With shared environment variables" section shows values like `DOMAIN=example.com`, `NETWORK=traefik`, and `TZ=America/New_York`, which are typical Docker container/compose variables. A new user will almost certainly expect these to be injected into their containers and be confused when they are not.
**Expected**: The description should clearly state this sets variables in the GitHub Actions runner environment, not in the deployed containers. Consider renaming to `runner-env-vars` or adding a prominent callout in the README.
**Actual**: Description says "for the workflow" — subtle and easily misread as meaning "for the deployed workloads".

### Sync naming algorithm is non-obvious and not surfaced in the log until after the fact

**File**: `action.sh:111-127` / `action-README.md:97`
**Severity**: Medium
**Description**: The sync name derivation rule (`stacks/myapp/compose.yml` becomes `<prefix>-myapp`) is documented in only one line at the very end of the README. If a user has multiple levels of nesting (e.g. `infra/prod/services/web/compose.yml`) only `basename` of the immediate parent directory is used — the deeper structure is silently collapsed to `<prefix>-web`. The log line "Processing: <path> -> <name>" does appear during the run, but there is no dry-run or preview mode to validate naming before changes are applied.
**Expected**: The README should expand the naming logic with examples covering edge cases (nested directories, root-level compose files, duplicate directory names across subtrees). Ideally, the log should show proposed sync names before any API calls are made.
**Actual**: One example sentence at end of README; no preview capability.

### `sync-interval` has no input validation and no documented constraints

**File**: `action.yml:65-68` / `action.sh:205,230`
**Severity**: Medium
**Description**: `sync-interval` defaults to `5` and is described as "Minutes between auto-sync polls". There is no validation that the value is a positive integer. The value is passed directly to the Arcane API as `--argjson syncInterval "${SYNC_INTERVAL}"`. If a user passes `"0"`, `"5 minutes"`, or a negative number, the value will either cause a `jq` type error (silently producing `null`) or be forwarded to the API which may accept or reject it without a useful error. There is also no documented minimum/maximum range.
**Expected**: Validate that `sync-interval` is a positive integer before making API calls; document min/max if the Arcane API has constraints.
**Actual**: No validation; raw string forwarded to `jq --argjson`.

### `arcane-api-key` description does not name the secret recommendation

**File**: `action.yml:14-15`
**Severity**: Low
**Description**: The description says "API key for Arcane authentication (from Settings > API Keys)". The input is `required: true` but there is no callout recommending the user store it as a GitHub secret. New users who are less familiar with Actions best practices might inline it in the workflow YAML.
**Expected**: Description should include: "Store as a GitHub Actions secret — never inline this value."
**Actual**: No secret-storage guidance.

### No example showing `compose-files` and `compose-dir` used together

**File**: `action-README.md:16-43`
**Severity**: Low
**Description**: The script supports using both `compose-dir` and `compose-files` simultaneously (the directory scan results are appended to the explicit list). The README shows them only in separate examples. A user who wants to deploy most stacks automatically but add a one-off file outside the scanned directory has no example showing the combined usage pattern.
**Expected**: A third example showing both inputs used together, or a note explaining they compose additively.
**Actual**: Two separate, non-overlapping examples.

### SSH auth path is completely undocumented

**File**: `action.yml:49-52` / `action-README.md:74`
**Severity**: Medium
**Description**: `auth-type: ssh` is listed as a valid option in the README table, but there is no example showing how to configure it, no input for providing an SSH key, and the create-repository payload in `action.sh` unconditionally includes a `token` field regardless of `auth-type`. It is unclear whether SSH auth is actually implemented end-to-end or just enumerated as a possible value. A user who selects `auth-type: ssh` expecting SSH-based git cloning has no guidance and may silently fall back to no-credential behavior.
**Expected**: Either document the SSH auth flow with a full example (key input, key injection), or remove `ssh` from the documented options until it is implemented.
**Actual**: `ssh` listed as valid option with no supporting documentation, no dedicated input, and potentially incomplete implementation.

### API error messages do not include the response body in the Actions log

**File**: `action.sh:55-60`
**Severity**: Low
**Description**: When an API call fails (HTTP >= 400), the script calls `log_error` with the method/path and HTTP code, then writes the response body to `stderr` via `cat "${tmp_body}" >&2`. GitHub Actions annotates `::error::` lines, but raw `stderr` may be harder for users to locate in the log. The response body — which likely contains the most actionable error description from Arcane — is not prefixed or grouped, making it easy to overlook next to the formatted error line.
**Expected**: The API error handler should either include the response body content in the `::error::` annotation (if it is typically short) or open a `::group::` block around it so it is clearly associated with the failing call.
**Actual**: Error message and response body appear separately; body goes to raw `stderr` without a group or annotation.
