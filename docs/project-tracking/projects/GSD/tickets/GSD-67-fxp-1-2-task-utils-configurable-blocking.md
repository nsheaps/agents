---
type: feature
id: GSD-67
legacy_ids:
  - FXP/1.2
created: 2026-05-28T03:10:00Z
state: done
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-source
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L18
  - id: pr-178
    type: github-pr
    url: https://github.com/nsheaps/agents/pull/178
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
events:
  - { ts: 2026-05-28T03:10:00Z, by: alex, change: "backfilled — work shipped 2026-05-26 in PR #178, ticket created retroactively per Nate Discord 02:30Z scope-link directive" }
---

# FXP/1.2 — task-utils: configurable single-task blocking (PDITID)

## Original ask

From [fixprompt.md L18][^fixprompt-source]:

> PDITID remove the forced single task workstream hooks from task-utils by making a PR that allows the blocking to be configurable. get that merged before continuing. Use henry to review it, don't let me block you. Make sure it works. **I think I killed that for you so it won't stop you now, but next update would, so make that fix in the plugin right here and now.**

## Status

**state=done** — shipped 2026-05-26 in [PR #178][^pr-178] (task-utils v0.2.0). Plugin installed at `task-utils@agents`. Verified working: `TASK_UTILS_REQUIRE_TASK=0` opt-out disables the gate.

## Related

- [GSD-66](./GSD-66-fxp-1-8-1-port-task-mcp-from-pr157.md) — FXP/1.8.1 hoists this opt-out wiring as part of the task-MCP port.
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-source]: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L18
[^pr-178]: https://github.com/nsheaps/agents/pull/178
[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
