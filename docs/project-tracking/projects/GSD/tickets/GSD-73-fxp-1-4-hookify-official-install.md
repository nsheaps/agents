---
type: feature
id: GSD-73
legacy_ids:
  - FXP/1.4
created: 2026-05-28T03:15:00Z
state: done
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-source
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L21
  - id: commit-420317b
    type: github-commit
    url: https://github.com/nsheaps/.ai-agent-alex/commit/420317b
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

# FXP/1.4 — hookify@official install + 3 behavior configs

## Original ask

From [fixprompt.md L21][^fixprompt-source]:

> PDITID add hookify from the claude-plugin-official marketplace
> - set it up so any edit to skills gets committed and pushed after
> - same for anything put in the journal folder
> - also prevent the main checkout in ~/src/nsheaps/\* from not being the main branch, journal entries, ticket tracking, and skill auto-committing etc to the default branch relies on there being a consistent checkout. If an agent tries to switch it, remind them to use worktrees

## Status

**state=done** — shipped 2026-05-26 in [commit `420317b`][^commit-420317b]. Three hookify behavior configs installed:

1. **auto-commit** — any edit to skills triggers an auto-commit+push
2. **journal** — anything written to the journal folder gets committed and pushed
3. **default-branch-guard** — prevents switching main checkouts in `~/src/nsheaps/*`, reminds agents to use worktrees instead

## Related

- [GSD-60](./GSD-60-hookify-double-posting.md) — hookify double-posting bug (related hookify infra work)
- [GSD-61](./GSD-61-hookify-notify-consolidation.md) — hookify notify consolidation
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-source]: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L21

[^commit-420317b]: https://github.com/nsheaps/.ai-agent-alex/commit/420317b

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
