---
type: feature
id: GSD-89
aliases:
  - "FXP/1.12-publish"
created: 2026-05-28T21:20:00Z
state: triage
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
  - id: discord-homebrew-question
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509436277441822740
events:
  - {
      ts: 2026-05-28T21:20:00Z,
      by: alex,
      change: "filed per Nate 2026-05-28 21:17Z dashboard-reconcile directive — publishing PR had no ticket",
    }
---

# FXP/1.12-publish — bun-compiled binary + GH releases + homebrew tap + mise/nx entrypoint

## Original ask

Discord ask 2026-05-28 ~06:00Z: Publish pr-status-cli as a bun-compiled binary via GH releases, add to a homebrew tap, and wire as a mise/nx entrypoint.

## Status

**state=triage** — blocked on homebrew tap A/B decision (unanswered as of 2026-05-28 06:00Z, msg [1509436277441822740](https://discord.com/channels/1490863845252665415/1497431286661517353/1509436277441822740)):

- **A** = existing `homebrew-devsetup` (default)
- **B** = new `homebrew-tap`

Research done, scaffold deferred pending Nate's answer.

## Blockers

- Nate's homebrew tap A/B decision ([Discord msg 1509436277441822740](https://discord.com/channels/1490863845252665415/1497431286661517353/1509436277441822740))

## Related

- [GSD-76](./GSD-76-fxp-1-12-pr-status-cli.md) — FXP/1.12 parent
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
