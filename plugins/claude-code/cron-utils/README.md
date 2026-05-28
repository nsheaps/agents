# sched-utils

Scheduled-task discipline skills for Claude Code agents — packages the cron self-poll workflow and idle-conversation follow-up logic originally proven out in [nsheaps/.ai-agent-alex](https://github.com/nsheaps/.ai-agent-alex) (alex commit [3a324d0](https://github.com/nsheaps/.ai-agent-alex/commit/3a324d0), hoisted per Nate directive 2026-05-17 13:53Z). Mirrors the structure of the `task-utils` plugin (see [PR #142](https://github.com/nsheaps/agents/pull/142)).

## What it provides

**Skills**:

- **`idle-5-min`** — cron-tick delegate for the 5-minute self-poll. Invoked every 5 minutes by cron. Checks (a) in_progress tasks, (b) `MONITORING(...)` pending tasks, (c) `AGENT(...)` pending tasks, and any background shells; applies the self-correction discipline ladder (1st/2nd/3rd-fire); delegates to `active-convo-goes-idle` when the conversation has been idle past 30 minutes.

- **`active-convo-goes-idle`** — single-reminder decision skill. Invoked by `idle-5-min` when the 30-minute idle threshold is crossed. Decides whether enough idle time has passed to send ONE follow-up reminder, drafts the reminder in the correct format (with `<@user-id>` mentions and bullet-linked blockers), and returns either "send now" or "stay silent." Enforces the one-reminder-per-idle-period rule at the skill-logic level (no hook enforcement — agent discipline only).

## Installation

Add to your `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "sched-utils@agents": true
  },
  "extraKnownMarketplaces": {
    "agents": {
      "source": { "source": "github", "repo": "nsheaps/agents" }
    }
  }
}
```

Then in a fresh session:

```bash
claude plugin install sched-utils@agents
```

Skills are then available as `Skill(idle-5-min)` and `Skill(active-convo-goes-idle)`.

## Notes

**Soft spot — one-reminder-per-idle-period:** The `active-convo-goes-idle` skill instructs the agent to check its own recent messages before sending a reminder, and to stay silent if a reminder was already sent during the current idle period. This is enforced by skill logic only — there is no PreToolUse hook that gates Discord/Telegram send tools. Agent discipline is the sole enforcement mechanism.

**No hooks in this plugin:** Unlike `task-utils`, `sched-utils` ships no hooks. The scheduling discipline is entirely skill-driven.
