# Pattern Matching — Re-Review Report

**PR**: nsheaps/github-actions#1 (Arcane Docker Compose Deploy v2)
**Category**: PATTERN MATCHING
**Review round**: v2 (re-review after fixes)
**Previous score**: 88/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Previous Findings Status

### L1 — Shebang uses `#!/bin/bash` not `#!/usr/bin/env bash`

**Status: STILL PRESENT**

**Evidence**: `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/tmp/action-v2.sh:1`

```bash
#!/bin/bash
```

The shebang was not changed to `#!/usr/bin/env bash`. On self-hosted runners where bash is not at `/bin/bash` (e.g., NixOS, some Alpine setups), this will fail with "No such file or interpreter." Low severity on GitHub-hosted runners, real risk on self-hosted.

---

### L2 — `.yml` vs `.yaml` extension inconsistency

**Status: STILL PRESENT**

**Evidence**: The action definition file remains `action-v2.yml` (`.yml` extension). The GitHub Actions convention favors `.yaml`, and the project's own file-extension rules state "Always prefer `.yaml` over `.yml`." The inconsistency is unfixed.

Note: The `action.yml` referenced on line 105 of the yml file (`run: ${{ github.action_path }}/action.sh`) is the shell script — that reference is correct. The issue is the action definition file's own extension.

---

### L9 — Optional inputs with computed defaults show `default: ''` in action.yml

**Status: STILL PRESENT**

**Evidence**: The following inputs have meaningful computed defaults in the shell script but are documented with `default: ''` in the yml, which is misleading to users reading the action definition:

| Input              | action-v2.yml default | Actual default (computed in shell)                             |
| ------------------ | --------------------- | -------------------------------------------------------------- |
| `repository-url`   | `''` (line 37)        | `https://github.com/${GITHUB_REPOSITORY}.git` (script line 10) |
| `repository-name`  | `''` (line 41)        | `${GITHUB_REPOSITORY##*/}` (script line 11)                    |
| `branch`           | `''` (line 46)        | `${GITHUB_REF_NAME:-main}` (script line 12)                    |
| `sync-name-prefix` | `''` (line 77)        | `${GITHUB_REPOSITORY##*/}` (script line 19)                    |

A user reading the yml has no way to know what these inputs actually default to without reading the shell script. This is a documentation gap. The description fields partially compensate (e.g., `branch` says "Defaults to the branch that triggered the workflow") but the `default:` field itself is still empty, which tooling like Dependabot, linters, and IDE plugins may surface incorrectly.

Compare with `auth-type` (line 51, `default: 'http'`), `auto-sync` (line 63, `default: 'true'`), etc. — inputs whose defaults are static get them documented correctly. Only computed defaults are missing.

---

## New Findings

### N1 — Runtime dependencies `jq` and `curl` are undeclared and unguarded

**File**: `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/tmp/action-v2.sh`
**Severity**: Medium
**Description**: The script depends on both `jq` (lines 107, 190, 200, 212, 239, 249, 272) and `curl` (line 70) but performs no pre-flight check that either tool is available. On GitHub-hosted `ubuntu-*` runners both are present, but on self-hosted runners or container-based runners (e.g., `container: alpine`), either may be absent. The failure mode is an unhelpful error deep in the execution rather than a clear "dependency missing" message.

**Expected**: A pre-flight guard at the top of the script:

```bash
for cmd in curl jq; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    log_error "Required dependency '${cmd}' is not installed"
    exit 1
  }
done
```

**Actual**: No such guard exists. The first missing-dependency failure will produce an obscure "command not found" buried in API call logic.
**Steps to reproduce**: Run the action on a runner without `jq` installed and observe the error message.

---

### N2 — `::add-mask::` emitted for empty env-var values

**File**: `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/tmp/action-v2.sh:338`
**Severity**: Low
**Description**: In `export_env_vars`, the mask command is emitted unconditionally before checking whether the value is non-empty:

```bash
echo "::add-mask::${value}"
echo "${key}=${value}" >> "${GITHUB_ENV}"
```

If a user passes `KEY=` (intentional empty value), this emits `::add-mask::` with an empty string. GitHub Actions masks the empty string, which means every occurrence of the empty string in subsequent log output is redacted — producing garbled or partially-redacted logs. This is a latent defect for any caller who legitimately sets an empty env var.

**Expected**: Guard the mask call:

```bash
[[ -n "${value}" ]] && echo "::add-mask::${value}"
```

**Actual**: `echo "::add-mask::${value}"` runs unconditionally.
**Steps to reproduce**: Pass `env-vars: "MY_VAR="` to the action and observe subsequent step log output.

---

## Summary

| Finding                        | ID  | Severity | Status        |
| ------------------------------ | --- | -------- | ------------- |
| Shebang not portable           | L1  | Low      | STILL PRESENT |
| `.yml` extension               | L2  | Low      | STILL PRESENT |
| Computed defaults undocumented | L9  | Low      | STILL PRESENT |
| `jq`/`curl` not guarded        | N1  | Medium   | NEW           |
| Empty env-var mask emission    | N2  | Low      | NEW           |

**Score: 84/100**

The v2 revision did not address any of the three carried-over findings from v1. Two new findings were identified, one of which (N1) is Medium severity due to the silent failure mode it creates on non-standard runners. The positive patterns from v1 remain intact: composite action structure, `$GITHUB_OUTPUT`/`$GITHUB_ENV` usage, `INPUT_*` convention, secret masking on startup, and thorough input validation logic.

The score decreases from 88 to 84 because the v2 re-review introduced two new findings without fixing any prior ones. If the three carried-over Low findings were always acknowledged as won't-fix by the team, the effective score would be higher — but until that disposition is recorded, they remain open.

---

## Recommendations

Priority order for resolution:

1. **(N1 / Medium)** Add `command -v curl` and `command -v jq` pre-flight guards before any logic that uses them. This is a one-time 8-line addition that prevents mysterious failures on non-standard runners.
2. **(L9 / Low)** For inputs with computed defaults, add the computed default to the `description` field explicitly (it is partially done already) or accept `default: ''` as intentional and document that convention in the action's README so users know where to look.
3. **(N2 / Low)** Guard `::add-mask::` behind `[[ -n "${value}" ]]`.
4. **(L1 / Low)** Change `#!/bin/bash` to `#!/usr/bin/env bash`.
5. **(L2 / Low)** Rename `action.yml` to `action.yaml` for consistency with project conventions.
