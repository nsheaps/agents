---
type: feature
id: GSD-95
aliases:
  - "FXP/SU.5"
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
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:17Z dashboard-reconcile directive — FXP/SU.5 had no ticket",
    }
---

# FXP/SU.5 — Create `alex-team` + launch incremental-improvement teammate

## Original ask

Discord 2026-05-28 17:47Z standup batch: create `alex-team` and launch an **incremental-improvement** teammate that receives struggle-feedback and drafts PRs improving subagents/skills/hooks/prompts.

## Status

**state=triage** — not yet started. Depends on FXP/1.7.3 ([GSD-82](./GSD-82-fxp-1-7-3-create-alex-brain-team.md)) which is blocked by spawn-auth-gap.

## Related

- [GSD-82](./GSD-82-fxp-1-7-3-create-alex-brain-team.md) — FXP/1.7.3 alex-brain team (blocker)
- [GSD-96](./GSD-96-fxp-su6-teammates-skill.md) — FXP/SU.6 teammates skill
- [GSD-97](./GSD-97-fxp-su8-struggling-skill.md) — FXP/SU.8 struggling skill (feeds into this)
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
