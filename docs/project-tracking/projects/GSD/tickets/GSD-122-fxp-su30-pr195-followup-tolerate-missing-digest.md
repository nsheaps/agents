---
type: feature
id: GSD-122
aliases:
  - "FXP/SU.30"
created: 2026-05-28T22:00:00Z
state: triage
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
  - id: alex-task
    type: github-blob
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/687.yaml
events:
  - {
      ts: 2026-05-28T22:00:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.30 had no canonical GSD ticket",
    }
---

# GSD-122 — pr195 follow-up: tolerate missing digest file in patch-event

## Original ask

Fix patch-event handler in pr-status-cli to tolerate missing digest file (graceful fallback to regen).

## Status

**state=triage** — backfilled from alex-task #687.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #687][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20

[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/687.yaml
