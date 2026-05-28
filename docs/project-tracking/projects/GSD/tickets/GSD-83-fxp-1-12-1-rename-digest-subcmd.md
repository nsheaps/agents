---
type: feature
id: GSD-83
aliases:
  - "FXP/1.12.1"
created: 2026-05-28T21:20:00Z
state: done
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
  - id: parent-ticket
    type: gsd-ticket
    url: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/projects/GSD/tickets/GSD-76-fxp-1-12-pr-status-cli.md
  - id: pr-183
    type: github-pr
    url: https://github.com/nsheaps/agents/pull/183
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "backfilled — work shipped as part of pr-status-cli work; ticket created retroactively per Nate 2026-05-28 21:17Z dashboard-reconcile directive",
    }
---

# FXP/1.12.1 — Rename digest subcmd + flip `--merged` default + build `pr-digest-cli`

## Original ask

Discord ask 2026-05-28 03:56Z: rename the digest subcommand, flip `--merged` default behavior, and build `pr-digest-cli` as a companion binary.

## Status

**state=done** — shipped as part of [PR #183](https://github.com/nsheaps/agents/pull/183) (Henry APPROVED, merged 2026-05-28T05:19:46Z).

## Completed via

- [PR #183](https://github.com/nsheaps/agents/pull/183) — `feat(apps): GSD-76 / FXP/1.12 — pr-status-cli (bun/ts)`

## Related

- [GSD-76](./GSD-76-fxp-1-12-pr-status-cli.md) — FXP/1.12 parent
- [GSD-84](./GSD-84-fxp-1-12-1a-fix-closed-semantics.md) — FXP/1.12.1a follow-on fix
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
