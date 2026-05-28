CLAUDE.md's exist in this and child directories and are recursively included. Keep CLAUDE.md files extremely short and bulleted to prevent too much context waste.

We're currently setting up project management. Relevant resources:

- [`MASTER.md`](MASTER.md) — running activity log + current work index.
- [`SETUP.md`](SETUP.md) — one-time bootstrap instructions Alex is executing (2026-05-25).
- [`intake/`](intake/) — handler brain-dumps awaiting triage. See [`intake/CLAUDE.md`](intake/CLAUDE.md).
- `task-summary/` — legacy summaries to triage into tickets (project-setup step 5).
- `projects/<project>/` — per-project artifacts. Tickets live in `projects/<P>/tickets/$id-$slug.md` (flat under the `tickets/` subfolder). State in frontmatter, not in folders. Non-ticket artifacts (PROJECT.md, milestone summaries) sit at the project root.
  - **Step 0 (before creating any ticket): determine the correct project.** Default is `GSD` (general sprint-driven work). Only use a different project when the ask clearly belongs to one that already exists. When in doubt, use `GSD`.
- `milestones/` — milestone objects (state in frontmatter; siblings to `projects/` since milestones may span projects).
- `to-triage/` — **legacy staging folder; do not use for new items.** New asks go directly to `projects/<P>/tickets/<id>-<slug>.md` with `state: triage`. Existing files remain for backlog sweep.
- `.metadata/` — JSON Schema files for the doc types defined here (`schema-ticket.yaml`, `schema-milestone.yaml`).

Use ticket and project management plugins (`ticket-utils`, `project-utils`) when they exist — until then, the file flow + git history is the system of record. Each state transition = a commit (so `git log` reconstructs the events log).
