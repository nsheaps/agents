---
type: feature
id: GSD-109
aliases:
  - "FXP/SU.17"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/672.yaml
events:
  - { ts: 2026-05-28T22:00:00Z, by: alex, change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.17 had no canonical GSD ticket" }
---

# GSD-109 — pr-status-cli — default to --all-open + sort order open→merged→closed

## Original ask

pr-status-cli: default to --all-open (always show open PRs); sort order open-by-mergeability → merged → closed. Folds SU.17b (#676) sort-order companion.

## Status

**state=triage** — backfilled from alex-task #672.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #672][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/672.yaml
