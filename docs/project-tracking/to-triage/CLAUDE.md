Incoming items awaiting triage into a project + canonical id. CLAUDE.md is included recursively — keep it short.

## Naming

- `$epoch-$slug.md` where `$epoch` = unix seconds at file creation (`date +%s`).
- Slug = short kebab-case description (e.g. `1779766960-task-hierarchy-blocking-relaxation.md`).
- Existing files starting with an `I<N>` legacy MASTER.md ID are grandfathered.

## Body

- Free-form handler brain-dump or refined ask. No required frontmatter at this stage (schema lives in `.metadata/schema-ticket.yaml` and applies after promotion).
- Refinements appended to the same file (don't open new ones) until the item is triaged.

## Triage lifecycle

- File enters here when a new ask is captured.
- Triage promotes it to `projects/<P>/tickets/GSD-<N>-$slug.md` (or merges into an existing ticket), and the source file is removed in the SAME commit as the promotion (`git mv` preferred so history follows).
- Each promotion = its own commit (one ticket event = one commit; see [`feedback_one_commit_per_ticket_event.md`](https://github.com/nsheaps/.ai-agent-alex/blob/main/memory/feedback_one_commit_per_ticket_event.md)).

## Do not

- Don't delete this CLAUDE.md or the folder itself. If the folder is empty, leave the `.gitkeep` so it's tracked.
