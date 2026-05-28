---
type: feature
id: GSD-85
aliases:
  - "FXP/1.12.2"
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
  - id: workflow-file
    type: doc
    url: https://github.com/nsheaps/agents/blob/main/.github/workflows/pr-status-digest.yaml
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "backfilled — workflow shipped in agents repo; ticket created retroactively per Nate 2026-05-28 21:17Z dashboard-reconcile directive",
    }
---

# FXP/1.12.2 — `pr-status-digest` GH workflow

## Original ask

Discord ask 2026-05-28 05:40Z: Build a GitHub Actions workflow with 4 triggers — cron (12h), `workflow_dispatch`, `repository_dispatch:pr-status-refresh`, and PR state-changes (excluding `synchronize`).

## Status

**state=done** — [`.github/workflows/pr-status-digest.yaml`](https://github.com/nsheaps/agents/blob/main/.github/workflows/pr-status-digest.yaml) shipped in `nsheaps/agents`.

## Completed via

- Workflow file: [`.github/workflows/pr-status-digest.yaml`](https://github.com/nsheaps/agents/blob/main/.github/workflows/pr-status-digest.yaml)

## Related

- [GSD-76](./GSD-76-fxp-1-12-pr-status-cli.md) — FXP/1.12 parent CLI
- [GSD-86](./GSD-86-fxp-1-12-2a-parse-repos-md.md) — FXP/1.12.2a companion script
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
