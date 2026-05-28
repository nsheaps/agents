---
title: Create a GitHub App for an Agent
purpose: Step-by-step runbook for creating a GitHub App with the right permissions, generating its private key, installing it on the target org/account, and storing the App ID, Installation ID, and private key in 1Password for the agent's github-app plugin to consume.
audience: human
last_reviewed: 2026-04-09
---

# Create a GitHub App for an Agent

## Purpose

Each agent needs its own GitHub identity so commits, PRs, and issues are
attributed to a distinct bot account (`jack-nsheaps[bot]`, `henry-nsheaps[bot]`,
etc.). This runbook creates a GitHub App, generates its private key, installs
it on the target org/user, and stores the resulting credentials in 1Password.

A GitHub App is different from a Personal Access Token (PAT) or an OAuth App:

- **App identity** — commits and PRs show up as `<app-name>[bot]`, not as a human
- **Fine-grained permissions** — scoped per install, not account-wide
- **Short-lived installation tokens** — 1-hour TTL, regenerated on demand from the private key
- **Isolation** — the agent's GitHub App token cannot accidentally fall back to the handler's PAT (see `auth-credentials.md`)

## Prerequisites

- GitHub account with permission to create Apps (any account works for personal Apps; for org-owned Apps, you must be an org owner)
- Target org or user account where the App will be installed (where the agent will operate)
- 1Password vault already provisioned for the agent (see `create-1password-vault-and-service-account.md`)
- Local `openssl` or equivalent to optionally verify the PEM format
- `gh` CLI installed locally for the verification step

## Steps

### 1. Decide ownership

A GitHub App can be owned by:

- **A personal account** — simpler, no org permissions needed
- **An organization** — preferred for team or production agents; allows multiple humans to manage

For personal agents under `nsheaps`, ownership = personal. Adjust the URL in step 2 if creating under an org.

### 2. Create the App

1. Go to <https://github.com/settings/apps> (personal) or `https://github.com/organizations/<org>/settings/apps` (org)
2. Click **New GitHub App** (top right)
3. Fill in the form:

   | Field                    | Value                                                                                                         |
   | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
   | **GitHub App name**      | `<agent-name>-nsheaps` (e.g. `jack-nsheaps`, `henry-nsheaps`) — becomes the bot user `<name>[bot]`            |
   | **Description**          | e.g. "Agentic AI assistant — commits and PRs on behalf of Nate Heaps"                                         |
   | **Homepage URL**         | `https://github.com/nsheaps/agents` (any valid URL works; placeholder is fine)                                |
   | **Callback URL**         | Leave blank unless the agent does OAuth user flows                                                            |
   | **Setup URL**            | Leave blank                                                                                                   |
   | **Webhook** → **Active** | **UNCHECK** this box — agents don't use webhooks (they poll via API). This avoids needing a webhook endpoint. |
   | **Webhook URL**          | Blank (only required if Active is checked)                                                                    |
   | **Webhook secret**       | Blank                                                                                                         |

### 3. Configure repository permissions

Under **Repository permissions**, set:

| Permission         | Access       | Why                                                                              |
| ------------------ | ------------ | -------------------------------------------------------------------------------- |
| **Contents**       | Read & write | Push commits, create branches                                                    |
| **Metadata**       | Read-only    | Required baseline permission                                                     |
| **Pull requests**  | Read & write | Create PRs, comment, approve, merge                                              |
| **Issues**         | Read & write | Create and update issues                                                         |
| **Actions**        | Read-only    | Check CI status on PRs                                                           |
| **Checks**         | Read & write | Post check runs (required for PR status)                                         |
| **Workflows**      | Read & write | Only if the agent will modify `.github/workflows/*.yml` files — enable if needed |
| **Administration** | No access    | Do NOT grant — keeps agents from changing repo settings                          |
| **Secrets**        | No access    | Do NOT grant — keeps agents from reading repo secrets                            |

### 4. Configure organization permissions (if org-owned App)

Under **Organization permissions**, set:

| Permission         | Access       | Why                                          |
| ------------------ | ------------ | -------------------------------------------- |
| **Members**        | Read-only    | Resolve usernames for @mentions in PR bodies |
| **Projects**       | Read & write | Only if the agent uses org-level Projects    |
| **Administration** | No access    | Do NOT grant                                 |

### 5. Account permissions

Leave all **Account permissions** as "No access". Agents don't need user-level
scopes.

### 6. Subscribe to events

**Uncheck everything** under **Subscribe to events**. The agent polls the API
directly; it does not handle incoming webhook events.

### 7. Installation scope

Under **Where can this GitHub App be installed?**:

- Choose **Only on this account** for personal agents (restricts install to the owner account)
- Choose **Any account** only if you want others to be able to install it (uncommon for personal agents)

