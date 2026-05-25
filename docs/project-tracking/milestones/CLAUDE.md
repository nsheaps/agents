CLAUDE.md's exist in this and child directories and are recursively included. Keep CLAUDE.md files extremely short and bulleted to prevent too much context waste.

Milestones live here as siblings to `projects/` because they may span multiple projects (per `intake/initialize.md`).

## File-per-milestone (proposal — pending Nate ack)

- `milestones/$epoch-$slug.md` — canonical milestone doc with frontmatter + body
- `milestones/$epoch-$slug.test-plan.md` — acceptance test plan (created when milestone is fleshed out; absent during early states)
- `milestones/$epoch-$slug.results.$resultEpoch.md` — validation results, one per attempt

Sibling files (not subfolder) for greppability + parity with ticket files in `projects/<P>/<state>/`.

## Frontmatter fields

- `type: milestone`
- `name` — human-readable name
- `state` — `open` | `in-progress` | `complete`
- `created` — ISO timestamp
- `completed` — ISO timestamp, only when state=complete
- `source` — link back to MASTER.md anchor (`../MASTER.md#<id>`)
- `test_plan` — relative link to test-plan file (optional, may be absent)
- `results` — list of relative links to results files (optional)
- `tickets` — list of links to project tickets that contribute to this milestone (relative paths to `../projects/<P>/<state>/<ticket>.md`)
- `events` — chronological list of `{ ts, by, change }` entries

## Body

- Original MASTER.md content for the milestone header (verbatim)
- Per-bullet sub-items with their I-IDs (preserved from MASTER.md)
- Triage notes (added as milestone is fleshed out)

## State transitions

- `open` — extracted from MASTER.md, not yet fleshed out
- `in-progress` — some tickets contributing to this milestone are in_progress
- `complete` — all tickets contributing are done AND test plan results recorded

File moves are NOT used for milestone state — milestones stay in `milestones/` regardless of state. The `state:` frontmatter field is the source of truth. (This differs from projects/, where state-folder = state.)

When a milestone completes, MASTER.md gets a line under its header:

> completed YYYY-MM-DD HH:MMZ. Verified against [milestone test plan](./milestones/$epoch-$slug.test-plan.md), [results](./milestones/$epoch-$slug.results.$epoch.md)
