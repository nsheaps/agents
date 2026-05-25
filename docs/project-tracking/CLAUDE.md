# Project Tracking — CLAUDE.md

Bullets only — this file is hierarchically included. Details live in the linked files.

## Layout

- [`MASTER.md`](MASTER.md) — running activity log + current work index.
- [`SETUP.md`](SETUP.md) — one-time bootstrap instructions Alex is executing (2026-05-25).
- [`intake/`](intake/) — handler brain-dumps awaiting triage. See [`intake/CLAUDE.md`](intake/CLAUDE.md).
- `task-summary/` — legacy summaries to triage into tickets (project-setup step 5).
- `<project>/` — per-project ticket queues (first one: `ai-agents/`).

## Ticket lifecycle

- **Now (3 states):** `triage → in-progress → done`. Path: `<project>/{triage,in-progress,done}/<slug>.md`. Frontmatter: `assignee`, `created`, `state`, `events:`.
- **Design target (10 states):** `drafts → to-triage → org-triage-queue → project-triage-queue → tickets/triage → backlog → todo → in-progress → review → done → archive`. Full spec in [`intake/initialize.md`](intake/initialize.md). Grow into it as `ticket-utils` automates transitions — do NOT hand-manage all 10 states yet.

## Triage rules

- Only **unassigned or assigned-to-you** triage tickets are yours to action. Assigned-to-someone-else = that person's work.
- Behavior-change requests → ticket. The SYSTEM does not silently change plugins/skills/repos.
- Each state transition = a commit (git history is the event log until `ticket-utils` ships).

## Future

- `ticket-utils` plugin (not yet built) will provide skills for ticket create/transition/query. When it lands, link its skills here.
