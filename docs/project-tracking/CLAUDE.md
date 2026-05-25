CLAUDE.md's exist in this and child directories and are recursively included. Keep CLAUDE.md files extremely short and bulleted to prevent too much context waste.

We're currently setting up project management. Relevant resources:

- [`MASTER.md`](MASTER.md) — running activity log + current work index.
- [`SETUP.md`](SETUP.md) — one-time bootstrap instructions Alex is executing (2026-05-25).
- [`intake/`](intake/) — handler brain-dumps awaiting triage. See [`intake/CLAUDE.md`](intake/CLAUDE.md).
- `task-summary/` — legacy summaries to triage into tickets (project-setup step 5).
- `projects/<project>/` — per-project ticket queues (first one: `projects/GSD/`).
- `milestones/` — sibling folder for milestone objects (project-setup step 5 will populate).
- `to-triage/` — items waiting to be mapped to a project + filed into a project queue.

Use ticket and project management plugins (`ticket-utils`, `project-utils`) when they exist — until then, the file flow + git history is the system of record. Each state transition = a commit (so `git log` reconstructs the events log).
