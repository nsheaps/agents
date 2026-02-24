# Usability Re-Review — Arcane Docker Compose Deploy v2

**PR:** nsheaps/github-actions#1  
**Review round:** v2 (re-review after fixes)  
**Reviewer:** Daffy D (qa)  
**Date:** 2026-02-23  
**Previous score:** 72/100  

---

## Previous Findings — Status

### H3 (High-shared): SYNC_INTERVAL passed as --argjson without validation

**Status: FIXED**

`action-v2.sh` lines 376–380 now validate before the value ever reaches `jq`:

```bash
if [[ ! "${SYNC_INTERVAL}" =~ ^[1-9][0-9]*$ ]]; then
  log_error "sync-interval must be a positive integer, got '${SYNC_INTERVAL}'"
  exit 1
fi
```

`--argjson syncInterval "${SYNC_INTERVAL}"` at lines 254 and 280 is still present but is now safe — the regex guard ensures `SYNC_INTERVAL` is always a positive integer string before jq receives it. Fix is complete.

---

### H5 (High): git-token silently required when auth-type is http

**Status: FIXED**

`action-v2.sh` lines 364–368:

```bash
if [[ "${AUTH_TYPE}" == "http" && -z "${GIT_TOKEN}" ]]; then
  log_error "git-token is required when auth-type is http (the default). Set git-token or use auth-type: none."
  exit 1
fi
```

The error message explicitly names the escape hatch. `action-v2.yml` line 55 updated `git-token` description: "Required when auth-type is http (the default)." The README inputs table at line 75 carries the same language. Silent failure is gone.

---

### H6 (High): env-vars description inaccurate — implies container env, actually sets runner env

**Status: FIXED**

`action-v2.yml` lines 82–83:

> "Environment variables (KEY=VALUE per line) to export to the GitHub Actions runner via $GITHUB_ENV. These are available to subsequent workflow steps, NOT inside deployed containers. Values are automatically masked in logs."

`action-v2.sh` line 309 adds a matching code comment. README line 45 and inputs table line 80 carry the same clarification. Fix is thorough and consistent across all three files.

---

### M9 (Medium): Sync naming algorithm non-obvious, single-line docs only

**Status: FIXED**

`action-v2.sh` lines 159–179 now include a multi-line comment block:

```bash
# --- Sync Naming ---
# Derive a sync name from a compose file path.
# "stacks/myapp/compose.yml" -> "${prefix}-myapp"
# "compose.yml" (root) -> "${prefix}"
```

README line 97 states: "Sync names are derived from the compose file's parent directory: `stacks/myapp/compose.yml` becomes `<prefix>-myapp`."

The duplication-avoidance branch at lines 173–175 (preventing `prefix-prefix` names when directory matches prefix) is present and documented. Fix is adequate.

---

### M10 (Medium): environment-id has no format guidance or UI location hint

**Status: STILL PRESENT**

`action-v2.yml` line 19:

```yaml
environment-id:
  description: 'Arcane environment ID to deploy to'
```

No format hint (numeric? UUID? slug?), no UI location hint, no example value. The README inputs table line 68 is equally bare. The README examples hard-code `environment-id: '1'` which implies numeric but is not labeled as intentional guidance — it looks like a placeholder. A new user cannot find this value without guessing or diving into Arcane's UI.

**Evidence:** `action-v2.yml:19`, `action-readme-v2.md:68`

---

### M11 (Medium): SSH auth path undocumented

**Status: STILL PRESENT (reframed)**

`action-v2.yml` line 50 describes only "none or http" as valid values. `action-v2.sh` lines 371–374 confirms there is no SSH support — it validates against exactly `none` and `http` and rejects anything else. The prior finding assumed SSH was intended; it is not.

However the documentation gap that was the real problem remains: `auth-type: none` has no documented use case. A user with a private repo who sees `git-token` as optional might try `none`, the action will exit cleanly, and the failure will surface inside Arcane at clone time — not in the workflow log. See N1 below for details.

**Evidence:** `action-v2.yml:50-51`, `action-v2.sh:371-374`

---

### L8 (Low): arcane-api-key description missing secrets guidance

**Status: PARTIALLY FIXED**

`action-v2.yml` line 15:

```yaml
arcane-api-key:
  description: 'API key for Arcane authentication (from Settings > API Keys)'
```

The UI location hint (`Settings > API Keys`) has been added. The script correctly masks the key at line 22 with `::add-mask::`. However neither the input description nor the README inputs table explicitly says "store this as a GitHub Actions secret." The README examples use `${{ secrets.ARCANE_API_KEY }}` correctly but without explanation. A user new to GitHub Actions can still hardcode the value and not realize it will appear in workflow logs.

**Evidence:** `action-v2.yml:15`, `action-readme-v2.md:67`

---

### L13 (Low): API error response body in raw stderr, not grouped

**Status: STILL PRESENT**

`action-v2.sh` lines 90–95:

```bash
if [[ "${http_code}" -ge 400 ]]; then
  log_error "API ${method} ${path} failed (HTTP ${http_code})"
  cat "${tmp_body}" >&2
  rm -f "${tmp_body}"
  return 1
fi
```

The `log_error` call now emits `::error::` for a GitHub Actions annotation on the first line — that is an improvement over v1. However `cat "${tmp_body}" >&2` still dumps raw JSON to stderr with no grouping, no pretty-printing, and no truncation. The `::error::` annotation and raw JSON immediately below it create a mixed-format output that is hard to parse visually.

