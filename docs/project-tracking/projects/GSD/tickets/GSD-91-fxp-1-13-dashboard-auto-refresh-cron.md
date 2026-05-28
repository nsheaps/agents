---
type: feature
id: GSD-91
aliases:
  - "FXP/1.13"
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
      change: "filed per Nate 2026-05-28 21:17Z dashboard-reconcile directive — FXP/1.13 had no ticket",
    }
---

# FXP/1.13 — Dashboard auto-generation cron

## Original ask

Nate flagged 2026-05-28 17:47Z standup: "the github cron workflow for generating the dashboard on a schedule." Currently the dashboard (issue #20) is updated by hand. Need a workflow analogous to `pr-status-digest.yaml` that reads task/ticket state and rewrites issue #20 body on a schedule.

## Status

**state=triage** — not yet started.

## Scope

- Build `.github/workflows/dashboard-refresh.yaml` in `nsheaps/.ai-agent-alex` repo
- Reads `tasks/`, MASTER.md, REPOS.md, open PRs
- Formats as issue body
- Runs `gh issue edit 20 --body-file` on schedule

## Related

- [GSD-85](./GSD-85-fxp-1-12-2-pr-status-digest-workflow.md) — FXP/1.12.2 analogous workflow
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
