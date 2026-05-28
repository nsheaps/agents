---
title: Create a Telegram Bot
purpose: Step-by-step runbook for creating a Telegram bot via BotFather, configuring privacy settings so the bot can read group messages, adding it to groups, and retrieving chat IDs for the agent's telegram plugin.
audience: human
last_reviewed: 2026-04-09
---

# Create a Telegram Bot

## Purpose

This runbook walks through creating a Telegram bot via `@BotFather`, disabling
group privacy mode so the bot can see all messages (not just mentions),
adding it to groups or starting DMs, and finding chat IDs for groups the
agent should monitor. The resulting `TELEGRAM_BOT_TOKEN` is consumed by the
`ai-mktpl/telegram` plugin.

One Telegram bot per agent. Telegram does not allow renaming the bot's
`@username` after creation — choose carefully on the first attempt.

## Prerequisites

- Telegram account (mobile or desktop client logged in)
- Admin access to any Telegram group the bot will be added to (non-admin members cannot add bots to groups in most configurations)
- 1Password vault already provisioned for the agent (see `create-1password-vault-and-service-account.md`)
- `curl` and `jq` available locally (for the verification and chat ID steps)

## Steps

### 1. Start a chat with BotFather

1. Open Telegram
2. In the search bar (top of the client), type `BotFather`
3. Tap the result with the blue verified checkmark — username `@BotFather`. Do NOT tap any unverified lookalikes.
4. Tap **Start** (or send `/start` if the button is missing)

BotFather responds with a menu of commands.

### 2. Create the bot

1. Send `/newbot`
2. BotFather asks for a display name. Send a human-readable name like `Jack Oat` or `Henry Nsheaps`. This is what shows in the contact list.
3. BotFather asks for a `@username`. This must:
   - End in `bot` (case-insensitive — `Bot`, `_bot`, `bot` all work)
   - Be globally unique across Telegram
   - Be 5–32 characters
   - Use only letters, numbers, and underscores
4. Convention: `<agent_name>_nsheaps_bot` (e.g. `jack_nsheaps_bot`, `henry_nsheaps_bot`). Send it.
5. If the username is taken, BotFather asks for a different one. Try variants.

On success, BotFather replies with a message containing:

- The bot's `t.me/<username>` link
- **The HTTP API token** formatted as `<bot_id>:<random_string>` (e.g. `1234567890:AAHr...`)
- A link to the Bot API docs

**Copy the token immediately.** BotFather does keep it and you can retrieve it
later via `/mybots`, but that's an extra step.

### 3. Disable group privacy

By default, bots in groups only see messages that mention them or start with
a `/command`. For an agent that needs to read all group chatter, this must
be disabled.

1. Send `/setprivacy` to BotFather
2. BotFather lists your bots. Tap (or type) the bot you just created.
3. BotFather shows two options: **Enable** and **Disable**
4. Tap **Disable**

BotFather confirms: `Success! The new status is: DISABLED. /help`

> **Important:** If the bot is already in a group, you must REMOVE and RE-ADD it for the new privacy setting to take effect. Existing group memberships keep the old setting.

### 4. Set description and about text (optional)

1. `/setdescription` — longer description shown when opening a DM with the bot for the first time
2. `/setabouttext` — shorter text shown on the bot's profile

Both are purely cosmetic but help you identify which bot is which when you
have multiple.

### 5. Set a profile picture (optional)

1. `/setuserpic`
2. BotFather prompts you to send a photo. Upload a square image (at least 320x320).

### 6. Store the token in 1Password

1. Open <https://my.1password.com>
2. Navigate to the agent's vault (e.g. `Agent-Jack`)
3. Open the **ENVIRONMENT** item
4. Click **Edit**
5. Add a new field: label `TELEGRAM_BOT_TOKEN`, type **Password**
6. Paste the token (format `<bot_id>:<random>`)
7. Click **Save**

Via CLI:

```bash
op item edit "ENVIRONMENT" --vault "Agent-<Name>" \
  "TELEGRAM_BOT_TOKEN[password]=$(pbpaste)"
```

### 7. Add the bot to groups

For each Telegram group the agent should participate in:

1. Open the group in Telegram
2. Tap the group name at the top to open group info
3. Tap **Add members** (iOS/Android) or **Add Members** (Desktop)
4. Search for the bot's `@username` (the one ending in `bot`)
5. Tap the bot in the results, then **Add** / **Invite**
6. Telegram may warn "This bot cannot be added to groups" — this happens if `Allow Groups?` is disabled in BotFather. Fix by sending `/setjoingroups` → select bot → Enable.

Send a test message in the group after adding the bot.

### 8. Find the chat ID for each group

This is needed because the agent's telegram plugin uses numeric chat IDs,
not group names, for routing.

