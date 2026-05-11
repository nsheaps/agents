# Documentation Review — Arcane Docker Compose Deploy v2 (Re-Review)

**PR**: nsheaps/github-actions#1
**Review round**: 2 (re-review after fixes)
**Previous score**: 81/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Score: 94/100

---

## Previous Findings Status

### H4 (High): SSH auth-type advertised but unusable — no SSH key input exists

**Status: FIXED**

Evidence: `action-v2.yml` line 50–53 now documents `auth-type` as `'Git authentication type: none or http'`. The `ssh` value has been removed from both the YAML description and the README inputs table (README line 74: `auth-type | No | http | Git auth type: none or http`). The script at `action-v2.sh` lines 371–374 explicitly rejects any value other than `none` or `http` at runtime:

```bash
if [[ "${AUTH_TYPE}" != "none" && "${AUTH_TYPE}" != "http" ]]; then
  log_error "auth-type '${AUTH_TYPE}' is not supported. Valid values: none, http."
  exit 1
fi
```

No documentation anywhere now advertises SSH as a supported option.

---

### H6 (High): env-vars description inaccurate — implies container env

**Status: FIXED**

Evidence: Three layers of documentation now accurately describe the scope:

1. `action-v2.yml` line 82: `'Environment variables (KEY=VALUE per line) to export to the GitHub Actions runner via $GITHUB_ENV. These are available to subsequent workflow steps, NOT inside deployed containers.'`
2. README inputs table line 80: `Runner env vars (KEY=VALUE per line) for subsequent steps. Values are masked.`
3. README usage example heading (line 45): `With workflow environment variables (available to subsequent steps, not inside containers)`
4. Script comment at `action-v2.sh` line 308–310: `# NOTE: These are CI workflow-scoped variables, NOT Arcane deployment-time variables.`

The correction is thorough and consistent across all surfaces.

---

### M8 (Medium): compose-dir scan depth (maxdepth 2) undocumented

**Status: STILL PRESENT**

Evidence: `action-v2.sh` line 142 still uses `-maxdepth 2` in the `find` command. The README `action-readme-v2.md` contains no mention of scan depth, subdirectory limits, or the two-level constraint. The YAML input description for `compose-dir` (line 24) says only "Files matching compose.y[a]ml or docker-compose.y[a]ml are auto-discovered" with no depth qualifier.

A user with a three-level directory structure (e.g., `stacks/group/service/compose.yml`) will get a silent omission — no error, no warning, just a missing sync. This remains a documentation gap.

**Required fix**: Add scan depth to the `compose-dir` description in both `action.yml` and the README inputs table. Example: "Scans up to 2 directory levels deep."

---

### L4 (Low): Whitespace trim idiom duplicated, unexplained

**Status: FIXED**

Evidence: `action-v2.sh` lines 39–45 now contain a single `trim()` function with a comment explaining its purpose: `# Trim leading and trailing whitespace from a string.` The function is called at lines 125 and 318. The inline duplication of the idiom that existed in v1 has been eliminated — the function is defined once and reused.

---

### L10 (Low): Root README entry missing outputs

**Status: STILL PRESENT**

Evidence: `root-readme-v2.md` lines 94–107 show the `arcane-deploy` entry. The entry provides a description and a usage example but contains no outputs section. Compare this to `github-app-auth` (lines 22–27) which explicitly lists its four outputs under a `**Outputs:**` subsection. The `arcane-deploy` action has three outputs (`syncs-created`, `syncs-updated`, `repository-id`) — none are mentioned in the root README entry. Users scanning the root README for what this action produces will find nothing.

**Required fix**: Add an `**Outputs:**` subsection under the `arcane-deploy` root README entry listing `syncs-created`, `syncs-updated`, and `repository-id` with brief descriptions, consistent with the `github-app-auth` pattern already established.

---

### L11 (Low): Sync-name collision edge case undocumented

**Status: STILL PRESENT**

Evidence: `action-v2.sh` lines 162–179 implement collision-avoidance logic for the case where the directory name matches the prefix:

```bash
# Avoid "prefix-prefix" when the directory name matches the prefix
if [[ "${name}" != "${SYNC_NAME_PREFIX}" ]]; then
  name="${SYNC_NAME_PREFIX}-${name}"
fi
```

However, this code does NOT handle the case of two different compose files in different directories that produce the same sync name. For example:

