## Review: .github#16 — label sync workflow — Score: 84/100

| Category         | Score | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :--------------- | ----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simplicity       |    88 | Clean, focused workflow. Matrix strategy for multi-repo sync is the right approach. Label YAML is simple and readable.                                                                                                                                                                                                                                                                                                               |
| Flexibility      |    82 | Repo list is hardcoded in the matrix. Adding a new org repo requires a PR to this file. No mechanism for per-repo label overrides.                                                                                                                                                                                                                                                                                                   |
| Usability        |    85 | `workflow_dispatch` provides manual trigger. `fail-fast: false` correctly ensures one repo failure doesn't block others. Clear label descriptions.                                                                                                                                                                                                                                                                                   |
| Documentation    |    80 | No README or inline comments explain WHY specific labels exist, particularly the custom `p1-p4` priority labels or `needs-human-attention`. The file comment references `Financial-Times/github-label-sync` but the npm package installed is `github-label-sync` — same package, but the comment is confusing.                                                                                                                       |
| Security         |    85 | GitHub App token generation scoped to `github.repository_owner`. `permissions: contents: read` is appropriately minimal. Token is used via environment variable, not exposed in logs. The `${{ matrix.repo }}` substitution in the `run` block is a potential shell injection risk if a repo name contained special characters — however, since this is a hardcoded matrix with fixed values, the risk is theoretical not practical. |
| Pattern Matching |    83 | Follows GitHub Actions workflow conventions. Uses `actions/checkout@v4`, `actions/setup-node@v4`, `actions/create-github-app-token@v2` — all current versions. No pinned commit SHAs (minor concern for supply chain security).                                                                                                                                                                                                      |
| Best Practices   |    82 | npm installed globally with `npm install -g` in CI — no lockfile, version is uncontrolled beyond the latest at install time. Should pin to a specific version: `npm install -g github-label-sync@2.x.x`. The `--allow-added-labels` flag means repos can accumulate extra labels over time and the sync won't clean them up — this is intentional but worth documenting.                                                             |
| General QA       |    82 | The `if: ${{ secrets.AUTOMATION_GITHUB_APP_ID != '' }}` condition on the job will silently skip the entire job if the secret is not set, with no visible feedback. An author seeing a skipped job may not immediately understand why.                                                                                                                                                                                                |

> ⚠️ Multiple categories below 85% — Needs fixes or clarifications

---

### Findings

#### P3 — Medium

**File**: `.github/workflows/sync-labels.yaml:132`
**Severity**: Medium
**Description**: `npm install -g github-label-sync` installs whatever version is current at workflow run time. This makes the workflow non-reproducible — a breaking release of `github-label-sync` would silently start failing. Should pin to a specific version.
**Expected**: `npm install -g github-label-sync@2.3.3` (or latest stable at time of authoring)
**Actual**: Unpinned global install

---

**File**: `.github/workflows/sync-labels.yaml:94`
**Severity**: Medium
**Description**: `if: ${{ secrets.AUTOMATION_GITHUB_APP_ID != '' }}` silently skips the job when the secret is absent. No failure, no warning in the UI. For a sync workflow, a skipped run is operationally indistinguishable from a successful run unless you know to look. Consider using `continue-on-error: false` with a check step that explicitly fails with a helpful error, or at minimum add a job that notifies when skipped.
**Expected**: Explicit error or visible warning when prerequisites are missing
**Actual**: Silent skip

---

#### P4 — Info

**File**: `.github/labels.yaml:8`
**Severity**: Info
**Description**: File comment says "Synced by Financial-Times/github-label-sync" — this refers to the GitHub org (`Financial-Times`) that develops the npm package, not a different tool. The comment is accurate but potentially confusing — someone might search for a `Financial-Times` action that doesn't exist. Clarify as: "Synced using the `github-label-sync` npm package (https://github.com/Financial-Times/github-label-sync)".

---

**File**: `.github/labels.yaml` (no pin on Actions used in the workflow)
**Severity**: Info
**Description**: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/create-github-app-token@v2` are version-pinned to major versions but not to commit SHAs. For a workflow writing to external repos (modifying labels across the org), pinning to commit SHAs provides additional supply chain security guarantees.

---

### What's Done Well

- `fail-fast: false` in the matrix strategy is correct — one repo failure shouldn't block all others
- `max-parallel: 5` prevents GitHub API rate limiting from serial requests
- The `ready` and `needs-human-attention` labels are clearly purpose-built for the QA workflow — good integration with the review-changes score system
- The `p1-p4` priority labels align with the P1-P4 severity levels used in review-changes — consistent taxonomy across the org toolchain

### Verdict

**Fix then merge.** The unpinned `github-label-sync` version is the most actionable fix. The silent-skip behavior is a UX concern worth addressing. Both are P3 — not blocking, but worth a quick fix before this runs in production.
