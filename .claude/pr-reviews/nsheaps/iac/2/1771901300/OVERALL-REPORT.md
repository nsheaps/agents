# PR Review: iac#2

**Score**: 86/100 ✅
**Verdict**: Fix then merge

---

## Category Scores

| Category         | Score | Status |
|:-----------------|------:|:-------|
| Simplicity       |    92 | ✅     |
| Flexibility      |    82 | ⚠️     |
| Usability        |    90 | ✅     |
| Documentation    |    88 | ✅     |
| Security         |    80 | ⚠️     |
| Pattern Matching |    87 | ✅     |
| Best Practices   |    83 | ⚠️     |
| General QA       |    90 | ✅     |

**Weighted average**: 86.5 → **86/100**
Three categories below 85% — verdict is COMMENT (not APPROVE).

---

## Findings

### SECURITY-1: `@main` reference for arcane-deploy action — no SHA pin (P2)

**File**: `.github/workflows/arcane-deploy.yaml:40`
**Description**: `uses: nsheaps/github-actions/.github/actions/arcane-deploy@main` references a mutable ref. Any push to `main` in `nsheaps/github-actions` silently changes what this workflow executes. This is a supply chain risk: a compromised or accidentally broken commit to `nsheaps/github-actions@main` will immediately affect deploys in this repo.
**Expected**: Pin to a commit SHA: `uses: nsheaps/github-actions/.github/actions/arcane-deploy@<sha>`
**Recommendation**: Acceptable short-term given no releases exist (per context). File a follow-up to add a release and switch to a pinned ref. Add a comment in the workflow noting the intentional use of `@main` and the tracking issue. This is the P2 blocker for a full APPROVE.

---

### SECURITY-2: `ubuntu-latest` is a non-deterministic runner (P3)

**File**: `.github/workflows/arcane-deploy.yaml:23`
**Description**: `ubuntu-latest` resolves to whatever GitHub currently considers "latest," which can change without notice. Runner image changes have historically broken workflows due to pre-installed tool version changes.
**Expected**: Pin to a specific runner version: `ubuntu-24.04`
**Recommendation**: Low urgency but worth standardizing. Check what the existing `check.yaml` uses and match it.

---

### SECURITY-3: `GIT_TOKEN` sourced from an n8n-specific 1Password item (P3)

**File**: `.github/workflows/arcane-deploy.yaml:35`
**Description**: `GIT_TOKEN: op://heapsinfra/gha--github--n8agent-pat/credential` references a PAT whose 1Password item name (`n8agent-pat`) implies it was created for n8n automation. This token is being used to authenticate git operations for all heapsnas stacks, not just n8n. If this PAT has n8n-scoped permissions or is rotated/deleted in an n8n context, all stack deployments break silently.
**Expected**: A dedicated PAT (or reuse of a clearly named generic infra PAT) for Arcane GitOps, stored under a descriptively named 1Password item (e.g., `gha--github--arcane-deploy-pat`).
**Recommendation**: Verify the PAT's actual scopes are appropriate for git read access to this repo. If it's already generic, rename the 1Password item to reflect its broader use. If it's genuinely n8n-specific, create a new PAT.

---

### FLEXIBILITY-1: `branch: main` and `compose-dir` hardcoded to heapsnas (P4)

**File**: `.github/workflows/arcane-deploy.yaml:45-49`
**Description**: `compose-dir: hosts/heapsnas`, `sync-name-prefix: heapsnas`, and `branch: main` are all hardcoded. Adding a second host (e.g., `heapsdev`) requires duplicating the workflow. The paths trigger also only covers `hosts/heapsnas/**`.
**Expected**: Either accept the one-workflow-per-host model (document it explicitly) or parameterize using a matrix strategy.
**Recommendation**: For the current single-host scope this is fine (YAGNI). Document in the README that adding a new host requires a new workflow file. This avoids future surprise.

---

### BESTPRACTICES-1: `1password/load-secrets-action` and `actions/checkout` not SHA-pinned (P4)

**File**: `.github/workflows/arcane-deploy.yaml:29,37`
**Description**: Both `1password/load-secrets-action@v3` and `actions/checkout@v4` are pinned to major version tags, not commit SHAs. While these are well-maintained actions from trusted publishers, major version tags are mutable.
**Expected**: `uses: 1password/load-secrets-action@<sha>` and `uses: actions/checkout@<sha>`
**Recommendation**: Low priority. Consistent with most CI patterns in the wild. If the project has a Dependabot/Renovate config that auto-updates action SHAs, this is already handled. Otherwise, note for a future hardening pass.

---

### DOCS-1: README links to github-actions repo, not the specific action (P4)

**File**: `README.md:81`
**Description**: `[arcane-deploy](https://github.com/nsheaps/github-actions)` links to the repository root. A reader trying to understand what the action does has to navigate the repo themselves.
**Expected**: Link directly to the action: `https://github.com/nsheaps/github-actions/tree/main/.github/actions/arcane-deploy`
**Recommendation**: Minor usability improvement. Fix in a follow-up commit or alongside any other README touch.

---

## What's Good

- **Concurrency config is correct**: `cancel-in-progress: false` with a named group is exactly right for deploy workflows. Deploys serialize, not cancel.
- **Paths trigger is correct**: Watching `hosts/heapsnas/**` and the workflow file itself. Won't fire on unrelated changes.
- **Permissions are minimal**: `contents: read` only. No write permissions granted unnecessarily.
- **Secrets via 1Password**: No secrets in environment variables or repo secrets directly. Clean pattern.
- **Docker image updates**: Both `cloudflared` and `n8n` bump to newer versions with SHA pins on `n8n`. The cloudflared image is pinned by both tag and SHA digest — good hygiene.
- **README is substantially improved**: Clear structure, actionable "Adding a new stack" section, legacy Portainer section preserved appropriately, repo rename reflected consistently.
- **Dependency maintenance**: nx 22.1.1 → 22.5.1, prettier 3.6.2 → 3.8.1, yarn 4.11.0 → 4.12.0 are all routine bumps with correct lockfile updates.

---

## Summary

This is a clean, well-scoped PR. The workflow is minimal, correctly configured for a deploy use case (serialized, not cancelled), and uses 1Password for secrets appropriately. The `@main` action ref is the only finding worth discussing before merge — it's a deliberate trade-off given no releases exist, but it should be called out explicitly in the workflow as a comment, and tracked as a follow-up. The other findings are hygiene items (P3/P4) that can be addressed in follow-on work.

**Recommended path to merge**: Add a `# TODO: pin to SHA once github-actions has a release` comment on line 40, confirm the `gha--github--n8agent-pat` PAT scope is appropriate for this use, then merge.

---

*Reviewed by Daffy D (qa) — 2026-02-23*
