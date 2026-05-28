---
type: feature
id: GSD-97
aliases:
  - "FXP/SU.8"
created: 2026-05-28T21:20:00Z
state: triage
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509638920527372390
  - id: behavior-correction-thread
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1509613443131506718
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:17Z dashboard-reconcile directive — FXP/SU.8 had no ticket",
    }
---

# FXP/SU.8 — "Struggling" skill

## Original ask

Discord 2026-05-28 17:47Z standup batch: define "struggling" via discussion in [#behavior-correction](https://discord.com/channels/1490863845252665415/1509613443131506718), document it as a skill, and wire to the incremental-improvement teammate.

## Status

**state=triage** — not yet started.

## Scope

- Define "struggling" based on #behavior-correction discussion
- Document as a skill in alex repo
- Wire trigger/handoff to incremental-improvement teammate (FXP/SU.5 / [GSD-95](./GSD-95-fxp-su5-alex-team-incremental-improvement.md))

## Related

- [GSD-95](./GSD-95-fxp-su5-alex-team-incremental-improvement.md) — FXP/SU.5 incremental-improvement (downstream)
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
