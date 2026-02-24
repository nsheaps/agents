# PR Review: iac#1

**Score**: 82/100 ⚠️
**Verdict**: Fix then merge

## Category Scores

| Category | Score | Status |
|:---------|------:|:-------|
| Simplicity | 92 | Pass |
| Flexibility | 88 | Pass |
| Usability | 91 | Pass |
| Documentation | 93 | Pass |
| Security | 72 | Below threshold |
| Pattern Matching | 88 | Pass |
| Best Practices | 79 | Below threshold |
| General QA | 80 | Below threshold |

> Score capped at 94: categories Security (72), Best Practices (79), and General QA (80) are below 85%.

---

## Findings

### security-1: Hardcoded placeholder VAULT_NAME appears in committed artifacts (P2)

**File**: `github-org/.env.op:9`, `.github/workflows/pulumi-deploy.yaml:35`, `.github/workflows/pulumi-preview.yaml:87`

**Description**: All 1Password secret references use the literal string `VAULT_NAME` as the vault identifier (e.g., `op://VAULT_NAME/github-org-pulumi/token`). This is explicitly a placeholder — the actual vault name has not been substituted. In CI, the `1password/load-secrets-action` will attempt to resolve `op://VAULT_NAME/...` and fail at runtime. This is not a secrets leak, but it IS a broken configuration that will cause every CI run to fail immediately.

**Expected**: The vault name should be replaced with the actual 1Password vault name before merging, or alternatively parameterized via a GitHub Actions variable (e.g., `vars.OP_VAULT_NAME`) so the placeholder is explicit and overridable.

**Actual**: `VAULT_NAME` is committed as-is across three files.

**Steps to reproduce**: Merge this PR and trigger `pulumi-deploy.yaml` or `pulumi-preview.yaml` — the `load-secrets-action` step will fail because `op://VAULT_NAME/...` is not a resolvable vault path.

---

### security-2: ACCOUNT_ID placeholder in R2 endpoint is not documented as required substitution (P3)

**File**: `bin/pulumi-wrapper.sh:18`

**Description**: The R2 endpoint defaults to `https://ACCOUNT_ID.r2.cloudflarestorage.com` with a literal `ACCOUNT_ID` placeholder. Unlike the R2 credentials (which are commented out pending provisioning), this default will be silently used if `PULUMI_R2_ENDPOINT` is not set AND R2 credentials become available. The wrapper would then build a nonsensical backend URL and fail confusingly.

**Expected**: Either document clearly that `PULUMI_R2_ENDPOINT` MUST be set before R2 credentials are enabled, or use an empty/unset default that causes an explicit failure rather than constructing a broken URL.

**Recommendation**: Add a guard in `detect_backend()`:
```bash
if [[ "${R2_ENDPOINT}" == *"ACCOUNT_ID"* ]]; then
  echo "ERROR: PULUMI_R2_ENDPOINT is not configured. Set it before enabling R2." >&2
  exit 1
fi
```

---

### security-3: CI workflow grants pull-requests: write with no PR source restriction (P3)

**File**: `.github/workflows/pulumi-preview.yaml:77`

**Description**: The preview workflow grants `pull-requests: write` permission (needed for PR comments). However, the workflow triggers on `pull_request` with no restriction on fork PRs. If a fork PR is opened, the workflow will run in a context where `OP_SERVICE_TOKEN` is not available (GitHub Actions does not expose secrets to fork PRs), but the permission grant itself is still present. This is a defense-in-depth gap: if a future maintainer adds `pull_request_target` or adjusts the trigger, write access to PRs from untrusted forks becomes a risk.

**Expected**: Either add `if: github.event.pull_request.head.repo.full_name == github.repository` guards on steps that use secrets, or document explicitly why fork PRs are expected to fail safely.

**Recommendation**: Add a `if: github.event.pull_request.head.repo.full_name == github.repository` condition to the `Load secrets from 1Password` step to make the fork-safe boundary explicit.

---

### best-practices-1: `pulumi = "latest"` in mise.toml is a reproducibility hazard (P2)

**File**: `mise.toml:6`

**Description**: Using `pulumi = "latest"` in mise.toml means the Pulumi version is not pinned. Any developer running `mise install` on a different day may get a different Pulumi version than CI. This is particularly dangerous for IaC tools where provider schema compatibility, state file format compatibility, and resource behavior can vary between minor versions.

**Expected**: Pin to a specific Pulumi version (e.g., `pulumi = "3.157.0"`).

**Actual**: `pulumi = "latest"` is committed.

**Steps to reproduce**: Wait for a new Pulumi release, run `mise install` — you now have a different version than whoever last ran it.

---

### best-practices-2: No stack state file is committed or documented for bootstrapping (P3)

**File**: `github-org/Pulumi.yaml` (general)

