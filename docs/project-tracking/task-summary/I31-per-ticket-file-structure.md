# I31 — per-ticket file structure + milestone drilldown rules

## Original message

From [MASTER.md `# alex goes brrrrrrr` bullet `I31`](https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md):

> 🆕 `I31`: update rules for handling tasks to have one file per task like you've been doing, how that ticket file should look, and how we'll drill down from a milestone list (in order of priority, if I suggest an update to ordering, ask if the stuff before it actually is a lower priority than what I suggested, how each milestone has a list to each ticket and some metadata (also constantly updated), and anything else you feel is needed
>
> - This is manual for now, but I9 will automate it

Architecture answers from Nate Discord [`1508286485273640980`](https://discord.com/channels/1490863845252665415/1497431286661517353/1508286485273640980) (2026-05-25 01:52Z):

> per ticket file location:
>
> - all tickets will go in nsheaps/agents/docs/tickets/ Design and define your own folder hierarchy but keep it organized
>
> milestone backend:
>
> - right now it's a section header in master.md, yes. Our milestones should more reflect linear-style but consider compatibilitiy with backends like storing in github issues or in the file system (as long as it works we can hack it)

## Scope

In:

- A documented convention for the per-ticket file: required sections, naming pattern, location.
- A documented convention for the milestone-level drilldown: how a milestone references its tickets, what metadata lives on the milestone, how status rolls up.
- A relocation plan: existing per-task docs live at `docs/project-tracking/task-summary/`. New canonical location is `docs/tickets/` (with a TBD folder hierarchy). Capture as a migration TODO — don't migrate as part of I31.
- Rule: when handler proposes a reordering of priority, ask whether items _before_ the proposed slot really are lower priority than the proposed item, or whether the proposal would skip work.
- Rule: handler additions to MASTER.md without a ticket-style ID get one assigned on next ticket-utils sweep (handler can mark `i?` / `c?` as placeholder per established pattern; ticket-utils resolves).

Out:

- The ACTUAL migration of existing task-summary/ → docs/tickets/ (separate ticket, post-I9 because ticket-utils should do it).
- ticket-utils SKILL implementation (that's I9).
- Linear-backend or github-issues-backend adapters (that's a v2 of ticket-utils per Nate's milestone-backend answer).
- The agent-roles plugin direction (separate area — captured in "## role definition improvement" MASTER.md section).

## Deliverables

1. Updated `project-tracking-workflow` skill (or successor) describing:
   - Per-ticket file structure (sections, naming, location).
   - Drilldown pattern: milestone (MASTER.md section header) → ticket bullet (MASTER.md) → per-ticket file (docs/tickets/).
   - Reorder-priority handshake rule.
   - Placeholder-ID convention (`i?`/`c?` etc.) for handler-added items.
2. A MIGRATION-TODO ticket placeholder (in MASTER.md, separate from I31) for moving task-summary/ → docs/tickets/ once ticket-utils lands. (I31 doesn't perform the migration; it just defines the destination.)
3. MASTER.md I31 line linked to this doc, status 🚧.

## Per-ticket file convention (proposed v1 — open for handler review)

**Location**: `nsheaps/agents/docs/tickets/<section-letter>/<ID>-<slug>.md`. Section letter = first letter of the ID prefix (e.g. `I` items → `docs/tickets/I/I31-per-ticket-file-structure.md`). Section folder gives a flat per-section directory rather than a deep date hierarchy.

Alternatives considered:

- `docs/tickets/<ID>-<slug>.md` (flat) — works for small N but cluttered at 100+ tickets.
- `docs/tickets/<status>/<ID>-<slug>.md` — status changes too often; would cause renames.
- `docs/tickets/YYYY/<ID>-<slug>.md` — date is in commit history, doesn't help retrieval.

Section-letter folder wins on stability + retrieval. Open for handler override.

**Required sections** (matches established `task-summary/` template):

```
# <ID> — <one-line title>

## Original message
(handler quote with link to source — Discord message, MASTER.md bullet, etc.)

## Scope
In: / Out:

## Scope review
(reflection on the cut — anything ambiguous, anything I'd ask back)

## Deliverables
(numbered list, each linkable to a deliverable artifact)

## Plan
(numbered steps, "save point" markers between commits)

## Scope guardrails
(do-nots, defense-in-depth notes)

## Open Questions
(capture as work proceeds — handler can answer in-doc)

## Log
(append-only dated event log, one line per state-change)
```

Files in `task-summary/` already conform to this template, so adoption is "rename the location, keep the structure."

## Milestone-drilldown convention (proposed v1)

**Milestone backend** = MASTER.md H2 section header (e.g. `## defining scope and cleaning git state`) for now. Per Nate: "right now it's a section header in master.md, yes. Our milestones should more reflect linear-style but consider compatibility with backends like storing in github issues or in the file system (as long as it works we can hack it)."

Mapping (Linear-style):

| Linear concept | MASTER.md realization |
| --- | --- |
| Project | `# alex goes brrrrrrr` (top-level title — this repo's master project) |
| Milestone | `## <header>` section in MASTER.md |
| Ticket | `- 🆕 \`Iddd\`: <title>` bullet within a milestone section |
| Sub-ticket | nested bullet under a parent ticket (indented `  - 🆕 \`Cddd\`: ...`) |
| Per-ticket detail | link to `docs/tickets/<section>/<ID>-<slug>.md` |

When ticket-utils (I9) lands, it can pivot to github-issues-as-milestones or fs-only without changing this conceptual model.

**Reorder handshake rule** (per I31 original message clause): when handler proposes moving a ticket up in priority, ask "are the items currently before this slot lower-priority than the proposed item?" before reordering. The handshake catches the case where handler just wants the new item visible, not actually reprioritized over existing work.

**Placeholder-ID convention** (per established pattern, see entry009 ticketing journal):

- Handler can mark a new bullet with `i?` / `c?` / `e?` etc. as placeholder.
- Next ticket-utils sweep (or alex's manual sweep) resolves placeholders → real next-id.
- After resolution, the ID is stable per Rule 4 (never reassigned).

## Scope guardrails

- Do NOT migrate any task-summary/ files in this ticket. The destination is `docs/tickets/`, but migration is a separate ticket post-I9.
- Do NOT codify the section-letter-folder choice into the project-tracking-workflow skill until handler approves the v1 proposal above.
- Do NOT design the github-issues backend or fs-backend adapter — those are I9 / ticket-utils v2 scope.

## Open Questions

- (Q1) Section-letter folder vs flat `docs/tickets/`? Proposing letter-folder. Handler decision needed before adoption.
- (Q2) Do C-tickets that live cross-section (e.g. `C1` shown in `## defining scope` even though "C" implies cleanup) get filed in `docs/tickets/C/` regardless of where their bullet sits in MASTER.md? Proposing yes — IDs are stable; section folder follows the ID prefix, not the bullet's current location.
- (Q3) When does the migration ticket get filed? Proposing: after ticket-utils I9 lands, since ticket-utils should perform the migration as a one-shot script.

## Log

- 2026-05-25 02:00Z: doc created. Pending: MASTER.md I31 line flip to 🚧 + this doc link.
