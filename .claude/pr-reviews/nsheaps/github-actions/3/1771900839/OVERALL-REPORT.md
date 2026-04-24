## Review: github-actions#3 — 1Password secret sync action — Score: 80/100

| Category         | Score | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :--------------- | ----: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Simplicity       |    82 | The single-shell composite action is appropriate. The inline `yq` installation is a side effect that adds complexity — it should be a separate step or a prerequisite check.                                                                                                                                                                                                                                                                                                                   |
| Flexibility      |    85 | Good input design: `config-file`, `op-service-account-token`, `github-token`, `dry-run`. Output `synced-count` and `skipped-count` are useful for downstream steps.                                                                                                                                                                                                                                                                                                                            |
| Usability        |    83 | Clear input descriptions. The `dry-run` parameter works correctly. Error messages use `::error::` format (visible in Actions UI). The README example is accurate and copy-pasteable.                                                                                                                                                                                                                                                                                                           |
| Documentation    |    82 | README describes the action and outputs. The inline script has comments explaining major sections. The `# Validate we can authenticate with 1Password` comment is helpful. Concerns: no documentation on why yq is used over Python/jq for YAML parsing, and no explanation of the `${source:0:20}...` truncation in group names.                                                                                                                                                              |
| Security         |    70 | **Critical concerns (see below)**: Secret value is stored in a bash variable `value` and echoed via `echo "$value" \| gh secret set`. The `::add-mask::` is applied AFTER the secret is read — a brief window exists where the value could appear in logs if the echo between read and mask fails. More critically: the `op read "$source" 2>&1` pattern captures stderr (which could include the secret value in some error cases) into `value`. The secret is also echoed via `echo "$value" | gh secret set` which creates a subprocess — this is generally safe but worth noting. |
| Pattern Matching |    83 | Follows composite action conventions with `shell: bash`. Uses `1password/install-cli-action@v2` for 1Password CLI. The `action.yml` extension differs from the repo's `.yaml` convention (file-extensions rule) — `action.yml` is the GitHub Actions standard though, so this is a standard vs. convention conflict.                                                                                                                                                                           |
| Best Practices   |    78 | The `yq` binary is downloaded from GitHub releases via `curl -fsSL` without checksum verification. This is a supply chain risk — a MITM or compromised GitHub release could inject malicious code into the workflow. Also: `errors` counter is tracked but the script exits with `exit 1` only if `errors > 0` at the end — individual errors don't abort the loop, which is intentional but means partial sync is possible with no intermediate feedback.                                     |
| General QA       |    75 | The `op read "$source" 2>&1` redirect merges stderr into stdout, assigning any error message to `value`. If 1Password returns a verbose error (e.g., "Account not found. Try signing in first."), that error string is then passed to `gh secret set` as the secret value — silently writing the error message as the secret. The `2>&1` should be removed, with stderr going to stderr and the exit code handling the failure.                                                                |

> ⚠️ Security (70%) and General QA (75%) below 85% — Needs fixes

---

### Findings

#### P1 — Critical

**File**: `.github/actions/1password-secret-sync/action.yml:97-103`
**Severity**: Critical
**Description**: `value=$(op read "$source" 2>&1)` redirects stderr to stdout, merging error output into the `value` variable. If `op read` fails with an error message (e.g., "Error: The specified item was not found"), the error message is assigned to `value`. The subsequent `|| { echo "::error::..." ; continue }` does catch non-zero exit codes, BUT `op read` in some error scenarios may exit 0 while printing an error to stderr. The result: an error string gets written to GitHub as the secret value via `gh secret set`.
**Expected**: `value=$(op read "$source")` — stderr to stderr, not to value variable
**Actual**: `value=$(op read "$source" 2>&1)` — error messages can become the secret value
**Steps to reproduce**: Provide an invalid 1Password path that returns an error message — observe if the error message is written as the secret value

---

#### P2 — High

