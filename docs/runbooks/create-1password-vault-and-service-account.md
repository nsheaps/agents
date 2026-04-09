---
title: Create a 1Password Vault and Service Account for an Agent
purpose: Step-by-step runbook for provisioning a per-agent 1Password vault, creating an ENVIRONMENT aggregator item that holds all the agent's secrets, and creating a scoped service account whose token is used by op-exec to inject secrets into the agent's process environment.
audience: human
last_reviewed: 2026-04-09
---

# Create a 1Password Vault and Service Account

## Purpose

Each agent needs its own 1Password vault so secrets stay isolated between
agents on a shared machine. This runbook creates:

1. A dedicated vault for the agent
2. An `ENVIRONMENT` "aggregator" item inside the vault with one field per
   environment variable (DISCORD_BOT_TOKEN, GITHUB_APP_ID, etc.)
3. A 1Password **service account** scoped to that vault, whose token
   bootstraps the agent's ability to read its own secrets

The service account token is the one secret that cannot live inside 1Password
(chicken-and-egg). It lives in `.claude/settings.local.json` under
`env.OP_SERVICE_ACCOUNT_TOKEN` and is loaded into the agent's process
environment at startup.

This is the first runbook to run for a new agent — the other credential
runbooks (Discord, Telegram, GitHub App) all assume this vault already exists.

## Prerequisites

- 1Password Business, Teams, or Families plan (service accounts require a non-Individual plan)
- 1Password admin role (only admins can create vaults and service accounts)
- 1Password CLI (`op`) installed locally — `brew install 1password-cli`
- `op` signed in as your personal account for the setup steps (`op signin`)

## Naming Conventions

### Vault name

Use `Agent-<Name>` where `<Name>` matches the agent's persona name.
Examples: `Agent-Jack`, `Agent-Henry`, `Agent-Pamela`.

