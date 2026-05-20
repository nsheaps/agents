---
name: using-settings-write-guard
description: Use when the agent-utils settings-write-guard PostToolUse hook prints a 2-line WARN about a settings.json write happening outside $AGENT_REPO/.claude/settings.json, OR before writing/editing any ~/.claude/settings*.json (user-scope) file. Trigger phrases — "the hook is firing on my settings write", "I got a wiped-on-agent-restart warning", "where should I redirect this settings edit?", "/plugin install added something — does it persist?". See `what-survives-agent-restart` for the doctrine this enforces.
---

# using-settings-write-guard

The hook fired. Don't panic — it's a warning, not a block. Here's what to do.

## What the warning means

```
WARN: All settings files except <AGENT_REPO>/.claude/settings.json are wiped on agent restart. Any settings that need to be preserved must go in that settings file.
WARN: Your $AGENT_REPO is <path>
```

You tried to write to a `.claude/settings*.json` file that ISN'T `$AGENT_REPO/.claude/settings.json`. That target won't survive a restart of the `bin/agent` launcher's onboarding flow. (See `what-survives-agent-restart` for the underlying contract.)

The hook is informational. The write still happened. But it WILL be lost on the next restart unless you also mirror it into the canonical file.

## Redirect protocol

**For Edit / Write / MultiEdit / NotebookEdit / Update on `~/.claude/settings*.json`:**

Re-do the same change against `$AGENT_REPO/.claude/settings.json` instead. The original user-scope write is fine as a short-lived working copy, but the durable home is repo-scope.

**For `/plugin install foo@bar`:**

The slash command writes the enable to user-scope. To persist, add the entry to `$AGENT_REPO/.claude/settings.json` under `enabledPlugins`:

```json
{
  "enabledPlugins": {
    "foo@bar": true
  }
}
```

Same for `/plugin uninstall` (flip to `false` or remove the key in repo-scope) and for marketplace registrations (`extraKnownMarketplaces`).

**For `Bash(claude plugin install …)` or `Bash($(claude plugin …))`:**

Same as the slash-command case — mirror the persistent equivalent into `$AGENT_REPO/.claude/settings.json`.

## What if `$AGENT_REPO` isn't set?

The hook falls back to cwd and logs that path in the second WARN line. If you're working in an out-of-harness subagent (managed outside claude-code's agent-teams — e.g. our own SendMessage-driven subagents), you may legitimately have no AGENT_REPO and need a local config. That's the phase-2 escape valve. Don't fight the warning in that case — note it and proceed.

## What NOT to do

- Don't disable the hook to silence the warning. The warning is the point.
- Don't write the same change into BOTH locations and call it done — repo-scope is the canonical, and the merge tool exists precisely so you don't have to dual-write. See `using-settings-merge`.
- Don't redirect to `$AGENT_REPO/.claude/settings.local.json` — that file isn't checked in and has the same ephemerality risk.

## Sibling skills

- [`what-survives-agent-restart`](../what-survives-agent-restart/SKILL.md) — the doctrine this hook enforces.
- [`using-settings-merge`](../using-settings-merge/SKILL.md) — recover user-scope writes back into the canonical file after the fact.
