# 1Password Secrets Sync Best Practices

**Author**: Road Runner (Deep Researcher)
**Date**: 2026-02-23
**Scope**: Best practices for syncing 1Password secrets to GitHub repo secrets, op-exec patterns, security considerations
**Confidence**: High (official docs + community patterns + existing codebase analysis)
**Informs**: Task [#18](https://github.com/nsheaps/agent-team/issues/18) (Create 1Password secrets sync workflow in nsheaps/.github)

---

## Question

What are the best practices for syncing 1Password secrets to GitHub repository secrets via reusable workflows? How does `op-exec` recursive resolution work, and what are the security considerations?

## Answer

The recommended approach is a **GitHub Actions reusable workflow** that uses **1Password Service Accounts** with the official `1password/install-cli-action` + `op read` + `gh secret set` pattern. The existing `op-exec` script in ai-mktpl provides a solid foundation for local use but needs adaptation for CI/CD. Recursive resolution is a custom feature (not natively supported by 1Password) and should be used cautiously.

---

## 1. Existing Infrastructure

### op-exec Script (`ai-mktpl/bin/op-exec`)

The org already has a working `op-exec` wrapper at `ai-mktpl/bin/op-exec` that:

- Fetches a 1Password item's fields as environment variables
- Recursively resolves `op://` references (up to depth 5)
- Converts field labels to valid env var names (e.g., "API Key" → `API_KEY`)
- Supports both "export mode" (print exports) and "exec mode" (run command with secrets)
- Filters to STRING and CONCEALED field types only
- Currently a POC with limitations: no section handling, flat items only

**Key finding**: The recursive resolution feature is custom — 1Password's native `op run` and `op read` do NOT support recursive resolution of secrets containing `op://` references. This is confirmed by the absence of any mention in official docs.

### claude-auth GitHub Action (`ai-mktpl/.github/actions/claude-auth/`)

Supports three providers: raw (GitHub secrets), Doppler, and 1Password. The 1Password integration uses:

- Service Account token via `OP_SERVICE_ACCOUNT_TOKEN`
- `op read` with `op://vault/item/field` URI
- Auto-installs `op` CLI if not present

### Related Issues

| Issue                                                  | Repo               | Description                                                        |
| ------------------------------------------------------ | ------------------ | ------------------------------------------------------------------ |
| [#8](https://github.com/nsheaps/.github/issues/8)      | nsheaps/.github    | Add secret sync workflow using op-exec (P2, needs-human-attention) |
| [#167](https://github.com/nsheaps/ai-mktpl/issues/167) | nsheaps/ai-mktpl   | Plugin: Agent secrets management (1Password/vault integration)     |
| [#69](https://github.com/nsheaps/agent-team/issues/69) | nsheaps/agent-team | Agent isolation from host system authentication                    |
| [#4](https://github.com/nsheaps/agent-team/issues/4)   | nsheaps/agent-team | Add AUTOMATION_GITHUB_APP_ID and PRIVATE_KEY secrets (P1, blocked) |

---

## 2. Authentication: Service Accounts vs Connect Server

### Service Accounts (Recommended)

**Confidence**: High — official 1Password recommendation for CI/CD.

Service Accounts are non-human principals designed for automation:

- Zero infrastructure (cloud-based, no server deployment)
- Vault-level access control (read-only, specific vaults)
- Simple setup: generate token → store as GitHub secret → reference in workflow
- Audit trail via 1Password usage reports
- Up to 100 per organization

**Setup**:

1. Create a service account in 1Password admin console
2. Grant access to specific vaults (e.g., `ci-cd-secrets`)
3. Restrict to read-only operations
4. Store token as GitHub repo/org secret: `OP_SERVICE_ACCOUNT_TOKEN`

### Connect Server (Enterprise Only)

Self-hosted REST API bridge. Only needed for:

- Strict network isolation requirements
- Highly regulated environments
- Multi-region deployments needing local secret retrieval

**Recommendation**: Use Service Accounts. Connect Server adds operational overhead that's only justified for enterprise-scale requirements.

---

## 3. Secret Sync Workflow Pattern

### Recommended Architecture

```
1Password Vault (source of truth)
    ↓ (Service Account + op read)
GitHub Actions Workflow (reusable)
    ↓ (gh secret set)
Target Repository Secrets
```

### Reference Implementation

```yaml
name: Sync 1Password to GitHub Secrets
on:
  schedule:
    - cron: "0 0 * * *" # Daily
  workflow_dispatch: # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Install 1Password CLI
        uses: 1password/install-cli-action@v2

      - name: Read and sync secrets
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          GH_TOKEN: ${{ secrets.SYNC_PAT }} # PAT with admin:org or repo scope
        run: |
          # Read each secret from 1Password
          API_KEY=$(op read "op://ci-cd/api-credentials/api-key")
          echo "::add-mask::$API_KEY"

          # Sync to target repository
          gh secret set API_KEY --repo nsheaps/target-repo --body "$API_KEY"
```

### Key Design Decisions

| Decision          | Recommendation                       | Why                                                           |
| ----------------- | ------------------------------------ | ------------------------------------------------------------- |
| Trigger           | `schedule` + `workflow_dispatch`     | Regular sync + manual override for immediate rotation         |
| CLI vs Action     | `install-cli-action` + `op read`     | More flexibility than `load-secrets-action` for sync use case |
| Target secret API | `gh secret set`                      | Native GitHub CLI, supports repo and org-level secrets        |
| Auth for gh       | PAT with `admin:org` scope           | `GITHUB_TOKEN` can't set secrets on other repos               |
| Error handling    | Fail-fast on any secret read failure | Don't partially sync — either all secrets sync or none        |

### Configuration Format

For defining which secrets to sync, the evidence suggests a YAML config file:

```yaml
# .github/secret-sync.yaml
secrets:
  - name: ANTHROPIC_API_KEY
    source: op://ci-cd/claude-credentials/api-key
    targets:
      - repo: nsheaps/agent-team
      - repo: nsheaps/ai-mktpl

  - name: AUTOMATION_GITHUB_APP_ID
    source: op://ci-cd/github-app/app-id
    targets:
      - repo: nsheaps/agent-team
      - repo: nsheaps/ai-mktpl
      - repo: nsheaps/op-exec

  - name: AUTOMATION_GITHUB_APP_PRIVATE_KEY
    source: op://ci-cd/github-app/private-key
    targets:
      - repo: nsheaps/agent-team
      - repo: nsheaps/ai-mktpl
```

This approach:

- Keeps the mapping declarative and version-controlled
- Supports multiple target repos per secret
- Enables dry-run mode (read config, validate sources, skip `gh secret set`)
- Aligns with the Ansible-style approach described in [nsheaps/.github#8](https://github.com/nsheaps/.github/issues/8)

---

## 4. op-exec Recursive Resolution

### How It Works (Current Implementation)

The `op-exec` script at `ai-mktpl/bin/op-exec`:

1. Fetches all fields from a 1Password item (`op item get --format json`)
2. For each field value, checks if it starts with `op://`
3. If yes, resolves with `op read`, then checks the result again
4. Recurses up to `MAX_DEPTH=5`
5. Converts field labels to env var names

### Security Implications

**Confidence**: Medium-High

| Concern                | Risk                                             | Mitigation                                                     |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Circular references    | Script loops until max depth, wasting time       | MAX_DEPTH=5 cap prevents infinite loops                        |
| Cross-vault references | Secret in vault A references secret in vault B   | Service account must have access to all referenced vaults      |
| Failed resolution      | `op read` failure returns empty string, silently | Should fail loudly — empty secrets are dangerous               |
| Logging                | Debug mode logs resolved values to stderr        | Never enable DEBUG in production                               |
| Shell injection        | Field labels become env var names via `tr`       | Current sanitization is basic — only alphanumeric + underscore |

### Recommendations for op-exec

1. **Fail on empty resolution** — an empty secret value after resolution should be an error, not silent
2. **Add `--strict` mode** — fail if any field can't be resolved
3. **Add `--no-recursive` mode** — disable recursion for security-sensitive contexts
4. **Improve label sanitization** — validate against injection patterns
5. **Add section handling** — the POC limitation of flat items only should be addressed
6. **Consider moving to `op run`** — 1Password's native `op run` provides temporal isolation that `op-exec` doesn't (secrets only exist in subprocess, not in parent shell)

---

## 5. Security Best Practices

### For the Sync Workflow

**Confidence**: High

1. **Dedicated CI/CD vault** — Create a `ci-cd-secrets` vault in 1Password. Don't share with personal vaults.
2. **Read-only service account** — The sync workflow only needs to read secrets, never write.
3. **Separate service accounts per environment** — staging vs production vaults with different tokens.
4. **PAT with minimal scope** — The GitHub PAT for `gh secret set` needs `admin:org` (for org secrets) or `repo` scope (for repo secrets). Use the narrowest scope possible.
5. **Mask all secret values** — Use `::add-mask::` before any secret touches `$GITHUB_OUTPUT`.
6. **Fail-fast on errors** — Set `set -euo pipefail` in all scripts. A partial sync is worse than no sync.
7. **Audit regularly** — Review 1Password usage reports monthly. Check which items the service account accessed.
8. **Rotate service account tokens** — Every 90 days. No auto-rotation exists — must be manual or scripted.

### For Agent Secret Injection ([#167](https://github.com/nsheaps/ai-mktpl/issues/167))

1. **Use `op run` for temporal isolation** — Secrets exist only during subprocess execution, not in parent shell
2. **Agent-scoped service accounts** — Each agent role gets its own service account with access to only its secrets
3. **SessionStart hook for injection** — Fetch secrets at session start, inject as env vars
4. **Never write secrets to disk in plaintext** — Use env vars or tmpfs-backed files with restricted permissions
5. **Strip host auth from agent environment** — Per [agent-team#69](https://github.com/nsheaps/agent-team/issues/69), agents should not inherit host user's `GH_TOKEN`, `SSH_AUTH_SOCK`, etc.

### Secret Injection Pattern Comparison

| Pattern             | Logging Risk | Process Isolation        | Cleanup   | Best For                     |
| ------------------- | ------------ | ------------------------ | --------- | ---------------------------- |
| `op run` (env vars) | Low          | High (subprocess-scoped) | Automatic | CI/CD, short-lived processes |
| `op inject` (files) | Medium       | Medium                   | Manual    | Config file injection        |
| `op read` (direct)  | Medium       | Medium                   | Manual    | Selective retrieval          |
| SDK (native)        | Low          | High                     | Automatic | Application integration      |

**Recommendation**: Use `op run` for agent secret injection and `op read` + `gh secret set` for the sync workflow.

---

## 6. Community Tools and Patterns

### Official Actions

| Action                                                                                 | Purpose                          | Platform Support      |
| -------------------------------------------------------------------------------------- | -------------------------------- | --------------------- |
| [`1password/load-secrets-action@v3`](https://github.com/1Password/load-secrets-action) | Load secrets as env vars/outputs | Mac + Linux only      |
| [`1password/install-cli-action@v2`](https://github.com/1Password/install-cli-action)   | Install `op` CLI on runner       | Mac + Linux + Windows |

### Community Tools

| Tool                                                                                                | What It Does                              | Relevance                        |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------- |
| [`significa/1password-secrets`](https://github.com/significa/1password-secrets)                     | Sync 1Password to `.env` files and Fly.io | Pattern for sync workflow design |
| [`1password/kubernetes-secrets-injector`](https://github.com/1Password/kubernetes-secrets-injector) | Inject 1Password into K8s Secrets         | Infrastructure-as-code pattern   |
| [`tomasbal/1password-dot-env-sync`](https://github.com/tomasbal/1password-dot-env-sync)             | Sync `.env` with 1Password items          | Alternative sync approach        |

### Key Insight from Community

The `significa/1password-secrets` tool demonstrates a pull-based sync pattern that keeps the vault as single source of truth. Their approach — `1password-secrets local pull` — is conceptually identical to what the `nsheaps/.github` secret sync workflow should do, but targeting GitHub secrets instead of `.env` files.

---

## 7. Recommendations

### Priority 1: Build the Sync Workflow

1. Create a reusable workflow in `nsheaps/.github` that:
   - Reads a YAML config defining secret mappings (source `op://` URI → target repos)
   - Uses `1password/install-cli-action@v2` + `op read`
   - Syncs to target repos via `gh secret set`
   - Supports dry-run mode
   - Runs on schedule (daily) and manual dispatch

2. This requires:
   - A 1Password Service Account (needs human setup)
   - A GitHub PAT with `repo` scope stored as org secret (needs human setup)
   - The YAML config file committed to `nsheaps/.github`

### Priority 2: Improve op-exec

1. Move `op-exec` from `ai-mktpl/bin/` to `nsheaps/op-exec` repo (Task [#8](https://github.com/nsheaps/agent-team/issues/8) — already in progress via Foghorn)
2. Add strict mode (fail on empty resolution)
3. Add section handling
4. Consider wrapping `op run` for temporal isolation

### Priority 3: Agent Secrets Plugin

1. Per [ai-mktpl#167](https://github.com/nsheaps/ai-mktpl/issues/167), build a Claude Code plugin that:
   - Uses SessionStart hook to fetch agent-specific secrets from 1Password
   - Injects as env vars for the session
   - Uses per-agent service accounts for isolation
   - Never writes secrets to disk in plaintext

### Human Decisions Required

| Decision                                        | Why                                                    | Who        |
| ----------------------------------------------- | ------------------------------------------------------ | ---------- |
| Create 1Password Service Account for CI/CD      | Requires 1Password admin access                        | Repo owner |
| Create PAT for `gh secret set`                  | Requires GitHub admin scope                            | Repo owner |
| Define secret-to-repo mapping                   | Business decision about which repos need which secrets | Repo owner |
| Vault structure (single CI/CD vault vs per-env) | Security architecture decision                         | Repo owner |

---

## Sources

### Official Documentation

- [1Password Service Accounts](https://developer.1password.com/docs/service-accounts/)
- [1Password GitHub Actions Integration](https://developer.1password.com/docs/ci-cd/github-actions/)
- [1Password CLI Reference](https://developer.1password.com/docs/cli/)
- [1Password Audit Log](https://support.1password.com/activity-log/)
- [GitHub Docs: Implementing least privilege for secrets](https://blog.github.com/security/application-security/implementing-least-privilege-for-secrets-in-github-actions/)

### Existing Codebase

- `ai-mktpl/bin/op-exec` — Existing recursive resolution wrapper
- `ai-mktpl/.github/actions/claude-auth/` — Existing 1Password GitHub Action integration
- `.claude/scratch/issue-triage.md` — Issue triage referencing secret sync needs

### GitHub Issues

- [nsheaps/.github#8](https://github.com/nsheaps/.github/issues/8) — Add secret sync workflow
- [nsheaps/ai-mktpl#167](https://github.com/nsheaps/ai-mktpl/issues/167) — Agent secrets management plugin
- [nsheaps/agent-team#69](https://github.com/nsheaps/agent-team/issues/69) — Agent isolation from host auth
- [nsheaps/agent-team#4](https://github.com/nsheaps/agent-team/issues/4) — Missing GitHub App secrets (P1)

### Community Tools

- [1password/load-secrets-action](https://github.com/1Password/load-secrets-action)
- [1password/install-cli-action](https://github.com/1Password/install-cli-action)
- [significa/1password-secrets](https://github.com/significa/1password-secrets)
- [1password/kubernetes-secrets-injector](https://github.com/1Password/kubernetes-secrets-injector)

### Sub-agent Research Files

- `.claude/tmp/1password-github-sync-research.md` — Official actions and community patterns
- `.claude/tmp/1password-security-patterns-research.md` — Security patterns and CLI comparison
