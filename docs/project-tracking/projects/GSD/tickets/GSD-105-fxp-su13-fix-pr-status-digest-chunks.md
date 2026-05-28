---
type: feature
id: GSD-105
aliases:
  - "FXP/SU.13"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/666.yaml
events:
  - { ts: 2026-05-28T22:00:00Z, by: alex, change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.13 had no canonical GSD ticket" }
---

# GSD-105 — fix nsheaps/agents pr-status-digest workflow chunk tolerance

## Original ask

Fix the pr-status-digest workflow in nsheaps/agents — chunk tolerance + JSON-parse fallback when a per-repo emit fails.

## Status

**state=triage** — backfilled from alex-task #666.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #666][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/666.yaml
