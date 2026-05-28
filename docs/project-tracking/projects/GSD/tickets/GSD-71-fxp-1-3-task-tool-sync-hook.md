---
type: feature
id: GSD-71
legacy_ids:
  - FXP/1.3
aliases:
  - "FXP/1.3"
created: 2026-05-28T03:15:00Z
state: done
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-642"
    note: "#642: FXP/1.12 PARENT pr-status-cli + skill (broken down — see #643+)"
  - id: fixprompt-source
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L19
  - id: commit-418ebb1
    type: github-commit
    url: https://github.com/nsheaps/.ai-agent-alex/commit/418ebb1
  - id: commit-5e6769b
    type: github-commit
    url: https://github.com/nsheaps/.ai-agent-alex/commit/5e6769b
  - id: hook-task-sync
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/.claude/hooks/task-sync.sh
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
events:
  - {
      ts: 2026-05-28T03:15:00Z,
      by: alex,
      change: "backfilled — work shipped 2026-05-26, ticket created retroactively per Nate Discord 02:30Z directive to GSD-link existing Phase-1 done items",
    }
---

# FXP/1.3 — task-tool-sync hook (local) + 2599 task sync

## Original ask

From [fixprompt.md L19][^fixprompt-source]:

> **PDITID add a hook to your agent repo configs so calls to task tools auto copy them into the alex repo and commits them with a generic message and pushes them (to main)**
> sync your tasks as they are now too, and update the dashboard to _now_ link to the tasks

## Status

**state=done** — shipped 2026-05-26 in two commits:

- [commit `418ebb1`][^commit-418ebb1] — hook implementation + config wiring at [`.claude/hooks/task-sync.sh`][^hook-task-sync]
- [commit `5e6769b`][^commit-5e6769b] — bulk sync of all 2599 existing tasks into the alex repo

The hook auto-commits task tool outputs to main on every task mutation. Dashboard (issue #20) updated to link to synced task files.

## Related

- [GSD-72](./GSD-72-fxp-1-3-1-agent-task-binding-hook.md) — FXP/1.3.1 (agent-task-binding hook, extends this work; in-progress)
- [GSD-67](./GSD-67-fxp-1-2-task-utils-configurable-blocking.md) — FXP/1.2 (task-utils configurable blocking, prerequisite)
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-source]: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L19

[^commit-418ebb1]: https://github.com/nsheaps/.ai-agent-alex/commit/418ebb1

[^commit-5e6769b]: https://github.com/nsheaps/.ai-agent-alex/commit/5e6769b

[^hook-task-sync]: https://github.com/nsheaps/.ai-agent-alex/blob/main/.claude/hooks/task-sync.sh

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
