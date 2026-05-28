---
type: feature
id: GSD-111
aliases:
  - "FXP/SU.19"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/674.yaml
events:
  - { ts: 2026-05-28T22:00:00Z, by: alex, change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.19 had no canonical GSD ticket" }
---

# GSD-111 — triage on agents: Bash | head/tail → SDQ rewrite

## Original ask

Add triage ticket on nsheaps/agents — Bash pipe to head/tail should be rewritten using the SDQ-CLI structured-output pattern. Already filed as GSD-77.

## Status

**state=triage** — backfilled from alex-task #674.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #674][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/674.yaml