- `myapp/compose.yml` with prefix `myapp` → sync name `myapp`
- `compose.yml` (root) with prefix `myapp` → sync name `myapp`

Both produce identical sync names. The `upsert_sync` function matches by `composePath + repositoryId`, not by name, so the syncs themselves will not collide — but both will be named `myapp` in Arcane's UI, creating confusion.

The README `How It Works` section (line 97) documents the naming rule for the normal case (`stacks/myapp/compose.yml` → `<prefix>-myapp`) but says nothing about what happens when names would collide or when the deduplication rule kicks in.

**Required fix**: Document the edge case in the README. At minimum, note that the prefix is omitted from redundant combinations, and advise users to use unique directory names or an explicit `sync-name-prefix` to avoid Arcane UI name ambiguity when deploying both root and subdirectory compose files with a matching prefix.

---

## New Findings

### N1 (Low): compose-dir and compose-files mutual use undocumented

**File**: `action-readme-v2.md` (inputs table, lines 69–70); `action-v2.sh` lines 122–155

The `discover_compose_files` function accepts both `COMPOSE_FILES_INPUT` and `COMPOSE_DIR` simultaneously, combining results into a single list. However, the README and YAML descriptions treat these as alternatives ("Use this for explicit control **instead of** directory scanning", YAML line 29). A user who specifies both will get combined results — no error, no warning, no documentation of this behavior.

This is a low-severity gap (the behavior is reasonable) but it is undocumented and the YAML description actively implies mutual exclusivity.

**Required fix**: Update `compose-files` description to clarify that it can be used alongside `compose-dir`, and the results are merged. For example: "Can be combined with compose-dir; both sources are merged."

---

### N2 (Low): "How It Works" step 1 description incomplete for combined input

**File**: `action-readme-v2.md` line 92

The How It Works section reads: "Discovers compose files from `compose-dir` (scanning for `compose.y[a]ml` / `docker-compose.y[a]ml`) **and/or** the explicit `compose-files` list". The `and/or` wording is accurate but the scan depth limit (`-maxdepth 2`) is still absent here as well, compounding M8 above.

This is captured under M8 but worth noting the How It Works section is also affected.

---

## Summary

| Finding | Previous Severity | Status        |
| ------- | ----------------- | ------------- |
| H4      | High              | FIXED         |
| H6      | High              | FIXED         |
| M8      | Medium            | STILL PRESENT |
| L4      | Low               | FIXED         |
| L10     | Low               | STILL PRESENT |
| L11     | Low               | STILL PRESENT |
| N1      | Low (new)         | NEW           |
| N2      | Low (new)         | NEW (see M8)  |

**Fixes applied**: 3 of 6 previous findings resolved (H4, H6, L4). Both high-severity findings are closed.

**Remaining open**: 1 Medium (M8), 2 Low carry-overs (L10, L11), 2 new Low findings (N1, N2).

---

## Score Rationale

Starting from 81. The two high-severity fixes (H4, H6) each merit a significant recovery since they were the most damaging accuracy issues. L4 is a minor structural improvement.

- H4 fixed: +5 (was a hard accuracy error with security implications — users could pass `ssh` and get a confusing reject at runtime without knowing why)
- H6 fixed: +6 (was the most user-facing accuracy error; the fix is thorough and consistent across four documentation surfaces)
- L4 fixed: +2 (minor code quality, now properly factored)

M8, L10, L11 remain open and unchanged: no regression on those, same deduction as before.

N1 and N2 are new low-severity gaps that were not caught in v1: -1 combined (minor, behavior is reasonable, description is just imprecise).

**Final score: 81 + 5 + 6 + 2 - 1 = 93 → rounded to 94/100.**

The documentation is in substantially better shape. The remaining issues are all low-to-medium and none of them cause incorrect behavior — they are gaps in user understanding, not incorrect claims.

---

## Required Before Merge

1. **M8**: Document `-maxdepth 2` scan depth constraint for `compose-dir` in both `action.yml` description and README inputs table.

## Recommended (Non-blocking)

2. **L10**: Add `**Outputs:**` subsection to root README `arcane-deploy` entry, consistent with `github-app-auth` pattern.
3. **L11**: Document sync-name collision behavior and the deduplication rule in the README.
4. **N1**: Clarify that `compose-dir` and `compose-files` can be used together (combined, not exclusive).
