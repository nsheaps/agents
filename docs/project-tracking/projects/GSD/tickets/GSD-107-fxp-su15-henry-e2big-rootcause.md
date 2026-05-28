---
type: feature
id: GSD-107
aliases:
  - "FXP/SU.15"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/670.yaml
events:
  - {
      ts: 2026-05-28T22:00:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.15 had no canonical GSD ticket",
    }
---

# GSD-107 — diagnose Henry's persistent E2BIG (runtime root cause)

## Original ask

Diagnose Henry's persistent E2BIG error — the on-disk shell snapshot is clean, so root cause is runtime env accretion. Find and prevent.

## Status

**state=triage** — backfilled from alex-task #670.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #670][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20

[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/670.yaml