**File**: `.github/actions/1password-secret-sync/action.yml:79-82`
**Severity**: High
**Description**: `yq` is installed by downloading a binary from GitHub releases without checksum verification: `curl -fsSL "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64" -o /usr/local/bin/yq`. A compromised GitHub release artifact, DNS hijack, or MITM could substitute a malicious binary. For a workflow processing 1Password tokens, this is significant.
**Expected**: Checksum verification after download: `echo "<expected-sha256>  /usr/local/bin/yq" | sha256sum -c`
**Actual**: No integrity check on downloaded binary
**Reference**: [GitHub Actions supply chain security](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions)

---

**File**: `.github/actions/1password-secret-sync/action.yml:104-106`
**Severity**: High
**Description**: `::add-mask::$value` is called AFTER `echo "Successfully read secret '$name' from 1Password"`. If `value` is somehow interpolated into the success message (it's not currently, but this is fragile), or if the mask is applied too late for some log buffering reason, the secret value could appear unmasked in earlier log output. The mask should be applied immediately after the value is read, before any other echo.
**Expected**: `echo "::add-mask::$value"` immediately after `value=$(op read ...)`, before any other output
**Actual**: One `echo` statement between value assignment and masking

---

#### P3 — Medium

**File**: `.github/actions/1password-secret-sync/action.yml:77-83`
**Severity**: Medium
**Description**: The `yq` installation check `if ! command -v yq &> /dev/null` installs to `/usr/local/bin/yq`. This requires root/sudo permissions in the runner. GitHub-hosted runners run as `runner` with sudo, but self-hosted runners may not. The install will silently fail or require different handling on non-root runners.
**Expected**: Document the runner permission requirement, or use a user-local path like `~/.local/bin/`
**Actual**: Hardcoded `/usr/local/bin/` path without permission check

---

**File**: `.github/actions/1password-secret-sync/action.yml:117-123`
**Severity**: Medium
**Description**: `echo "$value" | gh secret set "$target_name" --repo "$target_repo" --body -` — this pattern is generally safe, but `$value` in the error case fallback (`echo "::warning::Failed to set..."`) doesn't increment `errors` properly when `gh secret set` fails — it increments `errors` but the `skipped` count for dry-run includes both actually-skipped and hard-error cases in the summary (`skipped_count=$skipped`), which is misleading in dry-run output that mixed with failures.
**Expected**: Separate `errors` count from `skipped` count in output and summary
**Actual**: Dry-run skips and errors may both increment confusingly

---

#### P4 — Info

**File**: `.github/actions/1password-secret-sync/action.yml:94`
**Severity**: Info
**Description**: The log group name `Secret: $name (source: ${source:0:20}..., $target_count targets)` truncates the source path to 20 characters. This may not show enough of the path to identify which secret is being processed in long paths like `op://ci-cd/github-automation-app/private-key`. Consider 30-40 characters or show the last component (after the final `/`).

---

**File**: `.github/actions/1password-secret-sync/action.yml`
**Severity**: Info
**Description**: `action.yml` extension used instead of `action.yaml`. The project rule (`.ai/rules/file-extensions.md`) specifies `.yaml` over `.yml`. However, GitHub Actions documentation uses `action.yml` as the standard. This is a convention conflict — worth noting but the GitHub standard likely takes precedence here.

---

### What's Done Well

- `set -euo pipefail` is present — good baseline shell safety
- `1password/install-cli-action@v2` is the right way to install the 1Password CLI in Actions
- `::add-mask::$value` is used to mask secrets in logs — correct pattern
- `::group::` / `::endgroup::` is used for log organization — improves debugging
- The error counter pattern with `continue` on failures is correct — single secret failures don't abort the whole sync
- `echo "synced_count=$synced" >> "$GITHUB_OUTPUT"` uses the correct GITHUB_OUTPUT format (not the deprecated `set-output` command)
- Dry-run mode is correctly implemented and respected throughout the loop

### Verdict

**Must fix P1 and P2 before merge.** The `2>&1` on the `op read` command is a correctness bug — it can silently write error messages as secret values. The missing checksum on the `yq` download is a supply chain security concern for a secrets-handling action. The mask timing issue is borderline P2 — move `::add-mask::` immediately after value assignment.

Priority fixes:

1. Change `value=$(op read "$source" 2>&1)` to `value=$(op read "$source")` — line 97
2. Add checksum verification after yq download — lines 79-82
3. Move `::add-mask::$value` to immediately after value assignment — line 105
