---
type: feature
id: GSD-82
aliases:
  - "FXP/1.7.3"
created: 2026-05-28T21:20:00Z
state: triage
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
  - id: blocking-task
    type: alex-task
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/6560d0ff-f5b1-4a9c-b585-d996c6a12250/631.json
    note: "#631: blocked by spawn-auth-gap"
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:17Z dashboard-reconcile directive — FXP/1.7.3 had no ticket",
    }
---

# FXP/1.7.3 — Create alex-brain team

## Original ask

Create an `alex-brain` agent team using the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` feature enabled in FXP/1.7.1 ([GSD-75](./GSD-75-fxp-1-7-1-agent-teams-env-var.md)).

## Status

**state=triage** — blocked by spawn-auth-gap (alex-task [#631](https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/6560d0ff-f5b1-4a9c-b585-d996c6a12250/631.json)). Agent teams cannot spawn sub-agents without resolving the auth handoff issue.

## Blockers

- spawn-auth-gap ([#631](https://github.com/nsheaps/.ai-agent-alex/blob/main/tasks/6560d0ff-f5b1-4a9c-b585-d996c6a12250/631.json)) — agent teams spawning needs auth resolution

## Related

- [GSD-75](./GSD-75-fxp-1-7-1-agent-teams-env-var.md) — FXP/1.7.1 env var
- [GSD-81](./GSD-81-fxp-1-7-2-restart-after-agent-teams.md) — FXP/1.7.2 restart step
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
