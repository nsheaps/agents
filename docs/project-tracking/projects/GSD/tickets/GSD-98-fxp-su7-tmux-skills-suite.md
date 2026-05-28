---
type: feature
id: GSD-98
aliases:
  - "FXP/SU.7"
created: 2026-05-28T21:20:00Z
state: triage
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509638920527372390
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:17Z dashboard-reconcile directive — FXP/SU.7 had no ticket",
    }
---

# FXP/SU.7 — tmux skills suite

## Original ask

Discord 2026-05-28 17:47Z standup batch: build a tmux skills suite — `tool-tmux-index`, `tool-tmux-<subcommand>`, `tool-claude-team-spawn-teammate` — each with `context: fork` semantics and agent prompts stored in alex repo.

## Status

**state=triage** — not yet started.

## Scope

- `tool-tmux-index` skill
- `tool-tmux-<subcommand>` skill(s)
- `tool-claude-team-spawn-teammate` skill with `context: fork`
- All stored in `.claude/skills/` in alex repo

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
