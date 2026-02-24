# Pattern Matching Review

**Score**: 88/100

## Summary

The `arcane-deploy` action follows established repository patterns well. It correctly uses the composite action pattern with `using: 'composite'`, delegates to a separate `action.sh` script via `${{ github.action_path }}/action.sh`, and maps all inputs to `INPUT_*` environment variables before passing them to the shell — all consistent with how composite actions work and with the conventions visible from other actions in this repo. The `action.yml` includes `branding`, `author`, `inputs`, `outputs`, and a `runs` block, which matches GitHub Action marketplace conventions. The shell script correctly uses modern GitHub Actions output mechanisms (`$GITHUB_OUTPUT`, `$GITHUB_ENV`) rather than deprecated `set-output` commands, and uses `::group::`, `::error::`, and `::add-mask::` workflow commands appropriately. The `README.md` structure — Features, Usage (multiple examples), Inputs table, Outputs table, How It Works — is thorough and more detailed than other action READMEs in the repo, which is a positive deviation. The root `README.md` is updated to include the new action under a new "Deployment Actions" section that follows the existing h3/h4 heading hierarchy used for "Authentication Actions" and "Claude Code Actions". Two minor deductions: the shebang uses `#!/bin/bash` rather than `#!/usr/bin/env bash`, which is a portability concern even if not a documented repo convention; and the `action.yml` uses the `.yml` extension while all other files in the repo that have a choice (workflow files, mise config) use `.yaml`, creating a minor inconsistency — though `.yml` is GitHub's documented default for action definitions.

## Findings

### Composite action pattern correctly applied
**File**: action.yml:99-121
**Severity**: Low (positive finding)
**Description**: `using: 'composite'` with a single step delegating to `action.sh` via `${{ github.action_path }}/action.sh` is the correct pattern for composite actions. All 15 inputs are explicitly mapped to `INPUT_*` env vars, making the contract between the YAML and shell script explicit and traceable. This matches the conventional composite action approach.

### INPUT_* env var naming convention followed
**File**: action.yml:106-121
**Severity**: Low (positive finding)
**Description**: All inputs are passed to the shell script as `INPUT_<UPPERCASE_INPUT_NAME>` environment variables, which is the standard convention for composite actions that delegate to shell scripts. The script reads these variables at the top in a dedicated configuration block (action.sh:5-19), which is clean and scannable.

### Modern GitHub Actions output mechanisms used
**File**: action.sh:340-342
**Severity**: Low (positive finding)
**Description**: The script writes to `$GITHUB_OUTPUT` (not the deprecated `::set-output::` command) and `$GITHUB_ENV` (not the deprecated `::set-env::` command). This is the correct current pattern.

### Shebang uses hardcoded bash path instead of env lookup
**File**: action.sh:1
**Severity**: Low
**Description**: The shebang is `#!/bin/bash`. The more portable convention is `#!/usr/bin/env bash`, which resolves `bash` from the user's `PATH` and is the standard for scripts intended to run in diverse environments like GitHub-hosted runners. This is not a documented repo convention, but it is a common portability best practice for shell scripts in shared actions.
**Expected**: `#!/usr/bin/env bash`
**Actual**: `#!/bin/bash`

### File extension inconsistency: .yml vs .yaml
**File**: action.yml (filename)
**Severity**: Low
**Description**: The repo's `mise.toml` tool config and the root README reference `check.yaml` — the `.yaml` extension is used for workflow files. The new action definition uses `.yml`. GitHub Actions supports both, and `.yml` is GitHub's documented default for action definitions specifically. However, the repo-wide `mise.toml` preference for `.yaml` (per org rules) creates a minor inconsistency. This is low severity because GitHub requires the file be named `action.yml` or `action.yaml` and either is valid, but the org rule prefers `.yaml`.
**Expected**: `action.yaml` (per org `.yaml` preference)
**Actual**: `action.yml`

### Optional inputs with computed shell defaults document their defaults in action.yml descriptions but have empty string defaults
**File**: action.yml:34-38, 44-47, 64-67
**Severity**: Low
**Description**: Inputs like `repository-url`, `repository-name`, and `branch` have `default: ''` in `action.yml` but have meaningful computed defaults in the shell script (e.g., `REPO_URL="${INPUT_REPOSITORY_URL:-https://github.com/${GITHUB_REPOSITORY}.git}"`). The descriptions document the actual defaults correctly ("Defaults to the current GitHub repository HTTPS URL"), but the `default:` field in the YAML shows empty string. This is a known pattern trade-off for composite actions — the defaults are runtime-computed and cannot be expressed as static YAML defaults — but it can mislead users who inspect the action.yml directly expecting defaults to be declared there. The README Inputs table handles this correctly by documenting the actual defaults.

### Root README updated correctly with new Deployment Actions section
**File**: root-README.md:89-107
**Severity**: Low (positive finding)
**Description**: The root README follows the existing pattern: h3 section heading for the action category, h4 for the action name, one-line description with link to action README, and a minimal usage snippet. The new "Deployment Actions" section is correctly inserted between the Claude Code actions and the Security Linter actions. The link to the action README (`.github/actions/arcane-deploy/README.md`) follows the same relative path convention established by other actions.

### Action README structure is more detailed than peer action READMEs
**File**: action-README.md:1-97
**Severity**: Low (positive finding, minor inconsistency)
**Description**: The action README includes a Features list, three distinct Usage examples, an Inputs table, an Outputs table, and a "How It Works" section. Other actions visible from the root README (e.g., `github-app-auth`, `interpolate-prompt`) have shorter documentation with fewer usage variants. The `arcane-deploy` action is inherently more complex, so the additional detail is justified. However, the README omits a "Prerequisites" or "Requirements" section noting that `jq` and `curl` must be available on the runner — which is worth noting given the script's hard dependency on both tools.
