---
type: feature
id: GSD-114
aliases:
  - "FXP/SU.22"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/678.yaml
events:
  - {
      ts: 2026-05-28T22:00:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.22 had no canonical GSD ticket",
    }
---

# GSD-114 — ticket-utils: skip to-triage step + direct file (BEHAVIOR-CHANGING)

## Original ask

BEHAVIOR-CHANGING: Skip the to-triage intermediate step in ticket-utils — file directly to GSD with state=triage. Already filed as GSD-80.

## Status

**state=triage** — backfilled from alex-task #678.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #678][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20

[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/678.yaml
