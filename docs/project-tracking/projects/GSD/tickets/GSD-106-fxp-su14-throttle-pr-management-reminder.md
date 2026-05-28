---
type: feature
id: GSD-106
aliases:
  - "FXP/SU.14"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/668.yaml
events:
  - { ts: 2026-05-28T22:00:00Z, by: alex, change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.14 had no canonical GSD ticket" }
---

# GSD-106 — throttle update-PR-title/description reminder from common-sense:pr-management

## Original ask

Throttle the 'update PR title/description' reminder emitted by the common-sense:pr-management skill — currently fires too often.

## Status

**state=triage** — backfilled from alex-task #668.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #668][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/668.yaml
