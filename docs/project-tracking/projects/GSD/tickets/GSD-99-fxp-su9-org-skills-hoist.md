---
type: feature
id: GSD-99
aliases:
  - "FXP/SU.9"
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
      change: "filed per Nate 2026-05-28 21:17Z dashboard-reconcile directive — FXP/SU.9 had no ticket",
    }
---

# FXP/SU.9 — `.claude/skills/.org/` → `~/src/nsheaps/.org/skills/` symlink + hoist-skills subagent

## Original ask

Discord 2026-05-28 17:47Z standup batch: create a symlink from `~/src/nsheaps/.ai-agent-alex/.claude/skills/.org/` to `~/src/nsheaps/.org/skills/`, then run a hoist-skills subagent that processes one skill at a time — merge, correct, create, drop, or genericize.

## Status

**state=triage** — not yet started.

## Scope

- Create `.org/skills/` directory at `~/src/nsheaps/.org/`
- Symlink `.claude/skills/.org/` → `~/src/nsheaps/.org/skills/`
- Hoist-skills subagent: one skill at a time, merge/correct/create/drop/genericize

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
