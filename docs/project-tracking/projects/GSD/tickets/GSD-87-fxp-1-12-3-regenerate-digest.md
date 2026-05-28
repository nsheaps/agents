---
type: chore
id: GSD-87
aliases:
  - "FXP/1.12.3"
created: 2026-05-28T21:20:00Z
state: done
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
  - id: parent-ticket
    type: gsd-ticket
    url: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/projects/GSD/tickets/GSD-76-fxp-1-12-pr-status-cli.md
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "backfilled — regeneration run completed; ticket created retroactively per Nate 2026-05-28 21:17Z dashboard-reconcile directive",
    }
---

# FXP/1.12.3 — Regenerate REPOS.md-scoped 48hr digest

## Original ask

Run the new `pr-status-digest` workflow to generate a REPOS.md-scoped 48-hour digest of open and merged PRs.

## Status

**state=done** — digest regenerated using `pr-status-digest.yaml` workflow against REPOS.md scope (open + merged, 48hr window).

## Related

- [GSD-85](./GSD-85-fxp-1-12-2-pr-status-digest-workflow.md) — FXP/1.12.2 workflow used
- [GSD-76](./GSD-76-fxp-1-12-pr-status-cli.md) — FXP/1.12 parent
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
