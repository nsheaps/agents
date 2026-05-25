# GSD project — CLAUDE.md

Bullets only — hierarchically included with the parent.

## Contents

- [`PROJECT.md`](PROJECT.md) — project metadata + in-scope repos.
- `$id-$slug.md` — tickets live flat here, one file per ticket (e.g. `GSD-1-build-ticket-updater-...md`).

## Ticket file convention

- Frontmatter schema: [`../../.metadata/schema-ticket.yaml`](../../.metadata/schema-ticket.yaml).
- File path: `projects/GSD/$id-$slug.md` (flat — no state-folders). State lives in `state:` frontmatter only.
- Filename: `<canonical-id>-<slug>.md` where `canonical-id` = `GSD-<seq>` and `slug` is searchable. Legacy IDs (epoch from inbox, I-IDs from MASTER.md) preserved in `legacy_ids:` frontmatter.
- State transition = edit `state:` field + append `events:` entry + commit. No file move.

## Triage scope

- Only **unassigned** or **assigned-to-you** tickets in `state=triage` are yours to action.
- Assigned-to-someone-else = that person's work, even if it's been sitting.
