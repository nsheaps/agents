---
type: chore
id: GSD-27
state: in-progress
priority: 0
created: 2026-05-26T00:11:00Z
project: GSD
assignee: contacts://heaps-group/byGithubAppUrl/https%3A%2F%2Fgithub.com%2Fapps%2Falex-nsheaps
requester: contacts://heaps-group/byGithubUsername/nsheaps
milestone: "[../../../milestones/M2.md](file://../../../milestones/M2.md)"
references:
  - id: discord-tickets-subfolder
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508622920316878988
  - id: discord-priority-field
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508623334491820062
events:
  - {
      ts: 2026-05-26T00:11:00Z,
      by: alex,
      change: "created from Nate Discord asks[^discord-tickets-subfolder][^discord-priority-field]",
    }
---

# GSD-27 — Tickets/ subfolder migration + priority field

**Milestone:** [M2](../../../milestones/M2.md) | **Priority:** P0 | **PR:** _pending_ | **State:** in-progress

## Original asks

> "lets update skills and move ticket files appropriately so that tickets aren't in docs/project-tracking/projects/GSD but rather a tickets/ subfolder"
>
> — Nate, 2026-05-26 00:08Z[^discord-tickets-subfolder]

> "also lets make tickets have a priority field, 0 - 5. 0 is critical do now, 5 is maybe some time later. By default, lets start everything at a 4, but these bugs I'm telling you right now to prioritize are a p0. That priority should be called out in the triage doc too, and tickets should be triaged by priority (p0 first) if there are multiple in the queue."
>
> — Nate, 2026-05-26 00:10Z[^discord-priority-field]

## User story

As Alex (and any project agent), I want tickets to live under `projects/<P>/tickets/` and have an integer `priority` field 0-5 so that (a) the `projects/` folder structure has room for non-ticket project artifacts (`PROJECT.md`, milestone-summary docs, etc.) without mixing them with active tickets, and (b) the triage queue has a numeric sort key that scales beyond ad-hoc free-form priority strings.

## Stakeholders

- Nate — requested both changes
- Alex — primary implementor; will update own skill + agent definitions
- Peer agents — will inherit the new schema via skill and agent updates

## Requirements

- [ ] **Schema:** change `priority` from free-form string to integer 0-5, document default=4
- [ ] **Schema:** update path-pattern docs from `projects/<P>/*.md` to `projects/<P>/tickets/*.md` (lines 1, 5, 34 of `schema-ticket.yaml`)
- [ ] **File moves:** `git mv` all 13 existing `GSD-*.md` files from `projects/GSD/` to `projects/GSD/tickets/` (preserves history)
- [ ] **Frontmatter updates:** in each moved ticket, fix `milestone: ../../milestones/Mx.md` to `milestone: ../../../milestones/Mx.md` (one more level up)
- [ ] **Frontmatter additions:** add `priority: <N>` to every existing ticket — defaults:
  - GSD-22 (force-bg hook) = priority 0
  - GSD-23 (chain-mantra) = priority 0
  - GSD-24 (chain-count hook) = priority 0
  - GSD-1 (ticket-updater scaffold) = priority 4
  - GSD-8 through GSD-12, GSD-16 through GSD-19 (done bucket) = priority 4
- [ ] **PROJECT.md** at `projects/GSD/`: stays at `projects/GSD/PROJECT.md` (NOT moved into `tickets/`) — but if it references ticket paths, update them
- [ ] **CLAUDE.md** at `projects/GSD/`: update path references from `projects/GSD/$id-$slug.md` to `projects/GSD/tickets/$id-$slug.md`
- [ ] **CLAUDE.md** at `docs/project-tracking/`: update if it references ticket location
- [ ] **`intake/project-setup.md`**: update path references + add priority instructions (default 4, P0 first, triage doc must include priority)
- [ ] **`MASTER.md`**: rewrite all ticket links from `projects/GSD/GSD-X-...` to `projects/GSD/tickets/GSD-X-...`
- [ ] **`to-triage/` files** in `docs/project-tracking/to-triage/`: add `priority:` field to frontmatter where missing (default 4)
- [ ] **Alex repo `.claude/skills/project-tracking-workflow/SKILL.md`**: update path refs + add priority discipline
- [ ] **Alex repo `.claude/agents/ticket-updater.md`**: update path refs + add priority field handling
- [ ] **Triage workflow doc/skill**: process P0 tickets first when queue has multiple

## Acceptance criteria

- [ ] GSD-27 ticket file written at new path (this ticket)
- [ ] `schema-ticket.yaml` updated
- [ ] All 13 `GSD-*.md` files moved via `git mv` (history preserved per `git log --follow`)
- [ ] All moved files have updated milestone relative paths
- [ ] All moved files have `priority` field set
- [ ] `PROJECT.md` + `CLAUDE.md` path refs updated
- [ ] `intake/project-setup.md` updated with new path + priority instructions
- [ ] `MASTER.md` links updated
- [ ] `to-triage/` files priority-stamped
- [ ] Alex skill + agent definition updated
- [ ] github.com renders verified for one ticket (milestone link clicks through)
- [ ] Single PR in agents repo (title: `chore(tracking): migrate tickets/ subfolder + priority field (GSD-27)`)
- [ ] Single PR in alex repo (title: `chore(tracking): update project-tracking-workflow skill + ticket-updater for tickets/ subfolder (GSD-27)`)

## Implementation

PR URLs TBD — will be filled in once PRs land.

## Open questions

- Does `PROJECT.md` belong inside `tickets/` or stay at `projects/<P>/`?
- Should non-ticket artifacts (milestone-summary, validation-results) also have their own subfolders, or just `tickets/`?
- How is priority enforced on `to-triage/` files (which have no `id:` yet)?

## Follow-ups (out of scope)

- Programmatic schema validation via ticket-utils
- Auto-priority-bumping when handler tags as P0 via Discord

[^discord-tickets-subfolder]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508622920316878988

[^discord-priority-field]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508623334491820062
