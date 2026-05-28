# Overall Review: Arcane Docker Compose Deploy GitHub Action

**PR**: [github-actions#1](https://github.com/nsheaps/github-actions/pull/1)
**Commit**: `0b0b87e`
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Score Summary

| Category         |  Score | Status |
| :--------------- | -----: | :----: |
| Pattern Matching |     88 |   ✅   |
| Documentation    |     81 |   ⚠️   |
| Best Practices   |     74 |   ⚠️   |
| Simplicity       |     72 |   ⚠️   |
| Usability        |     72 |   ⚠️   |
| Flexibility      |     62 |   🚨   |
| General QA       |     62 |   🚨   |
| Security         |     42 |   🚨   |
| **Overall**      | **69** | **🚨** |

> Legend: ✅ ≥85% — ⚠️ 70–84% — 🚨 <70%
>
> Constraint: If ⚠️ in any category, max overall is 94%. If 🚨 in any category, overall cannot exceed that category's cap.

---

## Verdict: **Not ready to merge**

Three categories are in 🚨 territory, including Security at 42/100. The action has two **Critical** defects (secret masking) and multiple **High** defects across security, reliability, usability, and documentation. The happy path works, but the action is not safe for use with real secrets and will produce confusing failures on common error paths.

---

## Critical & High Findings (Deduplicated)

These are the findings that must be resolved before merge. Findings that appear in multiple category reports are listed once with cross-references.

### Critical

<details>
<summary><strong>C1: API key masked after first use</strong> — action.sh:307</summary>

`::add-mask::${API_KEY}` is called at line 307, but the key is already used in `arcane_api` curl calls as early as line 49. With `ACTIONS_STEP_DEBUG=true`, curl verbose output exposes the key in plaintext before the mask is registered. If validation fails before line 307, `::error::` messages are emitted while the key is unmasked.

**Fix**: Move `echo "::add-mask::${API_KEY}"` to the very first line of the script, before any logging or validation.

**Reported in**: Security, Best Practices, General QA

</details>

<details>
<summary><strong>C2: Git token never masked</strong> — action.sh:14</summary>

`GIT_TOKEN` is read from `INPUT_GIT_TOKEN` at line 14 and embedded in API request bodies (lines 148–165), but `::add-mask::${GIT_TOKEN}` is never called anywhere. With step debug logging, the token appears in curl verbose output in plaintext.

**Fix**: Add `[[ -n "${GIT_TOKEN}" ]] && echo "::add-mask::${GIT_TOKEN}"` immediately after reading the token.

**Reported in**: Security, Best Practices

</details>

### High

<details>
<summary><strong>H1: ENV_VARS values written to GITHUB_ENV without masking</strong> — action.sh:275</summary>

`export_env_vars` writes raw `KEY=VALUE` pairs to `$GITHUB_ENV` without calling `::add-mask::` on the values first. Any secrets passed through `env-vars` will appear unmasked in subsequent steps. Additionally, no validation prevents env-injection via embedded newlines in values.

**Fix**: Call `echo "::add-mask::${value}"` before writing each value to `$GITHUB_ENV`. Validate keys match `[A-Za-z_][A-Za-z0-9_]*` and values contain no embedded newlines.

**Reported in**: Security, Best Practices, General QA, Documentation

</details>

<details>
<summary><strong>H2: <code>|| true</code> on curl creates silent failure on network errors</strong> — action.sh:47–55</summary>

`curl ... || true` suppresses transport failures. When curl fails (DNS, timeout, connection refused), `http_code` is empty. The `-ge 400` comparison treats empty string as `0`, passing the gate — the function returns empty output silently. Downstream `jq` calls then fail with cryptic errors.

**Fix**: After curl, check `[[ -z "${http_code}" ]]` and return a clear "could not reach API" error. Also add `--max-time 30 --connect-timeout 10` defaults.

**Reported in**: Best Practices, General QA

</details>

<details>
<summary><strong>H3: SYNC_INTERVAL passed as --argjson without numeric validation</strong> — action.sh:203–210</summary>

`SYNC_INTERVAL` is passed directly to `jq --argjson`. Non-numeric values (empty string, `"five"`, `"5m"`) cause jq to abort mid-deploy after the repository may already have been created. No minimum/maximum range is enforced.

**Fix**: Validate `SYNC_INTERVAL` is a positive integer before first use: `[[ "${SYNC_INTERVAL}" =~ ^[1-9][0-9]*$ ]] || { log_error "sync-interval must be a positive integer"; exit 1; }`.

**Reported in**: Security, General QA, Usability, Flexibility

</details>

<details>
<summary><strong>H4: SSH auth-type advertised but unusable</strong> — action.yml:49–52</summary>

`auth-type: ssh` is listed as a valid option in the README and action.yml, but there is no `ssh-key` input, no SSH-specific payload construction, and the create-repository body unconditionally includes a `token` field. A user selecting `ssh` gets no guidance and may silently fall back to no-credential behavior.

**Fix**: Either add `ssh-key` / `ssh-known-hosts` inputs and implement SSH support, or remove `ssh` from the documented options until implemented.

**Reported in**: Flexibility, Usability, Documentation

</details>

<details>
<summary><strong>H5: git-token silently required when auth-type is http (default)</strong> — action.yml:55–57</summary>

`auth-type` defaults to `http` and `git-token` is marked optional with empty default. No validation checks that `git-token` is set when `auth-type=http`. A new user omitting `git-token` gets a cryptic Arcane API error with no pointer to the missing input.

**Fix**: Add validation: `if [[ "${AUTH_TYPE}" == "http" && -z "${GIT_TOKEN}" ]]; then log_error "git-token is required when auth-type is http"; exit 1; fi`.

**Reported in**: Usability

</details>

<details>
<summary><strong>H6: env-vars description is inaccurate</strong> — action.yml:81–84</summary>

The `env-vars` input name and description imply it sets variables for deployed containers, but it actually writes to `$GITHUB_ENV` (runner environment for subsequent steps). The README example shows Docker-typical values (`DOMAIN`, `NETWORK`, `TZ`), reinforcing the misconception.

**Fix**: Update the description to clearly state these are runner environment variables. Consider renaming to `runner-env-vars` or adding a prominent callout in the README.

**Reported in**: Documentation, Usability

</details>

<details>
<summary><strong>H7: jq failures on malformed API responses are unguarded</strong> — action.sh:138–189</summary>

Every `jq` call assumes the API returns well-formed JSON. If Arcane returns HTML, plain text, or an unexpected JSON shape, jq fails via `set -e` with an obscure error. `REPOSITORY_ID` can be set to the string `"null"` if the response lacks an `id` field, causing all subsequent API calls to use `/customize/git-repositories/null`.

**Fix**: Validate that jq output is non-empty and non-`"null"` after each extraction. Use `jq -e` with explicit error handling.

**Reported in**: Best Practices, General QA

</details>

---

## Medium Findings Summary

| ID  | Finding                                                     | File              | Categories                 |
| :-- | :---------------------------------------------------------- | :---------------- | :------------------------- |
| M1  | No `auth-type` input validation (allowlist)                 | action.sh:13      | Security                   |
| M2  | No HTTPS enforcement on `arcane-url`                        | action.sh:5       | Security                   |
| M3  | Temp files not cleaned up on signals                        | action.sh:44      | Security, General QA       |
| M4  | `sync_name_from_path` collisions on multi-level dirs        | action.sh:111–127 | General QA, Simplicity     |
| M5  | No deduplication of compose files                           | action.sh:314–315 | General QA                 |
| M6  | `REPOSITORY_ID` set to `"null"` on unexpected API response  | action.sh:138–170 | General QA                 |
| M7  | `auth-type: none` still sends empty token                   | action.sh:159–165 | General QA                 |
| M8  | `compose-dir` scan depth (maxdepth 2) undocumented          | action.sh:91      | Documentation, Flexibility |
| M9  | Sync naming algorithm non-obvious, single-line docs only    | action.sh:111–127 | Usability                  |
| M10 | `environment-id` has no format guidance or UI location hint | action.yml:18–19  | Usability, Documentation   |
| M11 | SSH auth path undocumented (see H4)                         | action.yml:49–52  | Usability                  |
| M12 | Duplicated trigger-sync block in `upsert_sync`              | action.sh:217–254 | Simplicity                 |
| M13 | `env-vars` + `compose-dir` combination undocumented         | action.sh         | Flexibility                |
| M14 | No tests, no shellcheck                                     | action.sh         | General QA                 |

---

## Low Findings Summary

| ID  | Finding                                                     | File                     | Categories                   |
| :-- | :---------------------------------------------------------- | :----------------------- | :--------------------------- |
| L1  | Shebang uses `#!/bin/bash` not `#!/usr/bin/env bash`        | action.sh:1              | Pattern Matching             |
| L2  | `.yml` vs `.yaml` extension inconsistency                   | action.yml               | Pattern Matching             |
| L3  | Redundant `auto_sync_val` conversion                        | action.sh:191–192        | Best Practices, Simplicity   |
| L4  | Whitespace trim idiom duplicated, unexplained               | action.sh:73–74, 267–268 | Simplicity, Documentation    |
| L5  | `REPOSITORY_ID` as mutable global state                     | action.sh:23             | Simplicity                   |
| L6  | `compose-files` allows arbitrary path strings               | action.sh:72–77          | Security                     |
| L7  | `repository-id` exposed as workflow output                  | action.sh:342            | Security                     |
| L8  | `arcane-api-key` description missing secrets guidance       | action.yml:14–15         | Usability                    |
| L9  | Optional inputs with computed defaults show `default: ''`   | action.yml:34–38         | Pattern Matching             |
| L10 | Root README entry missing outputs                           | root-README.md:89–107    | Documentation                |
| L11 | Sync-name collision edge case undocumented                  | action.sh:121–123        | Documentation                |
| L12 | `existing_syncs` stale after first upsert in loop           | action.sh:327            | General QA                   |
| L13 | API error response body in raw stderr, not grouped          | action.sh:55–60          | Usability                    |
| L14 | `GITHUB_WORKSPACE` fallback undocumented                    | action.sh:82             | General QA, Pattern Matching |
| L15 | No example showing `compose-files` + `compose-dir` together | action-README.md         | Usability                    |

---

## Category Reports

| Category         | Report                                                     |
| :--------------- | :--------------------------------------------------------- |
| Simplicity       | [`simplicity/REPORT.md`](simplicity/REPORT.md)             |
| Flexibility      | [`flexibility/REPORT.md`](flexibility/REPORT.md)           |
| Usability        | [`usability/REPORT.md`](usability/REPORT.md)               |
| Documentation    | [`documentation/REPORT.md`](documentation/REPORT.md)       |
| Security         | [`security/REPORT.md`](security/REPORT.md)                 |
| Pattern Matching | [`pattern-matching/REPORT.md`](pattern-matching/REPORT.md) |
| Best Practices   | [`best-practices/REPORT.md`](best-practices/REPORT.md)     |
| General QA       | [`general-qa/REPORT.md`](general-qa/REPORT.md)             |

---

## Positive Findings

Not everything is bad. The action gets several things right:

- **Composite action pattern correctly applied** — `using: 'composite'` with explicit `INPUT_*` env var mapping
- **Modern GitHub Actions output mechanisms** — `$GITHUB_OUTPUT` and `$GITHUB_ENV`, not deprecated `::set-output::`
- **`jq --arg` for safe JSON parameterization** — prevents shell injection in API payloads
- **`set -euo pipefail`** — strict bash mode throughout
- **Consistent variable quoting** — all variables double-quoted
- **Structured log output** — `::group::`/`::endgroup::` and `::error::` annotations
- **Thorough README** — more detailed than peer action READMEs, with multiple usage examples
- **Root README properly updated** — follows existing heading hierarchy and patterns
