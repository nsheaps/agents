# Documentation & Comments Review

**Score**: 81/100

## Summary

The documentation package for this action is genuinely good. The `action.yml` input descriptions are accurate, specific, and include practical hints (e.g., "from Settings > API Keys", regex notation for filename patterns). The action-level README covers all inputs and outputs in table form, provides three realistic usage examples, and includes a "How It Works" section that maps user-visible behavior to internal steps accurately. The root README correctly slots the action into the repo's broader catalog with a minimal but sufficient snippet. Inline comments in `action.sh` are well-placed at section boundaries and on non-obvious logic: the sync-naming comment with its before/after example (`action.sh:109`) is a textbook good comment. Branding is present and sensible. The score is held back by several real gaps: the `env-vars` input description misrepresents what the input actually does, two inputs lack documentation of their accepted value constraints, the trimming idiom used twice in `action.sh` has no explanation, and the README omits the `maxdepth 2` scanning constraint that users will hit in practice. None of these are catastrophic, but each one will produce a user question or silent misbehavior in a non-obvious situation.

## Findings

### env-vars description is inaccurate — describes workflow env, not Arcane env

**File**: `action.yml:82-83`
**Severity**: High
**Description**: The description says env-vars are "Shared environment variables ... to export for the workflow." The README (line 82) mirrors this: "Shared env vars (KEY=VALUE per line) for the workflow." However `action.sh:275` writes these to `$GITHUB_ENV`, making them available in _subsequent workflow steps_, not inside Docker Compose stacks in Arcane. The description implies they affect the Compose deployment itself. A user following the README example with `DOMAIN=example.com` will set a runner environment variable, not configure anything inside Arcane. This is a misleading description for what is actually a "set runner env vars for downstream steps" feature.
**Expected**: Description should state these variables are exported to the GitHub Actions runner environment for use in subsequent steps, not that they are injected into Arcane or compose stacks directly.
**Actual**: Both `action.yml` and the README suggest these vars affect compose files via "variable interpolation or .env files in your repo" — which is only true if the user also writes a downstream step to generate a `.env` file. That intermediary step is not documented.

### Compose file discovery depth limit not documented

**File**: `action-README.md:92`, `action.sh:91`
**Severity**: Medium
**Description**: `action.sh` uses `find ... -maxdepth 2`, meaning compose files nested more than two directories below `compose-dir` are silently ignored. Neither the README nor the `action.yml` input description for `compose-dir` mentions this constraint. A user with `stacks/myapp/production/compose.yml` (depth 3 from the repo root, depth 1 relative to `stacks/`) will get no error — just a missing sync — and have no documentation to explain why.
**Expected**: `action.yml:24-26` and `action-README.md:92` should note the two-level depth limit.
**Actual**: Neither mentions any depth restriction.

### `auth-type: ssh` is documented but ssh is not implemented

**File**: `action.yml:50-52`, `action.sh:159-165`
**Severity**: Medium
**Description**: The `auth-type` input documents three accepted values: `none`, `http`, and `ssh`. The script only ever passes `authType` and `token` to the Arcane API. There is no branch handling `ssh` specifically in `action.sh` — no SSH key variable, no alternative payload construction. Whether `ssh` actually works depends entirely on what the Arcane API does with the `authType` field. If SSH requires a private key to be sent or an SSH agent to be configured, the action silently does nothing to facilitate that. The documentation presents `ssh` as a supported option with no caveats.
**Expected**: If `ssh` is supported, document what additional configuration is required (e.g., "Arcane must already have an SSH key configured server-side"). If it is not supported end-to-end by this action, note that.
**Actual**: `auth-type: ssh` is listed as a valid value with no caveats.

### Bash parameter expansion trimming idiom is unexplained

**File**: `action.sh:73-74`, `action.sh:267-268`
**Severity**: Low
**Description**: The whitespace trimming idioms (`"${file#"${file%%[![:space:]]*}"}"` / `"${file%"${file##*[![:space:]]}"}"`) are non-obvious parameter expansion patterns. They appear twice verbatim with no comment. The section header comment at line 66 (`# --- Compose File Discovery ---`) and line 259 (`# --- Environment Variables ---`) do not explain these lines. Most engineers reviewing or maintaining this script will need to look these up.
**Expected**: A brief inline comment such as `# strip leading/trailing whitespace` would suffice.
**Actual**: No comment on these lines.

### Sync-name collision edge case not documented

**File**: `action.sh:111-127`, `action-README.md:97`
**Severity**: Low
**Description**: The `sync_name_from_path` function has a guard (`action.sh:121-123`) preventing `${prefix}-${prefix}` when the directory name matches the prefix. This edge case and its behavior are not mentioned in the README's "How It Works" section. The README only documents the straightforward case (`stacks/myapp/compose.yml` → `<prefix>-myapp`). Users who name a stack directory after their repo will get a different sync name than expected with no warning.
**Expected**: A note in the "How It Works" section or input description for `sync-name-prefix` explaining the deduplication behavior.
**Actual**: Only the happy-path example is documented.

### `environment-id` input lacks format guidance

**File**: `action.yml:18-20`, `action-README.md:65`
**Severity**: Low
**Description**: The `environment-id` description just says "Arcane environment ID to deploy to." The README usage examples use `'1'` (a quoted integer). There is no indication of whether this is a numeric ID, a UUID, a slug, or a string, and where a user finds it in the Arcane UI. Compare with `arcane-api-key` which helpfully notes "(from Settings > API Keys)" — `environment-id` gets no equivalent hint.
**Expected**: A parenthetical such as "(numeric ID visible in Arcane under Environments)" or similar to aid discoverability.
**Actual**: No format or location hint.

### Root README entry is minimal — no outputs documented

**File**: `root-README.md:94-107`
**Severity**: Low
**Description**: The root README entry for `arcane-deploy` links to the action README for "full docs" but only shows a single usage snippet with no outputs listed. Every other action in the root README documents its outputs inline (e.g., `github-app-auth` at lines 21-25 lists all four outputs). The `arcane-deploy` section is inconsistent with the established pattern in the same file.
**Expected**: Either list the three outputs (`syncs-created`, `syncs-updated`, `repository-id`) inline, or explicitly state that outputs are covered in the linked README.
**Actual**: Outputs are omitted from the root README entry.
