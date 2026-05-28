---
type: feature
id: GSD-112
aliases:
  - "FXP/SU.20"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/675.yaml
events:
  - { ts: 2026-05-28T22:00:00Z, by: alex, change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.20 had no canonical GSD ticket" }
---

# GSD-112 — triage: Bash output >5 lines + structured SDQ-CLI

## Original ask

Add triage tickets — Bash output >5 lines should auto-route through SDQ-CLI for structured display. Already filed as GSD-78 + GSD-79.

## Status

**state=triage** — backfilled from alex-task #675.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #675][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/675.yaml