**Evidence:** `action-v2.sh:90-95`

---

### L15 (Low): No example showing compose-files + compose-dir together

**Status: STILL PRESENT**

The README now has two usage examples (lines 16–43): one for `compose-dir` alone and one for `compose-files` alone. `discover_compose_files()` at lines 119–156 explicitly supports both simultaneously — it processes the explicit list first, then appends directory scan results. The "How It Works" section at line 93 says "from `compose-dir` ... and/or the explicit `compose-files` list" but shows no example of the combination.

**Evidence:** `action-readme-v2.md:16-43`, `action-v2.sh:119-156`

---

## New Findings

### N1 (Medium): auth-type: none use case never documented

**File:** `action-v2.yml:50-51`, `action-readme-v2.md:74`  
**Severity:** Medium  
**Description:** `auth-type: none` is valid but its intended use case is never stated. The description says only "Git auth type: none or http." A user with a private repo who sees `git-token` as optional might choose `none` to avoid the H5 validation error. The action will then exit successfully, Arcane will attempt the clone unauthenticated, and the failure surfaces inside Arcane's UI — not in the workflow log, not with an actionable message.  
**Expected:** "Use `none` for public repositories. Use `http` (default) for private repositories — also set `git-token`."  
**Actual:** "Git authentication type: none or http"  
**Steps to reproduce:** Set `auth-type: none` on a private repository — the action completes with exit 0, Arcane clone fails silently.

---

### N2 (Low): environment-id example value '1' not labeled as placeholder

**File:** `action-readme-v2.md:24`, `action-readme-v2.md:36`  
**Severity:** Low  
**Description:** Both usage examples hard-code `environment-id: '1'`. New users copy-pasting will get a 404 from the Arcane API unless they happen to have environment ID 1. The value `'1'` reads as a real value, not a placeholder — unlike `${{ secrets.ARCANE_URL }}` which is unambiguously a variable. This is closely related to M10 (no format/location guidance) and would be resolved by the same fix.  
**Expected:** `environment-id: '<your-environment-id>'` or equivalent labeled placeholder.  
**Actual:** `environment-id: '1'` with no annotation.  
**Steps to reproduce:** Copy README example verbatim, run against a real Arcane instance.

---

### N3 (Low): sync-name-prefix collision risk undocumented for multi-repo setups

**File:** `action-readme-v2.md:79`, `action-v2.yml:76-77`  
**Severity:** Low  
**Description:** `sync-name-prefix` defaults to the GitHub repository name (short name only, not `org/repo`). If two repositories share the same short name and deploy to the same Arcane environment (e.g., `org-a/myapp` and `org-b/myapp`), their syncs will have identical names. The second deployment will match the first's syncs by name and overwrite them. No warning is emitted.  
**Expected:** The description should note that `sync-name-prefix` must be unique across all workflows deploying to the same environment, or the action should warn on name collision.  
**Actual:** No guidance on uniqueness.  
**Steps to reproduce:** Deploy two repositories with identical short names to the same Arcane environment without setting `sync-name-prefix`.

---

## Score

### Finding Delta

| Finding | v1 deduction | v2 status | Points recovered |
|---|---|---|---|
| H3 — sync-interval jq abort | -8 | Fixed | +8 |
| H5 — git-token silent requirement | -7 | Fixed | +7 |
| H6 — env-vars description wrong | -6 | Fixed | +6 |
| M9 — naming algorithm docs | -4 | Fixed | +4 |
| M10 — environment-id no format hint | -3 | Still present | 0 |
| M11 — SSH auth / none undocumented | -3 | Still present (reframed as N1) | 0 |
| L8 — arcane-api-key secrets guidance | -2 | Partially fixed | +1 |
| L13 — raw stderr for API errors | -1 | Still present | 0 |
| L15 — no compose combo example | -1 | Still present | 0 |
| N1 — auth-type: none use case missing | new | Medium | -2 |
| N2 — environment-id placeholder issue | new | Low | -1 |
| N3 — sync-name-prefix collision | new | Low | -1 |

**Starting score:** 72  
**Points recovered:** +26  
**New deductions:** -4  
**v2 score: 83/100**

---

## Summary

v2 is a genuine improvement. All three High findings are fixed with clean, well-documented validations. M9 (naming algorithm) is fixed with code comments and README documentation. The env-vars confusion that was H6 is now clearly described in all three files.

What remains is entirely in the documentation layer. No open finding will break a correctly configured deployment, but four of them (M10, M11/N1, N2, N3) will cause confusion or failed deployments during initial setup. L8 (secrets guidance) and L15 (combo example) are polish items.

### Open Items for v3

| ID | Severity | File | Action needed |
|---|---|---|---|
| M10 | Medium | `action-v2.yml:19` | Add format hint and UI location for `environment-id` |
| N1 | Medium | `action-v2.yml:50` | Document when to use `auth-type: none` vs `http` |
| L8 | Low | `action-v2.yml:15` | Add "store as a GitHub Actions secret" to `arcane-api-key` description |
| L13 | Low | `action-v2.sh:92` | Group API error body or add `::debug::` prefix |
| L15 | Low | `action-readme-v2.md` | Add example combining `compose-dir` + `compose-files` |
| N2 | Low | `action-readme-v2.md:24` | Replace `environment-id: '1'` with labeled placeholder |
| N3 | Low | `action-v2.yml:76` | Add uniqueness note to `sync-name-prefix` description |
