# Pattern Matching — Re-Review Report

**PR**: nsheaps/github-actions#1 (Arcane Docker Compose Deploy v3)
**Category**: PATTERN MATCHING
**Review round**: v3 (re-review after targeted fixes)
**Previous score**: 84/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Previous Findings Status

### L1 — Shebang uses `#!/bin/bash` not `#!/usr/bin/env bash`

**Status: STILL PRESENT**

**Evidence**: `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/tmp/action-v3.sh:1`

```bash
#!/bin/bash
```

No change from v2. The shebang remains incompatible with self-hosted runners where bash is not at `/bin/bash`.

---

### L2 — `.yml` vs `.yaml` extension inconsistency

**Status: STILL PRESENT**

**Evidence**: The action definition file remains `action-v3.yml` (`.yml` extension). The project's file-extension rules state "Always prefer `.yaml` over `.yml`." This inconsistency is unfixed.

---

### L9 — Optional inputs with computed defaults show `default: ''` in action.yml

**Status: STILL PRESENT**

**Evidence**: The following inputs still show `default: ''` despite computing their values in the script:

| Input              | action-v3.yml default | Actual default (computed in shell)                             |
| ------------------ | --------------------- | -------------------------------------------------------------- |
| `repository-url`   | `''` (line 37)        | `https://github.com/${GITHUB_REPOSITORY}.git` (script line 10) |
| `repository-name`  | `''` (line 42)        | `${GITHUB_REPOSITORY##*/}` (script line 11)                    |
| `branch`           | `''` (line 47)        | `${GITHUB_REF_NAME:-main}` (script line 12)                    |
| `sync-name-prefix` | `''` (line 78)        | `${GITHUB_REPOSITORY##*/}` (script line 19)                    |

This remains a documentation gap for users and tooling.

---

### N1 — Runtime dependencies `jq` and `curl` are undeclared and unguarded

**Status: STILL PRESENT**

**Evidence**: No pre-flight dependency check exists. The script assumes both `jq` and `curl` are available but provides no guard before they are used:

- `curl` at line 70
- `jq` at lines 107, 190, 200, 212, 239, 249, 272

On self-hosted runners without these tools, the failure mode is an unhelpful "command not found" error rather than a clear pre-flight message.

---

### N2 — `::add-mask::` emitted for empty env-var values

**Status: STILL PRESENT**

**Evidence**: `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/tmp/action-v3.sh:338`

```bash
echo "::add-mask::${value}"
echo "${key}=${value}" >> "${GITHUB_ENV}"
```

The mask command runs unconditionally. If a caller sets `env-vars: "MY_VAR="` (intentional empty), this masks the empty string, producing garbled subsequent log output.

---

## New Changes in v3

The v3 revision added two validation guards:

### AUTO_SYNC Validation (lines 377-380)

```bash
if [[ "${AUTO_SYNC}" != "true" && "${AUTO_SYNC}" != "false" ]]; then
  log_error "auto-sync must be 'true' or 'false', got '${AUTO_SYNC}'"
  exit 1
fi
```

This follows the same guard pattern as `auth-type` and `sync-interval` — validating that optional boolean inputs only accept specific values.

### HTTPS Enforcement (lines 388-392)

```bash
if [[ "${ARCANE_URL}" != https://* ]]; then
  log_error "arcane-url must use HTTPS (got '${ARCANE_URL}')"
  exit 1
fi
```

New validation ensuring the Arcane URL uses HTTPS. This is a security-forward pattern.

**Pattern Assessment**: Both new guards follow the existing input validation style (clear error messages, fail-fast on invalid input). The guards improve consistency in the validation section. However, they do not fix any of the five carried-over findings.

---

## Summary

| Finding                        | ID  | Severity | v2 Status     | v3 Status     |
| ------------------------------ | --- | -------- | ------------- | ------------- |
| Shebang not portable           | L1  | Low      | STILL PRESENT | STILL PRESENT |
| `.yml` extension               | L2  | Low      | STILL PRESENT | STILL PRESENT |
| Computed defaults undocumented | L9  | Low      | STILL PRESENT | STILL PRESENT |
| `jq`/`curl` not guarded        | N1  | Medium   | NEW           | STILL PRESENT |
| Empty env-var mask emission    | N2  | Low      | NEW           | STILL PRESENT |

**Score: 85/100**

The v3 revision maintains the structural integrity of v2 and adds two well-patterned input validation guards (AUTO_SYNC and HTTPS enforcement). These guards improve the consistency of the validation section and reduce risk (HTTPS enforcement is a security win). However, none of the five v2 findings were fixed.

The score increases by 1 point (84 to 85) because the new validation guards demonstrate better understanding of guard patterns and add a meaningful security control (HTTPS enforcement). Without these improvements, the score would remain at 84. The score does not increase further because the five v2 findings remain unresolved.

---

## Recommendations

Priority order remains unchanged from v2:

1. **(N1 / Medium)** Add pre-flight guards for `curl` and `jq` before any usage.
2. **(L9 / Low)** Document computed defaults explicitly or formalize the convention.
3. **(N2 / Low)** Guard `::add-mask::` behind `[[ -n "${value}" ]]`.
4. **(L1 / Low)** Change shebang to `#!/usr/bin/env bash`.
5. **(L2 / Low)** Rename `action.yml` to `action.yaml`.
