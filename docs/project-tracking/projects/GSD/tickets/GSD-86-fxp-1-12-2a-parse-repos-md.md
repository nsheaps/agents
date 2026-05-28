---
type: feature
id: GSD-86
aliases:
  - "FXP/1.12.2a"
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
  - id: script-file
    type: doc
    url: https://github.com/nsheaps/agents/blob/main/scripts/parse-repos-md.sh
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "backfilled — script shipped in agents repo; ticket created retroactively per Nate 2026-05-28 21:17Z dashboard-reconcile directive",
    }
---

# FXP/1.12.2a — `scripts/parse-repos-md.sh`

## Original ask

Companion script to FXP/1.12.2 workflow: emit `owner/repo` slugs from REPOS.md so the digest workflow can iterate over all tracked repos.

## Status

**state=done** — [`scripts/parse-repos-md.sh`](https://github.com/nsheaps/agents/blob/main/scripts/parse-repos-md.sh) shipped in `nsheaps/agents`.

## Completed via

- Script: [`scripts/parse-repos-md.sh`](https://github.com/nsheaps/agents/blob/main/scripts/parse-repos-md.sh)

## Related

- [GSD-76](./GSD-76-fxp-1-12-pr-status-cli.md) — FXP/1.12 parent
- [GSD-85](./GSD-85-fxp-1-12-2-pr-status-digest-workflow.md) — FXP/1.12.2 workflow
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
