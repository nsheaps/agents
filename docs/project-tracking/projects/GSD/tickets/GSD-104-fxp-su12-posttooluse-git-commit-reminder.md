---
type: feature
id: GSD-104
aliases:
  - "FXP/SU.12"
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
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/665.yaml
events:
  - { ts: 2026-05-28T22:00:00Z, by: alex, change: "filed per Nate 2026-05-28 21:55-21:57Z FXP→GSD reconcile directive — FXP/SU.12 had no canonical GSD ticket" }
---

# GSD-104 — PostToolUse hook on Bash(git commit:*) for throttled task-discipline reminder

## Original ask

Add PostToolUse hook on Bash(git commit:*) — 1m throttled reminder that nudges the agent to keep tasks/tickets in sync with each commit.

## Status

**state=triage** — backfilled from alex-task #665.

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)
- [alex-task #665][^alex-task]

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
[^alex-task]: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/alex/665.yaml
