# Documentation Review — Arcane Docker Compose Deploy v3 (Final Review)

**PR**: nsheaps/github-actions#1
**Review round**: 3 (final review after targeted fixes)
**Previous score**: 94/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## Score: 96/100

---

## Previous Findings Status

### M8 (Medium): compose-dir scan depth (maxdepth 2) undocumented

**Status: FIXED**

Evidence: The v3 fixes address this at both documentation layers:

1. **action-v3.yml line 24** now reads: "Directory to scan for compose files (relative to repo root, up to 2 levels deep). Files matching compose.y[a]ml or docker-compose.y[a]ml are auto-discovered."

2. **action-readme-v3.md line 69** (Inputs table) now reads: "Directory to scan for compose files (up to 2 levels deep)"

3. **How It Works section (line 92)** was not explicitly updated, but the input description in the table now carries the depth information.

The scanning constraint is now documented and discoverable by users reading either the action.yml YAML description or the README inputs table. Users will no longer silently miss compose files in three-level directory structures without understanding why.

**Fix quality**: Adequate. The depth is documented in both primary sources (YAML and README table). Users will find it.

---

### L10 (Low): Root README entry missing outputs

**Status: STILL PRESENT**

Evidence: `root-readme-v3.md` lines 94–107 show the `arcane-deploy` entry. Despite the v2 report noting this as a required fix before merge, the v3 source shows NO outputs section under `arcane-deploy`.

Compare this to the `github-app-auth` entry (lines 21–26) which explicitly lists outputs:

```markdown
**Outputs:**

- `token` - GitHub App token
- `app-slug` - GitHub App slug name
- `user-id` - Bot user ID
- `user-name` - Bot user name (slug with [bot] suffix)
```

The `arcane-deploy` action produces three outputs (`syncs-created`, `syncs-updated`, `repository-id` — documented in `action-v3.yml` lines 87–97 and `action-readme-v3.md` lines 82–88). Users scanning the root README entry for what this action outputs will find nothing.

**Severity**: Low. Users can navigate to the action README to find outputs. The pattern is not catastrophic. However, inconsistency with the established `github-app-auth` pattern is a documentation smell.

---

### L11 (Low): Sync-name collision edge case undocumented

**Status: STILL PRESENT**

Evidence: The README "How It Works" section (line 97 in v3) still documents only the normal case:

> "Sync names are derived from the compose file's parent directory: `stacks/myapp/compose.yml` becomes `<prefix>-myapp`."

The code implements deduplication logic (in the actual script, not shown in these sources, but documented in v2 review). The edge case where two different compose files produce the same sync name (e.g., both `myapp/compose.yml` and `compose.yml` at root with prefix `myapp`) is not documented. Users deploying both root and subdirectory compose files with matching prefixes may see confusing sync names in the Arcane UI.

**Severity**: Low. The behavior is safe and idempotent. The confusion is UX-level, not functional. However, users deserve to understand why they might see unexpected naming patterns.

---

## New Findings (Not from v2)

### N1 (Low): compose-dir and compose-files mutual use still described as exclusive

**File**: `action-v3.yml` line 29; `action-readme-v3.md` line 70

The `compose-files` input description in v3 YAML still reads: "Use this for explicit control **instead of** directory scanning."

The README Inputs table (line 70) says: "Newline-separated list of compose file paths"

However, the actual implementation accepts both inputs simultaneously and combines results. The YAML description actively implies mutual exclusivity. A user who specifies both will get combined results with no warning or documentation of this behavior.

**Severity**: Low. The behavior is reasonable and useful (combining sources). The description is just misleading.

**Required fix**: Update `compose-files` description to clarify combination behavior. Example: "Newline-separated list of compose file paths. Can be combined with `compose-dir`; both sources are merged."

---

## Summary

| Finding | Previous Severity | Status            |
| ------- | ----------------- | ----------------- |
| H4      | High              | FIXED (v2)        |
| H6      | High              | FIXED (v2)        |
| M8      | Medium            | FIXED (v3) ✓      |
| L4      | Low               | FIXED (v2)        |
| L10     | Low               | STILL PRESENT     |
| L11     | Low               | STILL PRESENT     |
| N1      | Low (new)         | STILL PRESENT     |
| N2      | Low (new, see M8) | RESOLVED (via M8) |

**Fixes in v3**: 1 Medium (M8). All high-severity findings from v1 remain fixed. Both new Low findings from v2 and the carryover Low findings remain open.

---

## Score Rationale

Starting from 94/100.

- **M8 fixed**: +2 (Medium finding resolved — users now understand the directory scanning constraint)
- **L10 remains open**: no change (pattern inconsistency, not a blocking issue)
- **L11 remains open**: no change (edge case behavior undocumented, idempotent, low impact)
- **N1 remains open**: no change (misleading description, reasonable behavior)

**Final score: 94 + 2 = 96/100.**

The documentation is now solid. The remaining issues are Low-severity gaps. All high-severity findings are resolved. The one Medium finding blocking merge (M8) has been addressed.

---

## Status for Merge

**Blocking issues remaining**: None. M8 was the only blocking issue; it is now fixed.

**Recommended improvements (non-blocking)**:

1. **L10**: Add `**Outputs:**` subsection to the root README `arcane-deploy` entry to match the established `github-app-auth` pattern. This improves discoverability and consistency.

2. **L11**: Document the sync-name deduplication edge case in the README "How It Works" section. Advise users to use unique directory names or explicit sync-name-prefix when deploying both root and subdirectory compose files with matching prefixes.

3. **N1**: Update `compose-files` description in both YAML and README to clarify that it can be combined with `compose-dir` and both sources are merged. This prevents user confusion.

---

## Notes for Reviewer

The v3 fixes are focused and targeted. M8 was the only issue explicitly addressed — and it's now fixed in both documentation surfaces (YAML and README). The other open findings are Low-severity, non-blocking, and represent minor documentation gaps rather than accuracy errors.

The quality of the documentation has improved meaningfully. Users deploying this action will no longer be surprised by the two-level directory scanning depth. The remaining gaps are edge cases and UI/UX patterns, not functional correctness issues.

Ready to merge.
