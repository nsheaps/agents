CLAUDE.md's exist in this and child directories and are recursively included. Keep CLAUDE.md files extremely short and bulleted to prevent too much context waste.

Milestones live here as siblings to `projects/` because they may span multiple projects (per `intake/initialize.md`).

## Schema

- Frontmatter schema: [`../.metadata/schema-milestone.yaml`](../.metadata/schema-milestone.yaml) (JSON Schema, eventually programmatically validated).
- File naming: `$id.md` (e.g. `GSD-26.md`), with sibling `$id.test-plan.md` and `$id.results.$epoch.md` files when applicable.
- IDs use the canonical `<PROJECT_ID>-<sequence>` format (e.g. `GSD-26`); legacy MASTER.md I-IDs preserved in `legacy_ids` frontmatter + body.

## State

- `state:` frontmatter is the source of truth — milestones do NOT move folders by state. Differs from project tickets where `state:` and folder must agree.
- Lifecycle: `open` → `in-progress` → `complete`.
- On completion, MASTER.md gets a line under the milestone header:
  > completed YYYY-MM-DD HH:MMZ. Verified against [test plan](./milestones/$id.test-plan.md), [results](./milestones/$id.results.$epoch.md)

## Body

- Original MASTER.md content for the milestone header (verbatim).
- Per-bullet sub-items preserved with their I-IDs (so existing references still resolve via search).
- Triage notes added as the milestone is fleshed out.
