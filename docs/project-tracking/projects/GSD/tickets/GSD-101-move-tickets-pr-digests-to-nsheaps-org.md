---
type: chore
id: GSD-101
state: triage
created: 2026-05-28T21:40:00Z
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: nate-discord-org-move
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509672790171717743
events:
  - ts: 2026-05-28T21:40:00Z
    by: alex
    change: "created — captured from Nate Discord msg 1509672790171717743"
---

# GSD-101 — Move tickets and PR digests from nsheaps/agents → nsheaps/.org

## Original ask

From Nate (Discord [2026-05-28T21:40Z][^nate-discord]):

> relocate `docs/project-tracking/` (tickets + MASTER.md + milestones + intake) and `docs/pr-status/` from `nsheaps/agents` to a new `nsheaps/.org` repo

## Goal

Move project-tracking and PR digest artifacts out of `nsheaps/agents` into a dedicated `nsheaps/.org` repo. Migration approach (git history preservation, redirects, tooling updates) left open for planning.

## Scope

- `docs/project-tracking/` — GSD tickets, MASTER.md, milestones, intake
- `docs/pr-status/` — PR digest files

## Acceptance criteria

- [ ] `nsheaps/.org` repo exists and contains the migrated artifacts
- [ ] Tooling (sdq, ticket utils, pr-status commands) updated to point at new location
- [ ] `nsheaps/agents` no longer contains project-tracking or pr-status dirs

[^nate-discord]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509672790171717743