> **Do not use the old `AI-<Name>` prefix.** An earlier convention used
> `AI-Jack`. We are migrating away from `AI-*` to `Agent-*` for consistency
> (a rename is in progress — see Jack's task tracker for the migration). New
> agents should use `Agent-*` from day one.

### Service account name

`sa-agent-<name>` — e.g. `sa-agent-jack`, `sa-agent-henry`.

## Steps

### 1. Create the vault

1. Open <https://my.1password.com> and sign in
2. In the left sidebar, click the **+** next to "Vaults" (or Settings → Vaults → New Vault)
3. Name: `Agent-<Name>` (e.g. `Agent-Henry`)
4. Icon: optional — pick something memorable for the agent (robot emoji, character avatar)
5. Description: e.g. "Secrets for the Henry agent — managed by Nate"
6. Click **Create Vault**

You should now see the new empty vault in the sidebar.

### 2. Verify your own access to the vault

If you created it as the admin, you should automatically have access. Verify
via CLI:

```bash
op vault list | grep "Agent-<Name>"
```

The vault should appear. If not, `op signout && op signin` to refresh the
account state.

### 3. Create the ENVIRONMENT aggregator item

The "aggregator" pattern stores all of the agent's environment variables as
named fields on a single 1Password item. `op-exec` can then inject the whole
item as `KEY=VALUE` pairs into a process environment in one shot, rather
than needing a separate `op://` reference for each variable.

1. In the vault, click **New Item** (top right)
2. Choose type **Secure Note**
3. Title: **ENVIRONMENT** (exactly — all caps, this is the convention op-exec expects)
4. In the Notes field, add a comment describing what this is for:
   ```
   Environment variables injected into the <Name> agent's process via op-exec.
   Add one field per env var the agent needs.
   Do not put the OP_SERVICE_ACCOUNT_TOKEN here — that lives in settings.local.json
   and bootstraps access to this item.
   ```
5. Click **Save** (fields will be added by the other runbooks)

Leave this item empty for now. The Discord, Telegram, and GitHub App runbooks
each add their own fields to it.

### 4. Create the service account

1. Click the avatar icon (top right) → **My Account** or **Settings**
2. In the Settings menu, look for **Developer** or **Integrations** (exact wording varies by plan; on Business plans it's under Admin Console → Integrations)
3. Click **Directory** → **Service Accounts** (Business) or **Integrations** → **Service Accounts**
4. Click **New Service Account** (or **Create Service Account**)
5. Fill in:
   - **Name**: `sa-agent-<name>`
   - **Description**: "Read-only access to Agent-<Name> vault for op-exec"
   - **Vault access**: Click **Add Vault**, select the `Agent-<Name>` vault, set permission to **Read Items** only
     - Do NOT grant write access. The agent should not be able to modify its own secrets.
     - Do NOT grant access to any other vault.
   - **Token expiration**: Choose based on your security posture. Options: 30 days, 90 days, 1 year, or Never Expires. For long-running agents, **90 days** is a reasonable balance. Set a calendar reminder to rotate.
6. Click **Create Service Account**

> **Required plan.** Service accounts require a 1Password Business, Teams, or Families plan. If the button is missing, check your plan.

### 5. Copy the service account token

1. After creation, 1Password displays the token **once**
2. The token starts with `ops_` followed by a long base64-like string
3. **Copy it immediately** — like GitHub App private keys, you cannot retrieve this again. Losing it means deleting and recreating the service account.
4. Click the **I've saved the token** / **Done** button only after you've pasted it into the agent's config

### 6. Store the token in the agent's settings.local.json

The service account token does NOT go into 1Password. It lives in the agent's
local Claude settings, where the launcher sources it into the environment.

1. Open the agent's `.claude/settings.local.json` file (create if missing):
   ```
   ~/src/nsheaps/.ai-agent-<name>/.claude/settings.local.json
   ```
2. Add or edit the `env` key:
   ```json
   {
     "env": {
       "OP_SERVICE_ACCOUNT_TOKEN": "ops_abc123..."
     }
   }
   ```
3. Save the file
4. Verify the file is gitignored — `.claude/settings.local.json` is in the
   standard Claude Code gitignore, but double-check with:
   ```bash
   cd ~/src/nsheaps/.ai-agent-<name>
   git check-ignore -v .claude/settings.local.json
   ```
   If it's NOT gitignored, add `.claude/settings.local.json` to the repo's
   `.gitignore` immediately — before committing anything else.

> **Do not write the token to `~/.claude/settings.local.json`.** That file is shared by all agents on this machine. Per-agent secrets belong in the agent-specific repo, under its `.claude/` directory. See `~/.ai-agent-jack/.claude/rules/secrets-and-shared-machine.md`.

### 7. Test the token

Before relying on it for agent operations, verify the token works:

```bash
export OP_SERVICE_ACCOUNT_TOKEN="ops_abc123..."   # paste from the step above
op vault list
```

Expected output:

```
ID                            NAME
abc123xxxxxxxxxx              Agent-<Name>
```

**Only the vault you granted access to should appear.** If other vaults show up,
the service account was over-scoped — delete it and recreate with the correct
vault scope.

Then try reading a non-existent field (the ENVIRONMENT item is still empty) to
confirm the path convention works:

```bash
op read "op://Agent-<Name>/ENVIRONMENT/notesPlain"
```

This should return the Notes text you entered in step 3. If you get a 404,
check that the item title is exactly `ENVIRONMENT` (case-sensitive in some
plans).

### 8. Record the vault name in the agent's plugins.settings.yaml

The agent's plugins use `op://` references that hardcode the vault name.
Make sure the agent's `.claude/plugins.settings.yaml` (or equivalent) uses
the correct vault name. Example:

```yaml
github-app:
  env:
    GITHUB_APP_ID: "op://Agent-<Name>/ENVIRONMENT/GITHUB_APP_ID"
    GITHUB_INSTALLATION_ID: "op://Agent-<Name>/ENVIRONMENT/GITHUB_INSTALLATION_ID"
    GITHUB_APP_PRIVATE_KEY: "op://Agent-<Name>/ENVIRONMENT/GITHUB_APP_PRIVATE_KEY"

discord:
  env:
    DISCORD_BOT_TOKEN: "op://Agent-<Name>/ENVIRONMENT/DISCORD_BOT_TOKEN"

telegram:
  env:
    TELEGRAM_BOT_TOKEN: "op://Agent-<Name>/ENVIRONMENT/TELEGRAM_BOT_TOKEN"
```

Commit and push this file. It contains references, not secrets, so it is safe
to commit to the public repo.

### 9. Proceed to the other runbooks

With the vault and ENVIRONMENT item in place, run the other credential
runbooks to populate the fields:

- [Create Discord Bot](./create-discord-bot.md) → adds `DISCORD_BOT_TOKEN`
- [Create Telegram Bot](./create-telegram-bot.md) → adds `TELEGRAM_BOT_TOKEN`
- [Create GitHub App](./create-github-app.md) → adds `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`

## Verification

End-to-end check — from a fresh shell:

```bash
# Source the token (as the agent's launcher would)
export OP_SERVICE_ACCOUNT_TOKEN="$(jq -r .env.OP_SERVICE_ACCOUNT_TOKEN ~/src/nsheaps/.ai-agent-<name>/.claude/settings.local.json)"

# Confirm scope is correct
op vault list
# Expected: only Agent-<Name>

# Read a secret from the ENVIRONMENT item (after other runbooks have added fields)
op read "op://Agent-<Name>/ENVIRONMENT/DISCORD_BOT_TOKEN" | head -c 10
# Expected: first 10 chars of the Discord token (the `| head -c 10` is just to avoid echoing the full value)
```

If `op vault list` shows zero vaults, the token is wrong or expired. Check the
token's status in the 1Password web UI → Service Accounts → `sa-agent-<name>`.

If `op vault list` shows the vault but `op read` returns 404, the item title
or field name is wrong. Path format is `op://<VAULT>/<ITEM>/<FIELD>`.

## Common Pitfalls

- **Missing `OP_SERVICE_ACCOUNT_TOKEN` at agent startup.** The agent launcher needs this in the environment before `op-exec` runs. If you see errors like `op: 401 Unauthorized` at startup, the token isn't being sourced. Check `settings.local.json` is being loaded — some launchers don't auto-load it.
- **Putting the service account token in 1Password.** Chicken-and-egg: the agent needs the token to READ 1Password. Don't try to store it there.
- **Over-scoping the service account.** A service account with access to multiple vaults means a single leaked token compromises multiple agents. One vault per service account, always.
- **Using `op signin` instead of service accounts.** `op signin` is for interactive human use. Agents must use `OP_SERVICE_ACCOUNT_TOKEN` — it's designed for non-interactive access and has no session expiry quirks.
- **Service account token rotation forgotten.** If you set a 90-day expiration and forget to rotate, the agent will start getting 401s on day 91. Set a calendar reminder. Or use "Never Expires" and accept the trade-off.
- **Field names case-sensitive.** `op read "op://Agent-Jack/ENVIRONMENT/discord_bot_token"` fails if the field is `DISCORD_BOT_TOKEN`. Stick to the SCREAMING_SNAKE_CASE convention used by environment variables.
- **Item title `environment` (lowercase) doesn't resolve.** Some 1Password accounts are case-sensitive on item titles. Use `ENVIRONMENT` exactly to match the convention.
- **Writing secrets to `~/.claude/settings.local.json`.** That file is in the user home, which is shared between all agents on the machine. Per-agent secrets belong under the agent's own repo. See `.claude/rules/secrets-and-shared-machine.md`.
- **Gitignore gap.** If `.claude/settings.local.json` is accidentally committed, the token is in git history. Revoke it immediately in 1Password, create a new one, and force-clean the history or accept the secret is compromised.
- **Multiple `ENVIRONMENT` items.** Having two items both named `ENVIRONMENT` in the same vault causes `op read` to pick one arbitrarily. Always check `op item list --vault "Agent-<Name>"` for duplicates after setup.
- **Echoing the token.** Running `echo $OP_SERVICE_ACCOUNT_TOKEN` lands it in shell history (`~/.zsh_history` or `~/.bash_history`). Never do this. Use `printf '%s' "$OP_SERVICE_ACCOUNT_TOKEN" | wc -c` if you need to confirm it's set without revealing the value.

## Where This Is Used

- **Service account token**: Stored in `<agent-repo>/.claude/settings.local.json` under `env.OP_SERVICE_ACCOUNT_TOKEN`. Loaded by the agent launcher into the process environment at startup.
- **Vault**: Named `Agent-<Name>`, contains the `ENVIRONMENT` aggregator item and any per-plugin items.
- **Consumers**:
  - `op-exec` wraps the agent's process startup and injects `ENVIRONMENT` item fields into the environment
  - `ai-mktpl/discord`, `ai-mktpl/telegram`, `ai-mktpl/github-app` plugins read their respective env vars at runtime
  - `bin/generate-token.sh` (in the agent repo) uses `GITHUB_APP_PRIVATE_KEY` to generate short-lived installation tokens
- **Design reference**: `docs/specs/auth-credentials.md` — section "1Password as the secret store" and "Service account token for 1Password"

## Related

- [Create Discord Bot](./create-discord-bot.md) — populates `DISCORD_BOT_TOKEN` in the ENVIRONMENT item
- [Create Telegram Bot](./create-telegram-bot.md) — populates `TELEGRAM_BOT_TOKEN`
- [Create GitHub App](./create-github-app.md) — populates `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`
- [auth-credentials spec](../specs/auth-credentials.md) — design context
- [1Password Service Accounts docs](https://developer.1password.com/docs/service-accounts) — official reference
- [op CLI docs](https://developer.1password.com/docs/cli) — full CLI reference