### 8. Click Create GitHub App

GitHub redirects to the App's settings page. Note the following values visible
on this page (you'll need them all):

- **App ID** (numeric, shown near the top — e.g. `987654`)
- **Client ID** (starts with `Iv1.` or `lv1.` — not usually needed for bot ops but good to have)
- **Public link** (e.g. `https://github.com/apps/jack-nsheaps`)

### 9. Generate the private key

This is the most error-prone step. The private key is **downloadable only once**.

1. On the App's settings page, scroll to the **Private keys** section (near the bottom)
2. Click **Generate a private key**
3. Your browser downloads a file named something like `jack-nsheaps.2026-04-09.private-key.pem`
4. **Move the file to a safe location immediately** — e.g. `~/Downloads/<app-name>.private-key.pem`
5. Verify the PEM is intact (optional):
   ```bash
   openssl rsa -in ~/Downloads/jack-nsheaps.*.private-key.pem -noout -check
   # Expected: RSA key ok
   ```

> **Cannot re-download.** If you lose this file, you must generate a new private key. The old one continues to work until you delete it from the App's settings, so it's safe to rotate: generate new → store new → delete old.

### 10. Install the App on the target account/org

1. On the App's settings page, in the left sidebar, click **Install App**
2. You see a list of accounts/orgs you can install it on. Click **Install** next to the target (usually your personal account `nsheaps`).
3. On the install configuration page:
   - Choose **All repositories** (simpler, grants access to all current and future repos) OR
   - Choose **Only select repositories** and pick specific repos (more restrictive, must update when new repos are added)
4. Click **Install**

GitHub redirects to a URL like:

```
https://github.com/settings/installations/<INSTALLATION_ID>
```

**Note the `INSTALLATION_ID` number from the URL.** This is different from the
App ID — the App ID identifies the App globally; the Installation ID identifies
this particular installation on this particular account.

You can also retrieve it later via:

```
https://github.com/settings/installations
```

(or `https://github.com/organizations/<org>/settings/installations` for orgs)

### 11. Store credentials in 1Password

Three fields need to be stored. All go into the `ENVIRONMENT` item in the
agent's vault.

1. Open <https://my.1password.com>
2. Navigate to the agent's vault
3. Open **ENVIRONMENT** item
4. Click **Edit**
5. Add three fields:

   | Field name               | Type             | Value                                                                                         |
   | ------------------------ | ---------------- | --------------------------------------------------------------------------------------------- |
   | `GITHUB_APP_ID`          | Text             | The App ID from step 8 (numeric)                                                              |
   | `GITHUB_INSTALLATION_ID` | Text             | The Installation ID from step 10 (numeric)                                                    |
   | `GITHUB_APP_PRIVATE_KEY` | Password / Notes | **Full contents of the .pem file**, including `-----BEGIN RSA PRIVATE KEY-----` and end lines |

6. For the private key, use a **multi-line text** (Notes) field or a long Password field depending on the item type. Copy the ENTIRE file contents:

   ```bash
   pbcopy < ~/Downloads/jack-nsheaps.*.private-key.pem
   ```

   Paste into the field. Verify the first line is `-----BEGIN RSA PRIVATE KEY-----` and the last is `-----END RSA PRIVATE KEY-----`.

7. Click **Save**

### 12. Destroy the local PEM file

After confirming the private key is stored in 1Password:

```bash
shred -u ~/Downloads/<app-name>.*.private-key.pem
# or on macOS (no shred):
rm -P ~/Downloads/<app-name>.*.private-key.pem
```

Do NOT leave the PEM sitting in `~/Downloads`. It's a secret.

## Verification

Confirm the credentials work by generating an installation token and calling
the GitHub API:

```bash
# Set vars from 1Password
APP_ID="$(op read "op://Agent-<Name>/ENVIRONMENT/GITHUB_APP_ID")"
INSTALLATION_ID="$(op read "op://Agent-<Name>/ENVIRONMENT/GITHUB_INSTALLATION_ID")"
op read "op://Agent-<Name>/ENVIRONMENT/GITHUB_APP_PRIVATE_KEY" > /tmp/app-key.pem
chmod 600 /tmp/app-key.pem
```

Generate a JWT (GitHub App auth uses a JWT signed with the private key to
request an installation token):

```bash
# The repo's bin/generate-token.sh handles this. For manual verification:
NOW=$(date +%s)
EXP=$((NOW + 540))
HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | openssl base64 -A | tr '+/' '-_' | tr -d '=')
PAYLOAD=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$NOW" "$EXP" "$APP_ID" | openssl base64 -A | tr '+/' '-_' | tr -d '=')
SIG=$(printf '%s.%s' "$HEADER" "$PAYLOAD" | openssl dgst -sha256 -sign /tmp/app-key.pem | openssl base64 -A | tr '+/' '-_' | tr -d '=')
JWT="${HEADER}.${PAYLOAD}.${SIG}"

# Exchange JWT for installation token
TOKEN=$(curl -s -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens" \
  | jq -r .token)

# Verify the token works and returns the bot identity
curl -s -H "Authorization: token $TOKEN" https://api.github.com/user | jq .login
# Expected: "jack-nsheaps[bot]" (or similar)

# Clean up
shred -u /tmp/app-key.pem
```

**Expected:** The `login` field shows `<app-name>[bot]`, matching the App
name from step 2.

For production use, **prefer `bin/generate-token.sh`** in the agent repo,
which wraps this flow and handles caching/renewal.

## Common Pitfalls

- **Private key only downloadable once.** If you close the browser without saving the PEM, you cannot recover it — you must generate a new key. The old key continues to work until deleted, so rotation is safe: create new → store → delete old.
- **App ID vs Installation ID.** These are two different numbers. The App ID is on the App's settings page. The Installation ID is in the URL after installing (`/settings/installations/<id>`). Mixing them up produces confusing 401/404s.
- **Permissions cannot be widened without reinstall.** If you forget to grant `Checks: Write` or `Workflows: Write`, you can edit the App's permissions, but existing installations must re-accept the new permissions. GitHub emails the installation owner asking to accept — until they do, the new permissions are not active.
- **"Workflows" permission gotcha.** Without `Workflows: Read & Write`, the App cannot modify `.github/workflows/*.yml` files in PRs. Error: `refusing to allow a GitHub App to create or update workflow`. Always grant this if the agent will touch CI files.
- **PEM newlines lost.** If copying the PEM through a system that strips newlines (some 1Password field types, some CI env var UIs), the key becomes invalid. Verify the stored version has the full header/footer and line breaks. `op read` preserves newlines correctly; GitHub Actions secrets require escaping.
- **Token TTL is 1 hour.** Installation tokens expire after 1 hour. Long-running agents need a refresh mechanism — see `bin/generate-token.sh` in the agent's repo. `gh` CLI does NOT auto-renew these.
- **`gh` falls back silently on expired tokens.** When `GH_TOKEN` is expired, `gh` falls back to the keyring entry (the handler's PAT), making commits appear as the handler instead of the bot. See `docs/specs/auth-credentials.md` for the pr390 investigation.
- **Org-owned apps need owner approval to install on personal accounts.** If you create the App under an org but try to install on a personal account, GitHub may restrict this based on org settings.
- **Single-tenant apps.** Setting "Only on this account" hard-limits installs. Change to "Any account" only if you know you want that — you cannot easily revert (existing installs survive but GitHub shows warnings).
- **Bot cannot approve its own PRs.** GitHub Apps are blocked from approving PRs they created. If the workflow needs approval, that must come from a human (or a different App).
- **Marketplace listing not needed.** Agent Apps do not need to be listed in the GitHub Marketplace. Skip anything that asks about public listing.

## Where This Is Used

- **Plugin**: `ai-mktpl/github-app`
- **Plugin settings reference**:
  ```yaml
  github-app:
    env:
      GITHUB_APP_ID: "op://Agent-<Name>/ENVIRONMENT/GITHUB_APP_ID"
      GITHUB_INSTALLATION_ID: "op://Agent-<Name>/ENVIRONMENT/GITHUB_INSTALLATION_ID"
      GITHUB_APP_PRIVATE_KEY: "op://Agent-<Name>/ENVIRONMENT/GITHUB_APP_PRIVATE_KEY"
  ```
- **Token generation**: `bin/generate-token.sh` in the agent repo exchanges the App credentials for a short-lived installation token (`GH_TOKEN`). Re-run when `gh` returns 401.
- **Identity verification**: Before creating PRs, always verify `gh api /user --jq .login` returns the bot name, not the handler's GitHub username. See `.claude/rules/verify-before-acting.md`.
- **Environment file**: Jack's session-env file is at `~/.config/agent/github-app-env`. Sourced before `gh`/`git` commands so `GH_TOKEN` is populated.

## Related

- [Create Discord Bot](./create-discord-bot.md) — Discord channel for the same agent
- [Create Telegram Bot](./create-telegram-bot.md) — Telegram channel for the same agent
- [Create 1Password Vault and Service Account](./create-1password-vault-and-service-account.md) — where the App credentials are stored
- [auth-credentials spec](../specs/auth-credentials.md) — why we use GitHub Apps per agent
- [GitHub Apps docs](https://docs.github.com/en/apps/creating-github-apps) — official reference
- [Authenticating as an installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation) — JWT + installation token flow
