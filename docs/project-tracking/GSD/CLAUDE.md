# GSD project — CLAUDE.md

Bullets only — hierarchically included with the parent.

## Contents

- [`PROJECT.md`](PROJECT.md) — project metadata + in-scope repos.
- `triage-queue/` — incoming items waiting to become tickets.
- `triage/` — tickets in triage state (assignee TBD or grooming).
- `in-progress/` — actively being worked.
- `done/` — completed.

## Ticket file convention

- File path: `<state>/<ticket-slug>.md` (no epoch in filename for tickets — epoch from intake is preserved in `events:`).
- Required frontmatter: `assignee` (blank if unassigned), `created`, `state`, `events:` (chronological).
- Optional frontmatter: `references:` (URLs mentioned in the doc — paired with markdown footnote defs at the bottom of the body).
- State transition = move file + commit (the move + commit IS the event log until `ticket-utils` exists).

## Triage scope

- Only **unassigned** or **assigned-to-you** tickets in `triage/` are yours to action.
- Assigned-to-someone-else = that person's work, even if it's been sitting.