**Description**: The local `file://` backend stores state in `.pulumi-state/` which is gitignored. A new contributor who clones the repo and runs `mise run pulumi:preview --stack prod` will fail because there is no local stack initialized. The README mentions `mise run pulumi:stack-init dev` but there is no documented procedure for initializing the `prod` stack on a clean clone with the `file://` backend. This is a genuine onboarding gap — `pulumi preview` will error with "no stack selected" or "stack not found."

**Expected**: Either commit an initial stack reference, document the exact bootstrap steps (`pulumi stack init prod` with the file backend), or switch to R2 (which holds shared state) before merging and enabling CI.

**Recommendation**: Add a "Bootstrap from scratch" section to `github-org/README.md` that covers the exact commands needed to initialize a clean `prod` stack against the file backend.

---

### best-practices-3: Branch protection sets `requiredApprovingReviewCount: 0` (P3)

**File**: `github-org/Pulumi.yaml:38`

**Description**: The `iac-main-protection` resource sets `requiredApprovingReviewCount: 0`. This means PRs to `main` require no approving reviews — only the `check` status check. For an IaC repo where PRs directly trigger infrastructure changes, zero required reviews is a notable risk: a single developer can open a PR, pass CI, and merge — triggering a `pulumi up` with no second pair of eyes on the diff.

**Expected**: At minimum, `requiredApprovingReviewCount: 1` for an infrastructure repository.

**Note**: This is flagged as P3 rather than P2 because it's a solo-owner repo and this may be an intentional choice. However, it should be a documented decision, not an implicit default.

---

### general-qa-1: `pulumi-wrapper.sh` does not guard for missing `pulumi` binary (P3)

**File**: `bin/pulumi-wrapper.sh:44`

**Description**: The wrapper's `main()` function calls `exec pulumi ...` without first verifying that the `pulumi` binary is on `PATH`. If `mise install` has not been run, the error will be a generic `command not found: pulumi` with no hint about what to do.

**Expected**: A guard at the top of `main()`:
```bash
if ! command -v pulumi &>/dev/null; then
  echo "ERROR: pulumi not found. Run 'mise install' first." >&2
  exit 1
fi
```

---

### general-qa-2: `bots-iac-access` grants `push` permission to bots team on the iac repo (P3)

**File**: `github-org/Pulumi.yaml:55`

**Description**: The `bots-iac-access` resource grants the `bots` team `push` permission on the `iac` repository. `push` access allows force-push (unless branch protection blocks it) and direct pushes to non-protected branches. For a team described as "bot accounts and automation service accounts," `triage` or `pull` might be more appropriate unless specific write access is needed. The comment says "bot accounts and automation" but does not explain why they need write access to the IaC repo.

**Expected**: A comment explaining the justification for `push` vs a lower permission level, OR downgrade to `triage` if the bots only need to comment/label.

---

### general-qa-3: `.mise/tasks/pulumi/stack-init` passes args directly allowing `stack init <anything>` (P4)

**File**: `.mise/tasks/pulumi/stack-init:5`

**Description**: The `stack-init` task runs `bin/pulumi-wrapper.sh stack init "$@"` — passing all arguments directly to pulumi. This is intentional for flexibility, but the MISE usage comment (`stack-init <stack-name>`) doesn't warn that running without a stack name arg will fail with a cryptic pulumi error.

**Recommendation**: Minor polish — either add argument validation in the task or update the description to note that `<stack-name>` is required.

---

### general-qa-4: n8n image now has digest pinned but cloudflared image was already pinned — inconsistency was partially addressed (P4)

**File**: `hosts/heapsnas/n8n/docker-compose.yaml:7`

**Description**: The n8n image was updated from `1.116.0` (no digest) to `1.123.0@sha256:...` (with digest). The cloudflared image already had a digest. This is good — but the change also bumped cloudflared from `2025.11.1` to `2026.2.0`. Both changes are in the same PR as the Pulumi setup, making the diff harder to review. These are unrelated changes mixed into a Pulumi setup PR.

**Recommendation**: Separate container image bumps from infrastructure scaffolding in future PRs. Not a blocker, but noted.

---

## Summary

This is a solid initial Pulumi setup — the wrapper script's backend auto-detection is thoughtful, the docs are well-written with a useful Terraform comparison table, and the 1Password integration pattern is correct and safe. However, three issues require attention before merging: the `VAULT_NAME` placeholder across three files will cause CI to fail immediately (security-1), `pulumi = "latest"` breaks reproducibility for an IaC tool where version pinning matters (best-practices-1), and there is no documented path for a new contributor to initialize the `prod` stack from scratch on the file backend (best-practices-2). The zero-required-reviewers branch protection setting (best-practices-3) should also be an explicit documented decision rather than an unchallenged default for an infrastructure repository.