1. **Send a fresh test message in the group immediately before running the
   command below.** `getUpdates` only returns messages from the last 24 hours,
   AND Telegram marks updates as "seen" after each successful `getUpdates`
   call — so on re-runs you may get an empty result even for messages that
   are only a few minutes old. A fresh message right before the call avoids
   both gotchas.
2. Then run:

```bash
TOKEN="$(op read "op://Agent-<Name>/ENVIRONMENT/TELEGRAM_BOT_TOKEN")"
curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates" > /tmp/telegram-updates.json
```

3. Read the file and find entries with `"chat": { "type": "group", ... }`:

```bash
jq '.result[] | .message.chat | {id, title, type}' /tmp/telegram-updates.json
```

Output will look like:

```json
{
  "id": -1001234567890,
  "title": "Family",
  "type": "supergroup"
}
```

4. Note the `id` (negative for groups, positive for DMs). Store these in the
   agent's channel config (not in 1Password — chat IDs are not secrets).

> **Note:** If the result is empty even after sending a fresh test message, the bot is likely running in webhook mode elsewhere — `getUpdates` is incompatible with webhooks. Either stop the agent first, call `deleteWebhook`, or use the Telegram API's `getChat` with a public group username instead.

## Verification

Confirm the token is valid:

```bash
TOKEN="$(op read "op://Agent-<Name>/ENVIRONMENT/TELEGRAM_BOT_TOKEN")"
curl -s "https://api.telegram.org/bot${TOKEN}/getMe" | jq .
```

Expected response:

```json
{
  "ok": true,
  "result": {
    "id": 1234567890,
    "is_bot": true,
    "first_name": "Jack Oat",
    "username": "jack_nsheaps_bot",
    "can_join_groups": true,
    "can_read_all_group_messages": true,
    "supports_inline_queries": false
  }
}
```

Key fields to verify:

- `is_bot`: true
- `can_join_groups`: true (confirms `/setjoingroups` is enabled)
- `can_read_all_group_messages`: **true** (confirms `/setprivacy` is DISABLED — this is the critical check)

If `can_read_all_group_messages` is false, the privacy disable didn't stick.
Send `/setprivacy` → select the bot → **Disable** again, then verify.

## Common Pitfalls

- **Privacy not disabled.** The bot sits silent in groups, only responding to @mentions and slash commands. Always verify `can_read_all_group_messages: true` via `getMe` before debugging.
- **Didn't re-add after changing privacy.** Privacy setting only applies to groups the bot joins AFTER the setting changes. Existing memberships keep the old setting — you must remove and re-add the bot.
- **Bot username reuse.** If you delete a bot via `/deletebot`, the username is released immediately for reuse, but you cannot reuse it on a bot you already own. Choose wisely.
- **Group vs supergroup IDs.** Regular groups have IDs like `-123456`. Supergroups have IDs like `-1001234567890`. Both are negative. If a group gets upgraded to a supergroup (automatic when members exceed ~200), the chat ID CHANGES. Your config needs updating.
- **getUpdates conflicts with webhooks.** If a webhook is set (via `setWebhook`), `getUpdates` returns an error. Either delete the webhook first with `deleteWebhook` or inspect chat IDs via `getChat?chat_id=@groupusername` for public groups.
- **Rate limits.** Telegram throttles to ~30 messages/second per bot globally, and ~20/minute per chat. Bursty agent replies will get 429'd.
- **Token leak.** If the token leaks, immediately send `/revoke` in BotFather to get a new one. The old token stops working instantly.
- **Allow groups setting.** If `/setjoingroups` is set to Disabled, the bot cannot be added to any group. Easy to miss because BotFather doesn't warn when you try.

## Where This Is Used

- **Plugin**: `ai-mktpl/telegram`
- **Plugin settings reference**:
  ```yaml
  telegram:
    env:
      TELEGRAM_BOT_TOKEN: "op://Agent-<Name>/ENVIRONMENT/TELEGRAM_BOT_TOKEN"
  ```
- **Access control**: `/telegram:access` skill manages DM and group allowlists. Approve pairings only from the terminal.
- **Chat IDs**: Stored in the agent's `.claude/` config (non-secret), referenced by the telegram plugin's routing rules.

## Related

- [Create Discord Bot](./create-discord-bot.md) — the Discord equivalent of this flow
- [Create GitHub App](./create-github-app.md) — GitHub identity for the same agent
- [Create 1Password Vault and Service Account](./create-1password-vault-and-service-account.md) — where the token is stored
- [auth-credentials spec](../specs/auth-credentials.md) — design context for credential isolation
- [Telegram Bot API Docs](https://core.telegram.org/bots/api) — official reference
- [BotFather Docs](https://core.telegram.org/bots#botfather) — full command list
