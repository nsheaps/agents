# GSD project — CLAUDE.md

Bullets only — hierarchically included with the parent.

## Contents

- [`PROJECT.md`](PROJECT.md) — project metadata + in-scope repos.
- [`tickets/`](tickets/) — one file per ticket (e.g. `tickets/GSD-1-build-ticket-updater-...md`). Non-ticket project artifacts (PROJECT.md, milestone summaries, validation results) live at the project root, NOT inside `tickets/`.

## Ticket file convention

- Frontmatter schema: [`../../.metadata/schema-ticket.yaml`](../../.metadata/schema-ticket.yaml).
- File path: `projects/GSD/tickets/$id-$slug.md` (flat under `tickets/` — no state-folders). State lives in `state:` frontmatter only.
- Filename: `<canonical-id>-<slug>.md` where `canonical-id` = `GSD-<seq>` and `slug` is searchable. Legacy IDs (epoch from inbox, I-IDs from MASTER.md) preserved in `legacy_ids:` frontmatter.
- State transition = edit `state:` field + append `events:` entry + commit. No file move.
- **Priority field** (`priority:` in frontmatter): integer 0-5, default 4. 0 = critical / do now, 5 = maybe later. P0 tickets are triaged first when the queue has multiple candidates.

## Triage scope

- Only **unassigned** or **assigned-to-you** tickets in `state=triage` are yours to action.
- Assigned-to-someone-else = that person's work, even if it's been sitting.
- When multiple tickets are actionable, sort by `priority:` ascending (lowest number first — P0 before P1 before P4).

## Required fields on every ticket (ENFORCE)

- `references:` MUST include an entry of `type: alex-task` (or `jack-task`/`henry-task`) with the originating task ID + URL. No originating task = bad job; file the missing task retroactively first, then reference it.
- `aliases:` SHOULD list previous human-readable names (FXP/1.2, I27, C1, etc.) for discoverability. Order: most-recent first, oldest last.

See `../../.metadata/schema-ticket.yaml` for field shapes and the allowed `type` enum values (now includes `alex-task`, `jack-task`, `henry-task`).
