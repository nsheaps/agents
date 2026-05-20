---
name: what-survives-agent-restart
description: Use when deciding WHERE to put persistent configuration in a Claude Code agent — plugin enablement, marketplace registration, hook wiring, custom commands, or any settings that need to outlive a restart. Trigger phrases — "where should this setting go?", "why did my plugin disappear after restart?", "is ~/.claude/settings.json the right place for X?", "what gets wiped on restart?", "should I put this in repo-scope or user-scope settings?".
---

# what-survives-agent-restart

**Doctrine for Claude Code agents managed via the `bin/agent` launcher pattern** (alex / jack / henry / future agents in `nsheaps/.ai-agent-*`). If your agent runtime is something else, this doctrine may not apply — verify first.

## The contract

Only files under `$AGENT_REPO` survive an agent restart. Files under `$CLAUDE_CONFIG_DIR` (typically `~/.agents/<name>/.claude/`) are wiped on every restart of the launcher's onboarding flow.

| Location                              | Survives restart? | Use for                                                                                                |
| ------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `$AGENT_REPO/.claude/settings.json`   | ✅ yes            | **Source of truth** for plugin enablement, marketplace registration, hook wiring, and persistent state |
| `$AGENT_REPO/.claude/*` (other files) | ✅ yes            | Skills, agents, commands, rules — anything the agent should re-acquire on every restart                |
| `$CLAUDE_CONFIG_DIR/.claude/*`        | ❌ no             | Ephemeral working state — Claude Code's own session bookkeeping, slash-command history, etc.           |

## What this means in practice

When you (or the human at the keyboard) run `/plugin install foo@bar`, claude-code writes the enablement to user-scope `~/.claude/settings.json`. **That write does not survive a restart.** The persistent equivalent is to add `"foo@bar": true` under `enabledPlugins` in `$AGENT_REPO/.claude/settings.json` — that file IS checked into the agent repo and IS re-read on every fresh launch.

Same rule for marketplaces — `extraKnownMarketplaces` belongs in repo-scope, not user-scope.

If you write a `.claude/settings.json` outside `$AGENT_REPO`, the `agent-utils` plugin's `settings-write-guard` hook will print a 2-line WARN reminding you the change is ephemeral. See the sibling skill `using-settings-write-guard` for what to do when that fires.

## When user-scope state has drifted from repo-scope

If a restart already wiped user-scope state and you want to recover whatever was there into the canonical location, see `using-settings-merge` for the 2-stage merge script.

## Exception

Out-of-harness subagents (managed outside claude-code's built-in agent-teams — e.g. our own SendMessage-driven subagents) may legitimately need their own local config and have no `$AGENT_REPO`. The doctrine here is for the primary agent runtime, not those.

## Sibling skills

- [`using-settings-write-guard`](../using-settings-write-guard/SKILL.md) — what to do when the hook fires.
- [`using-settings-merge`](../using-settings-merge/SKILL.md) — recover user-scope drift into the canonical location.
