# Simplicity Review

**Score**: 72/100

## Summary

The action is well-scoped and clearly decomposed — six focused functions, each doing one thing. For what it is (a GitOps deploy action wrapping a REST API), the overall structure is appropriate. However, several specific choices add complexity without earning it. The `auto_sync_val` boolean-to-string conversion is a one-liner masquerading as logic. The `upsert_sync` function has duplicated trigger-sync blocks that could collapse into a single call after the if/else. The whitespace-trimming idiom using pure-bash parameter expansion appears in two separate functions verbatim — that pattern is obscure enough to warrant a helper, or the code could just use `xargs` or `awk`. The `sync_name_from_path` function has a guard condition (`if [[ "${name}" != "${SYNC_NAME_PREFIX}" ]]`) that will only fire if the directory name exactly matches the prefix, which is a confusing and almost certainly never-triggered edge case. The manual `INPUT_*` environment variable plumbing in `action.yml` (15 lines of nearly identical `INPUT_FOO: ${{ inputs.foo }}` entries) is pure boilerplate that the composite action model requires but still adds visual noise. The `REPOSITORY_ID` global mutable state shared across `ensure_repository` and `upsert_sync` is an implicit dependency that makes the flow harder to reason about than it needs to be. None of these are disqualifying, but together they keep the score from being in the 80s.

## Findings

### Duplicated trigger-sync block inside upsert_sync

**File**: `.github/actions/arcane-deploy/action.sh:217-219` and `.github/actions/arcane-deploy/action.sh:252-254`
**Severity**: Medium
**Description**: The `if [[ "${TRIGGER_SYNC}" == "true" ]]` block and its body are copy-pasted identically in the update branch and the create branch of `upsert_sync`. The only difference between the two invocations is whether the ID variable is `existing_id` or `new_id`. Both branches could set a local `sync_id` variable early (it is already resolved in each branch before the trigger block), and then a single trigger-sync call could follow the if/else. Duplication here means any future change to trigger behavior (adding retry, changing the log message, adding error handling) must be made twice.
**Recommendation**: Assign a local `sync_id` in each branch, then call the trigger once after the if/else closes.

### Redundant auto_sync_val string conversion

**File**: `.github/actions/arcane-deploy/action.sh:300-301`
**Severity**: Low
**Description**: `AUTO_SYNC` is already a string `"true"` or `"false"` sourced directly from the `INPUT_AUTO_SYNC` environment variable. The two lines that initialize `auto_sync_val="false"` and then conditionally set it to `"true"` are re-implementing what the variable already contains. The value could be passed directly to `jq --argjson autoSync` by lowercasing `AUTO_SYNC`, or validated once at input-parse time. This pattern implies the author was unsure whether to trust the input string, but that uncertainty is not documented.
**Recommendation**: Either validate/normalize `AUTO_SYNC` at the top of the script alongside the other input assignments, or pass it directly — `--argjson autoSync "${AUTO_SYNC}"` after ensuring the value is a valid JSON boolean at assignment time.

### Whitespace trimming idiom duplicated verbatim across two functions

**File**: `.github/actions/arcane-deploy/action.sh:73-74` and `.github/actions/arcane-deploy/action.sh:267-268`
**Severity**: Low
**Description**: The pure-bash trim pattern (`file="${file#"${file%%[![:space:]]*}"}"` / `file="${file%"${file##*[![:space:]]}"}"`) appears identically in `discover_compose_files` and `export_env_vars`. It is already difficult to read at first glance; duplicating it makes it harder to audit for correctness. A `trim()` helper function would be three lines and would make both call sites self-documenting.
**Recommendation**: Extract into a `trim_whitespace()` function and call it from both locations.

### Obscure edge case in sync_name_from_path

**File**: `.github/actions/arcane-deploy/action.sh:121-123`
**Severity**: Low
**Description**: Inside `sync_name_from_path`, after extracting the directory `basename`, there is a guard: `if [[ "${name}" != "${SYNC_NAME_PREFIX}" ]]; then name="${SYNC_NAME_PREFIX}-${name}"; fi`. This prevents the name from becoming `prefix-prefix` in the case where a directory happens to be named exactly the same as the prefix. This is a real edge case but it is completely undocumented, and the behavior when it fires (silently collapsing to just the prefix) could cause two different compose files to map to the same sync name. The complexity to handle this case is not justified by the risk, and the silent collision is arguably more dangerous than the redundant `prefix-prefix` name it avoids.
**Recommendation**: Either document this behavior explicitly with a comment explaining the collision avoidance, or remove the guard and let the user deal with unusual directory naming.

### REPOSITORY_ID as mutable global state

**File**: `.github/actions/arcane-deploy/action.sh:23` and `.github/actions/arcane-deploy/action.sh:138-170`
**Severity**: Low
**Description**: `REPOSITORY_ID` is declared as an empty global at the top of the script, populated as a side effect inside `ensure_repository`, and then read implicitly by `upsert_sync`. This creates a temporal coupling: `upsert_sync` cannot be called unless `ensure_repository` ran first, but nothing in the function signature makes this dependency visible. In a 344-line script this is manageable, but it is still an unnecessary implicit contract.
**Recommendation**: Have `ensure_repository` echo or `return` the repository ID, then capture it at the call site and pass it explicitly to `upsert_sync` as a fourth argument. This makes the data flow visible without adding meaningful complexity.

### Manual INPUT\_\* environment variable boilerplate in action.yml

**File**: `.github/actions/arcane-deploy/action.yml:107-121`
**Severity**: Low
**Description**: The composite action plumbs 15 inputs through manually specified `INPUT_FOO: ${{ inputs.foo }}` environment variables. This is an unavoidable GitHub Actions composite action limitation, not a design flaw in this action. It is noted here only because the visual bulk slightly obscures the actual structure of the action. No change is recommended unless GitHub adds a shorthand for this pattern.
**Recommendation**: No action required — this is a platform constraint, not a simplicity violation.
