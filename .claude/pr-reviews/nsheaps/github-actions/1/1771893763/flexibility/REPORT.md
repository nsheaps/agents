# Flexibility Review

**Score**: 62/100

## Summary

The action covers a reasonable set of use cases for a first cut: two compose file discovery modes (directory scan and explicit list), configurable git authentication types, adjustable sync behavior, and sensible defaults that reduce required inputs to three. However, several hardcoded decisions limit adaptability. The directory scan depth is fixed at 2 and cannot be overridden, SSH authentication lists the option but provides no input for the key material, per-compose-file sync names cannot be overridden individually, the `env-vars` input exports variables into the entire downstream workflow rather than scoping them to Arcane, and there is no timeout control on API calls. Callers who need anything beyond the happy path — deeper directory trees, SSH repos, custom per-stack naming, or isolated environment scoping — will hit walls that require forking the action rather than just adding configuration.

## Findings

### SSH auth-type advertised but unusable

**File**: `.github/actions/arcane-deploy/action.yml:53-57`
**Severity**: High
**Description**: `auth-type: ssh` is documented as a valid value, but there is no corresponding `ssh-key` input (or `ssh-known-hosts`). The create-repository payload unconditionally includes a `token` field (action.sh line 165). A caller who selects `ssh` has no way to supply the actual key material through this action. Either the option is incomplete or the Arcane API handles SSH differently and this is undocumented.
**Expected**: If `auth-type: ssh` is a supported value, there should be an input for the SSH private key and optionally known-hosts. If it is not yet supported, it should not appear in the documented options.
**Steps to reproduce**: Set `auth-type: ssh` with no git-token and observe that the payload contains `token: ""` sent to the Arcane API.

---

### Directory scan depth hardcoded to 2

**File**: `.github/actions/arcane-deploy/action.sh:91`
**Severity**: Medium
**Description**: `find ... -maxdepth 2` is hardcoded. A monorepo with compose files three or more levels deep (e.g., `services/backend/api/compose.yml`) will silently produce zero results for those files without any warning. There is no `compose-scan-depth` input to override this.
**Expected**: A `compose-scan-depth` input (defaulting to `2`) or at minimum a warning when files are found at deeper depths that were excluded.
**Steps to reproduce**: Place a compose file at `a/b/c/compose.yml` and set `compose-dir: a`. The file will not be discovered.

---

### Per-stack sync name cannot be overridden

**File**: `.github/actions/arcane-deploy/action.sh:111-127`
**Severity**: Medium
**Description**: Sync names are derived entirely from the compose file's parent directory name. There is no mechanism to override individual sync names. If two different services happen to live in directories with the same name (e.g., `frontend/api/compose.yml` and `backend/api/compose.yml`), both will derive the same sync name `<prefix>-api`, causing one to overwrite the other's sync registration silently. The `sync-name-prefix` input only controls the prefix, not the full name.
**Expected**: Either a collision warning/error, or a `compose-file-names` input parallel to `compose-files` that allows callers to supply explicit names for each compose file.
**Steps to reproduce**: Set compose-files to two paths that share the same `basename(dirname())`. Observe that only one sync name is generated and they will collide.

---

### env-vars leaks into entire downstream workflow

**File**: `.github/actions/arcane-deploy/action.sh:275`
**Severity**: Medium
**Description**: The `env-vars` input writes `KEY=VALUE` pairs to `$GITHUB_ENV`, which makes them available to every subsequent step in the workflow — not just the Arcane deploy step. This is a side-effect with security and correctness implications: callers who only want variables scoped to compose interpolation or `.env` files will inadvertently pollute their full pipeline. There is no opt-out; the only way to avoid this behavior is to not use `env-vars` at all.
**Expected**: Either document this explicitly as a known side-effect with a warning, or add an option to scope the export (e.g., write to a `.env` file in a known path rather than `$GITHUB_ENV`).
**Steps to reproduce**: Add `env-vars: SECRET_KEY=abc123` and check subsequent workflow steps — `SECRET_KEY` will be available in all of them.

---

### No timeout control on API calls

**File**: `.github/actions/arcane-deploy/action.sh:47-53`
**Severity**: Medium
**Description**: All `curl` calls have no `--max-time` or `--connect-timeout` flags. If the Arcane instance is unreachable or slow, the action will hang indefinitely until the GitHub Actions job-level timeout (default 6 hours) kills it. There is no `timeout` input to let callers control this behavior.
**Expected**: A default curl timeout (e.g., `--max-time 30 --connect-timeout 10`) with an optional `timeout` input to override it.
**Steps to reproduce**: Point `arcane-url` at a host that accepts TCP connections but never responds. The action will block forever.

---

### sync-interval accepts unconstrained free-text with no validation

**File**: `.github/actions/arcane-deploy/action.sh:206`
**Severity**: Low
**Description**: `SYNC_INTERVAL` is passed directly to jq as `--argjson syncInterval "${SYNC_INTERVAL}"`. The input accepts any string. If a caller passes a non-integer value (e.g., `"5m"`, `"every 5 minutes"`, or an empty string), jq will either error or send a malformed payload to the API. There is no input validation before it reaches the payload.
**Expected**: A guard like `if ! [[ "${SYNC_INTERVAL}" =~ ^[0-9]+$ ]]; then log_error "sync-interval must be a positive integer"; exit 1; fi` before line 206.
**Steps to reproduce**: Set `sync-interval: "5m"`. The jq call will fail with a parse error or produce an unexpected type in the API payload.

---

### compose-files and compose-dir combination is undocumented

**File**: `.github/actions/arcane-deploy/action.sh:70-97`, `action-README.md:92`
**Severity**: Low
**Description**: The script silently merges results from both `compose-files` and `compose-dir` when both are provided (explicit files first, then scanned files). This combination mode is not documented. Callers may not realize they can combine both modes, or may accidentally duplicate entries if a file listed in `compose-files` also appears in the `compose-dir` scan. There is no deduplication.
**Expected**: Document the combination behavior in the README, and add deduplication when both inputs are provided to prevent duplicate sync registrations.
**Steps to reproduce**: Set `compose-files: stacks/myapp/compose.yml` and `compose-dir: stacks`. If `stacks/myapp/compose.yml` exists, it will appear twice in the file list, causing `upsert_sync` to be called twice for the same path.

---

### No support for external (non-GitHub) repository URLs in auto-detection

**File**: `.github/actions/arcane-deploy/action.sh:10`
**Severity**: Low
**Description**: The default repository URL is hard-coded to `https://github.com/${GITHUB_REPOSITORY}.git`. Callers running in GitHub Actions but deploying from a GitLab, Gitea, or Bitbucket mirror must explicitly set `repository-url`. This is not a hard blocker since the override exists, but the default assumption of GitHub-only is worth noting as a flexibility constraint for non-GitHub-hosted codebases running in GitHub Actions.
**Expected**: Document that non-GitHub sources must set `repository-url` explicitly. The current README does not call this out.
