---
type: chore
id: GSD-49
legacy_ids:
  - I31
created: 2026-05-25T02:00:00Z
state: triage
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: master-md-bullet
    type: doc
    url: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md
  - id: discord-arch-answers
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508286485273640980
events:
  - {
      ts: 2026-05-25T02:00:00Z,
      by: alex,
      change: "created from MASTER.md I31 bullet + per-task doc I31-per-ticket-file-structure.md",
    }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-49 (state=triage) per triager-v2 workflow",
    }
---

# I31 — per-ticket file structure + milestone drilldown rules

## Original ask (MASTER.md I31)

> 🆕 `I31`: update rules for handling tasks to have one file per task like you've been doing, how that ticket file should look, and how we'll drill down from a milestone list (in order of priority, if I suggest an update to ordering, ask if the stuff before it actually is a lower priority than what I suggested, how each milestone has a list to each ticket and some metadata (also constantly updated), and anything else you feel is needed
>
> - This is manual for now, but I9 will automate it

## Architecture answers (Nate Discord 01:52Z)[^discord-arch-answers]

> per ticket file location: all tickets will go in nsheaps/agents/docs/tickets/ Design and define your own folder hierarchy but keep it organized
>
> milestone backend: right now it's a section header in master.md, yes. Our milestones should more reflect linear-style but consider compatibility with backends like storing in github issues or in the file system (as long as it works we can hack it)

## Scope

In:

- A documented convention for the per-ticket file: required sections, naming pattern, location.
- A documented convention for the milestone-level drilldown: how a milestone references its tickets, what metadata lives on the milestone, how status rolls up.
- A relocation plan: existing per-task docs live at `docs/project-tracking/task-summary/`. New canonical location is `docs/project-tracking/projects/<project>/tickets/` (per the schema already in use). Capture as a migration TODO.
- Rule: when handler proposes a reordering of priority, ask whether items _before_ the proposed slot really are lower priority than the proposed item.
- Rule: handler additions to MASTER.md without a ticket-style ID get one assigned on next ticket-utils sweep.

Out:

- The ACTUAL migration of existing task-summary/ → projects/ (separate ticket, post-I9).
- ticket-utils SKILL implementation (that's GSD-48/I9).
- Linear-backend or github-issues-backend adapters.

## Proposed per-ticket file convention (v1)

**Location**: `nsheaps/agents/docs/project-tracking/projects/<P>/tickets/<ID>-<slug>.md` (already in use per schema-ticket.yaml).

**Required frontmatter**: `type`, `id`, `state`, `created`, `project`, `priority`, `requester`, `references`, `events` (per schema-ticket.yaml).

**Required body sections**: goal/original-ask, acceptance criteria, notes.

**Milestone drilldown**: MASTER.md H2 section → ticket bullet → per-ticket file (current model, already working).

## Acceptance criteria

- `project-tracking-workflow` skill (or equivalent) documents the per-ticket file convention, milestone drilldown, and reorder-priority handshake.
- Reorder-priority handshake rule is captured in the skill.
- Migration-TODO ticket exists (referencing this ticket) for moving old task-summary/ docs to canonical location.
- Handler has reviewed + accepted the v1 per-ticket convention.

[^discord-arch-answers]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508286485273640980
