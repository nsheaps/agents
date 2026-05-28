---
type: feature
id: GSD-115
aliases:
  - "FXP/SU.23"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/680.yaml
events:
  - { ts: 2026-05-28T22:00:00Z, by: alex, change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.23 had no canonical GSD ticket" }
---

# GSD-115 — retro task refs on GSD tickets + skill update

## Original ask

Retro-backfill alex-task references on existing GSD tickets that were created without them; update the ticket-create skill to require originating-task ref. Tracked under GSD-52 umbrella.

## Status

**state=triage** — backfilled from alex-task #680.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #680][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/680.yaml
