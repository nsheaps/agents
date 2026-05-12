## Review: .github#17 — 1Password secrets sync workflow — Score: 88/100

| Category         | Score | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :--------------- | ----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --------------------------------------------------------------------------------------------------------- |
| Simplicity       |    90 | Thin workflow, delegates all logic to the reusable action. `dry_run` input is a clean affordance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Flexibility      |    88 | `workflow_dispatch` with `dry_run` input is good. Weekly schedule (`0 6 * * 1`) ensures secrets don't drift. Path-based trigger on `secret-sync.yaml` is precise.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Usability        |    90 | Config file format is well-documented with inline comments explaining the format, including the `name` override pattern. Manual setup requirements are explicitly documented in comments.                                                                                                                                                                                                                                                                                                                                                                                                               |
| Documentation    |    88 | The `secret-sync.yaml` config comments are excellent — format, field descriptions, and human setup steps are all in-file. The workflow itself has minimal comments (delegates to action).                                                                                                                                                                                                                                                                                                                                                                                                               |
| Security         |    85 | `permissions: contents: read` is appropriately minimal. `OP_SERVICE_ACCOUNT_TOKEN` and `SECRET_SYNC_PAT` are passed as inputs, not hardcoded. The workflow uses `secrets.*` correctly. Concern: the config file `secret-sync.yaml` is **committed to the public repo** — it contains `op://` secret paths. While these are not secret values themselves (they're references, not secrets), they do reveal the internal structure of 1Password vaults (`op://ci-cd/github-automation-app/app-id`). This could assist an attacker who gains partial 1Password access in knowing exactly what to look for. |
| Pattern Matching |    88 | References `nsheaps/github-actions/.github/actions/1password-secret-sync@main` — pinned to `@main` not a commit SHA. For a secrets management workflow, this is a security concern: a compromised `main` branch in github-actions could exfiltrate all secrets.                                                                                                                                                                                                                                                                                                                                         |
| Best Practices   |    87 | Weekly schedule is appropriate for drift prevention. Dry-run capability is essential for a secrets workflow. The `dry_run                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |     | 'false'` pattern correctly handles the case where the input is undefined when triggered by push/schedule. |
| General QA       |    85 | The `secret-sync.yaml` lists 7 target repos for `AUTOMATION_GITHUB_APP_ID` and only 7 for `AUTOMATION_GITHUB_APP_PRIVATE_KEY`. Both lists are identical — any future mismatch (adding a target to one but not the other) would result in a repo having the APP_ID but not the private key. Consider grouping them as a single secret entry with multiple fields, or adding a comment warning that both must be kept in sync.                                                                                                                                                                            |

> ✅ All categories ≥85% — Ready to merge with noted concerns

---

### Findings

#### P2 — High

**File**: `.github/workflows/sync-secrets.yaml:79`
**Severity**: High
**Description**: The workflow calls `nsheaps/github-actions/.github/actions/1password-secret-sync@main`. Pinning to `@main` rather than a commit SHA means any push to the `main` branch of `github-actions` repo will immediately affect this workflow. For a workflow that reads 1Password service account tokens and PATs and writes them to multiple repos, a supply chain compromise of `github-actions@main` could silently exfiltrate all secrets. This is the same concern as Actions security best practice.
**Expected**: `nsheaps/github-actions/.github/actions/1password-secret-sync@<commit-sha>` or at minimum a versioned tag
**Actual**: `@main` reference
**Reference**: [GitHub: Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions)

---

#### P3 — Medium

**File**: `.github/secret-sync.yaml:25-46`
**Severity**: Medium
**Description**: `AUTOMATION_GITHUB_APP_ID` and `AUTOMATION_GITHUB_APP_PRIVATE_KEY` each have independent `targets` lists with the same 7 repos. These must always be in sync — a repo with one but not the other will have non-functional GitHub App auth. No validation exists to catch this drift. Consider a config format that groups related secrets, or add a comment block explicitly warning maintainers.
**Expected**: Grouped entries or explicit coupling documentation
**Actual**: Two parallel identical lists that can independently drift

---

**File**: `.github/secret-sync.yaml:1` (committed to repo)
**Severity**: Medium
**Description**: The file reveals internal 1Password vault structure: `op://ci-cd/github-automation-app/app-id` and `op://ci-cd/github-automation-app/private-key`. The vault name (`ci-cd`) and item name (`github-automation-app`) are now public. While not directly exploitable, it reduces defense-in-depth for 1Password security. This may be acceptable for a private repo but worth noting if the repo is public.
**Expected**: Consider whether 1Password vault paths should be public-visible
**Actual**: Vault/item names committed to source

---

### What's Done Well

- Using a 1Password service account token (read-only) for secret retrieval is the right pattern — minimal privilege
- The weekly schedule (`0 6 * * 1`) combined with the path trigger ensures regular rotation check without spam
- `dry_run` capability makes this safe to test without side effects
- Using a GitHub App for cross-repo secret writes is better than a broad PAT — App tokens are scoped and auditable
- The `secret-sync.yaml` config format with `targets[]` and optional `name` override is flexible enough for org-scale secret management

### Verdict

**Fix the action pinning before merge.** The `@main` reference for a secrets-writing workflow is a P2 security concern. The other findings are informational. Pin the action to a specific commit SHA, then this is ready to merge.
