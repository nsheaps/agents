---
type: feature
id: GSD-93
aliases:
  - "FXP/SU.3"
created: 2026-05-28T21:20:00Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509638920527372390
  - id: task-659
    type: alex-task
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/6560d0ff-f5b1-4a9c-b585-d996c6a12250/659.json
    note: "#659: henry-mirror background agent dispatched"
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:17Z dashboard-reconcile directive — FXP/SU.3 had no ticket",
    }
---

# FXP/SU.3 — Henry task-setup mirror

## Original ask

Discord 2026-05-28 17:47Z standup batch (**priority callout** from Nate): mirror alex's `.claude/scheduled-tasks.yaml` + restoration rule into henry repo via PR.

## Status

**state=triage** — alex-task [#659](https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/6560d0ff-f5b1-4a9c-b585-d996c6a12250/659.json) created, `henry-mirror` background agent dispatched. PR status unknown.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
