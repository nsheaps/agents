---
name: active-convo-goes-idle
description: Use when an active conversation has gone idle and the agent is blocked waiting for answers or actions from people. Decides whether enough idle time has passed (default 30m since the last response from the blocker) to send a single, well-formatted reminder. Returns either a "send reminder now" instruction with the exact message text, or "stay quiet" with the reason. Trigger phrases — "the convo's been idle for a while, should I ping?", "I've been waiting on X for N minutes, should I follow up?", "is it time to remind Nate about the open question?".
---

<!-- SOURCE: nsheaps/.ai-agent-alex/.claude/skills/active-convo-goes-idle/SKILL.md (alex commit 3a324d0) -->
<!-- SEE-ALSO: ../idle-5-min/SKILL.md (cron entry point), agentic-behavior/rules/communication-discipline.md -->

# active-convo-goes-idle

This skill executes **inline** in the caller's context (no `context: fork`, no `model:` override) — it's meant to be a tight decision-and-template step inside the calling skill (typically `idle-5-min`), not a separate sub-agent dispatch.

You are deciding whether the active conversation has been idle long enough to warrant a SINGLE follow-up reminder — and if yes, what that reminder should say.

---

## 1. The rule

When an active conversation goes idle and you are blocked waiting for answers or actions from one or more people:

- **First 30 minutes of idle:** silent. The handler may have stepped away briefly.
- **At 30 minutes** since the last response from a blocker: send ONE reminder, then go silent again until you actually receive a response or new direction.
- **More than one reminder per idle period:** forbidden. If you've already sent the 30-min reminder, do nothing further on subsequent cron fires — wait for an actual response.

"Idle period" resets when the blocker (or any handler) replies. A new idle clock starts after their reply if you are still blocked.

---

## 2. Decide BEFORE writing the reminder

Run this check in order:

1. **Am I actually blocked?** If there's productive work I could do that doesn't depend on the blocker, do that work instead. Reminders are for genuine blockers, not "I'd prefer their input."
2. **Has it really been 30m since their last response?** Check the last Discord/Telegram message from the blocker. If <30m, stay silent.
3. **Have I already sent a reminder during this idle period?** Check my own recent messages. If yes, stay silent.
4. **Is the blocker something the handler can actually act on right now?** If the blocker is "CI finishes in 2 min," do NOT ping the handler — wait for CI.

Only if all 4 checks pass: send the reminder.

---

## 3. Reminder format

The reminder MUST use `<@user-id>` mention syntax — name-prefix like "Nate —" does NOT trigger a notification on Discord. Handler/peer-agent user IDs:

| Person/agent   | User ID               |
| -------------- | --------------------- |
| Nate (handler) | `303922555947843585`  |
| Alex           | `1490865105280307260` |
| Henry          | `1493957087988809828` |
| Jack           | `1490875293878059099` |

### Template

```
I'm ready to work on <next thing(s) I would do if unblocked> next but I'm blocked by the following things:

From <@user-id>:
- <blocker 1, with markdown link to PR/issue/thread for context>
- <blocker 2, with markdown link>
- <blocker 3, with markdown link>

From <@another-user-id>:
- <blocker 1, with markdown link>
```

### Concrete example

```
I'm ready to merge PR #142 and start the lint-workflow port next but I'm blocked by:

From <@303922555947843585>:
- option 1/2/3/4 decision on [PR #143](https://github.com/nsheaps/agents/pull/143) test failure ([msg](https://discord.com/channels/.../1505529729657208944))
- merge ack on [PR #142](https://github.com/nsheaps/agents/pull/142)
- ack to interrupt [jack](https://discord.com/...) for FIX 1/3/4 validation restart
```

### Required elements

- Opening: "I'm ready to work on X next but I'm blocked by the following things:" (or equivalent — must convey _what would unblock and what I'd do next_).
- Group blockers by person using `<@user-id>` mention.
- Every blocker is a bullet with a clickable markdown link to the artifact (PR, issue, thread message, doc).
- Keep it scannable — no full-paragraph re-explanation of what they already saw. Just "what I need + where."

### Anti-patterns

| Bad                                                             | Good                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| "Hey Nate, just checking in"                                    | The full template with `<@user-id>` + bulleted blockers      |
| "Are you still there?" / "Ping"                                 | Names what I'm waiting for + what I'd do next                |
| Sending again 5 minutes later because they still didn't respond | Once per idle period — wait for an actual reply              |
| Name-prefix only ("Nate —")                                     | `<@303922555947843585>` (real mention triggers notification) |
| Reminder that re-narrates the original ask                      | Just the link + one-clause description                       |

---

## 4. What this skill does NOT cover

- **The cron's periodic check itself** — that's `../idle-5-min/SKILL.md`. This skill is invoked BY that one when the idle threshold is crossed.
- **Routine status updates** — if the handler asked for status, this is not "idle reminder," it's a direct request. Reply normally.
- **Peer-agent coordination requests** — pinging a peer to start work on something is not a reminder, it's an initial ask. Use normal ping format.

---

## 5. Output contract

When invoked, return:

- A 1-2 sentence decision: "Send the reminder now — <reason>." OR "Stay silent — <reason>."
- If sending: the exact reminder text, ready to paste into `mcp__plugin_discord_discord__reply` (or equivalent channel tool).
- If staying silent: the next time threshold (e.g. "next check at 14:23Z if no reply").

The caller (typically `idle-5-min`) executes the actual send — this skill decides and drafts only.
