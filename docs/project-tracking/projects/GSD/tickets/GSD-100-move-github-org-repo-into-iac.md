---
type: chore
id: GSD-100
state: triage
created: 2026-05-28T21:40:00Z
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: nate-discord-iac-move
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509672790171717743
events:
  - ts: 2026-05-28T21:40:00Z
    by: alex
    change: "created — captured from Nate Discord msg 1509672790171717743"
---

# GSD-100 — Move .github org repo into iac

## Original ask

From Nate (Discord [2026-05-28T21:40Z][^nate-discord]):

> move `.github` into (or alongside) an `iac` repo

## Goal

Migrate the `nsheaps/.github` org-level repository into or alongside an `iac` repository. Design specifics (merge vs. adjacent repo, directory layout) left open for planning.

## User story

As **Nate**, I want the `.github` org-level repo consolidated with `iac` so that org-wide GitHub configuration is managed alongside other infrastructure-as-code.

## Acceptance criteria

- [ ] `.github` org repo content is accessible from the `iac` repo (merged or sibling)
- [ ] Existing org-level `.github` functionality (issue templates, org workflows, etc.) continues to work
- [ ] Migration approach documented and agreed upon

[^nate-discord]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509672790171717743
