---
type: feature
id: GSD-108
aliases:
  - "FXP/SU.16"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/671.yaml
events:
  - {
      ts: 2026-05-28T22:00:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.16 had no canonical GSD ticket",
    }
---

# GSD-108 — check alex+jack for session-env bloat pattern; prevent recurrence

## Original ask

Check alex and jack for the same session-env-chain bloat pattern that hit Henry. Add prevention (hook or rule).

## Status

**state=triage** — backfilled from alex-task #671.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #671][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20

[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/671.yaml
