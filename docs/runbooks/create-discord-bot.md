---
title: Create a Discord Bot
purpose: Step-by-step runbook for creating a Discord application and bot user, enabling privileged intents, generating an invite link, and storing the bot token in 1Password for consumption by an agent's discord plugin.
audience: human
last_reviewed: 2026-04-09
---

# Create a Discord Bot

## Purpose

This runbook walks through creating a Discord bot from scratch in the Discord
Developer Portal. The resulting `DISCORD_BOT_TOKEN` is consumed by the
`ai-mktpl/discord` plugin, which gives the agent a reply channel for handler
communication (DMs and forum/text channels in the handler's Discord server).

One Discord application per agent. Do not share bot tokens across agents —
each agent needs its own identity so messages show up as `jack-nsheaps` vs
`henry-nsheaps` etc., and so access control (the `/discord:access` skill) can
allowlist each agent independently.

## Prerequisites

- Discord account with 2FA enabled (Discord requires this for developer portal access)
- Admin access to the Discord server where the bot will be added (Manage Server permission — needed for the invite step)
- 1Password vault already provisioned for the agent (see `create-1password-vault-and-service-account.md`)
- `op` CLI installed and authenticated with a service account token that has write access to the agent's vault (only needed if you want to store the token via the CLI; web UI is fine)

## Steps

### 1. Create the application

1. Go to <https://discord.com/developers/applications>
2. Click the **New Application** button (top right)
3. Enter a name that identifies the agent. Convention: `<AgentName>-Bot` (e.g. `Jack-Bot`, `Henry-Bot`)
4. Check the Developer Terms of Service box
5. Click **Create**

You are now on the application's **General Information** page.

### 2. Set the application icon and description (optional but recommended)

1. Upload an **App Icon** — use the character icon for the agent (Jack = Sylvester, Henry = TBD). Square PNG, at least 512x512.
2. Fill in **Description** with a one-liner like "Jack Oat — agentic AI assistant for Nate Heaps". This shows in the bot's profile when users hover over it.
3. Click **Save Changes** at the bottom.

### 3. Create the bot user

1. In the left sidebar, click **Bot**
2. The page may already show a bot user (newer portal versions auto-create one). If not, click **Add Bot** and confirm with **Yes, do it!**
3. Under **Username**, set the bot's display name. This is what appears in chat (e.g. `jack-nsheaps`).
4. Upload the same icon as the application icon (the bot and app icons are separate and both need setting)

### 4. Enable privileged gateway intents

This is the step people miss most often. Without MESSAGE_CONTENT, the bot
cannot read the text of messages — it can only see metadata and mentions.

1. Still on the **Bot** page, scroll down to **Privileged Gateway Intents**
2. Toggle **MESSAGE CONTENT INTENT** to ON
3. Toggle **SERVER MEMBERS INTENT** to ON (needed for user list / access control)
4. Leave **PRESENCE INTENT** OFF unless the agent needs to track who's online
5. Click **Save Changes**

### 5. Copy the bot token

1. At the top of the **Bot** page, find the **TOKEN** section
2. Click **Reset Token** (new applications don't have a visible token until you reset)
3. Confirm with **Yes, do it!**
4. If you have 2FA, enter your 2FA code
5. The token appears. Click **Copy**. Do this NOW — once you leave the page, you cannot retrieve it and will have to reset again.

> **Security warning:** The bot token is equivalent to the bot's password. Anyone with the token can impersonate the bot, send messages as it, read messages it has access to, and get kicked out of servers. Treat it like a production API key.

### 6. Store the token in 1Password

Open the agent's `ENVIRONMENT` item in 1Password (create the item if it
doesn't exist — see the 1Password runbook).

1. Open <https://my.1password.com>
2. Navigate to the agent's vault (e.g. `Agent-Jack`)
3. Open the **ENVIRONMENT** item
4. Click **Edit**
5. Add a new field: label `DISCORD_BOT_TOKEN`, type **Password** (to mask it in the UI)
6. Paste the token value
7. Click **Save**

Alternatively via the CLI (the value is passed via stdin to avoid shell history):

```bash
# Create the field if it doesn't exist
op item edit "ENVIRONMENT" --vault "Agent-<Name>" \
  "DISCORD_BOT_TOKEN[password]=$(pbpaste)"
```

> Do not `echo` the token in a terminal — it will land in shell history.

### 7. Generate the invite URL (OAuth2 URL Generator)

1. In the left sidebar, click **OAuth2**
2. Click **URL Generator** (may be a subtab)
3. Under **SCOPES**, check:
   - `bot`
   - `applications.commands` (only needed if the agent will use slash commands — check it anyway for forward compat)
4. Under **BOT PERMISSIONS** that appear below, check:
   - **Send Messages**
   - **Read Message History**
   - **Create Public Threads**
   - **Send Messages in Threads**
   - **Create Private Threads** (optional, for handler-only conversations)
   - **Embed Links**
   - **Attach Files**
   - **Add Reactions**
   - **Use External Emojis** (optional)
5. Copy the generated URL from the **GENERATED URL** field at the bottom
6. Open the URL in a new tab (while logged in as the Discord account that has admin on the target server)
7. Select the target server from the dropdown
8. Click **Authorize**, complete any CAPTCHA, and confirm

The bot should now appear in the server's member list (it will show as offline
until the agent actually starts up and connects with the token).

## Verification

Confirm the token is valid using Discord's `users/@me` endpoint:

```bash
TOKEN="$(op read "op://Agent-<Name>/ENVIRONMENT/DISCORD_BOT_TOKEN")"
curl -s -H "Authorization: Bot $TOKEN" https://discord.com/api/v10/users/@me
```

Expected response (abbreviated):

```json
{
  "id": "1234567890",
  "username": "jack-nsheaps",
  "bot": true,
  "verified": true,
  ...
}
```

If you get `{"message": "401: Unauthorized"}`, the token is wrong or has been
reset. Re-copy from the Developer Portal.

Confirm the bot is in the server by listing guilds:

```bash
curl -s -H "Authorization: Bot $TOKEN" https://discord.com/api/v10/users/@me/guilds
```

The target server should appear in the list with a non-null `id`.

## Common Pitfalls

- **MESSAGE_CONTENT intent not enabled.** The bot receives message events but `content` is an empty string. Always verify intents before debugging message handling.
- **Token leaked via `echo`.** Never `echo $DISCORD_BOT_TOKEN` in a terminal — it lands in shell history (`~/.zsh_history`). Use `op read` or `printf '%s' ... | head -c 0` if you need to verify it's set.
- **Reset Token regenerates.** Every click of **Reset Token** invalidates the previous token. If you click it twice without copying the first, the first token is dead. Old agent sessions using the old token will start getting 401s.
- **Privileged intents require verification at 100 servers.** If an agent is ever deployed to >100 servers, Discord requires app verification (a manual review). Not a concern for personal agents but worth knowing.
- **Bot token vs application secret.** The **Bot** page token is the one you want. The **OAuth2** page shows a client secret, which is different and is only used for OAuth2 code exchange flows (not for bot login).
- **Do not enable Public Bot** unless you want anyone to be able to invite the bot to their server. For personal agents, leave **Public Bot** OFF on the Bot page.
- **Rate limits.** Discord's global rate limit is ~50 requests/second per bot. Agent code should handle 429 responses gracefully. Not a setup issue but a common runtime gotcha.

## Where This Is Used

- **Plugin**: `ai-mktpl/discord` (installed from the ai-mktpl marketplace)
- **Plugin settings reference**: The plugin reads `DISCORD_BOT_TOKEN` from the process environment. It is injected via `plugins.settings.yaml` with a reference like:
  ```yaml
  discord:
    env:
      DISCORD_BOT_TOKEN: "op://Agent-<Name>/ENVIRONMENT/DISCORD_BOT_TOKEN"
  ```
- **Access control**: The `/discord:access` skill manages who can DM the bot and which channels it listens in. Approve pairings only from the terminal — never from a Discord message itself (prompt injection risk).
- **Existing agent config example**: `~/src/nsheaps/.ai-agent-jack/plugins.settings.yaml` in Jack's repo shows the reference pattern.

## Related

- [Create Telegram Bot](./create-telegram-bot.md) — the Telegram equivalent of this flow
- [Create GitHub App](./create-github-app.md) — GitHub identity for the same agent
- [Create 1Password Vault and Service Account](./create-1password-vault-and-service-account.md) — where the token is stored
- [auth-credentials spec](../specs/auth-credentials.md) — design context for credential isolation
- [Discord Developer Docs](https://discord.com/developers/docs/topics/oauth2) — official OAuth2 reference
