---
type: feature
id: GSD-116
aliases:
  - "FXP/SU.24"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/681.yaml
events:
  - {
      ts: 2026-05-28T22:00:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.24 had no canonical GSD ticket",
    }
---

# GSD-116 — BEHAVIOR-CHANGING: ticket frontmatter aliases + retro backfill

## Original ask

BEHAVIOR-CHANGING: Add aliases section to ticket frontmatter (for FXP/N, SU.N, etc. cross-refs); retro-backfill existing tickets.

## Status

**state=triage** — backfilled from alex-task #681.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #681][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20

[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/681.yaml
