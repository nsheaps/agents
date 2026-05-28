---
type: feature
id: GSD-121
aliases:
  - "FXP/SU.29"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/686.yaml
events:
  - { ts: 2026-05-28T22:00:00Z, by: alex, change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.29 had no canonical GSD ticket" }
---

# GSD-121 — pr-digest-event-driven: patch in-place, not regenerate

## Original ask

PR event triggers (state-change webhooks) should patch the digest in-place, not regenerate from scratch.

## Status

**state=triage** — backfilled from alex-task #686.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #686][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/686.yaml
