> The following is the contents of the file as previously lived in docs/project-tracking/task-summary/xxxx.md. To triage this ticket, we 'll need to appropriately file this as an actual ticket within the appropriate project.
> Review the summary, and MASTER.md, and build out the ticket to triage.
> Then, get the triage request to the actual ticket(s) in triage state and in the correct project(s). This will likely be one ticket per file for now, but you may choose to make more than one if you deem appropriate.
> The ticket should capture this original summary, and the original messaging as it appears in MASTER.md. It MUST also be linked to the appropriate milestone.
> When the ticket is ready, in the triage state, and is confirmed to have the needed information, update master.md appropriately to link to the ticket instead of keeping info in master.md. The link should be: `[$emojiState | $ticketShortDescription](relative/link/to/file/that/works/on/github/and/local/instead/of/link/to/github/directly.md)` the ticket short description.


---

# I27: Audit I2–I14 per-task docs and backfill Original message sections

## Original message

> create a task for auditing I2-I14 per-task docs and backfilling Original message sections

— Nate, 2026-05-24, via manage-tasks skill args

## Scope

**In:**

- Audit every existing per-task doc for I2 through I14 (I1 is excluded — it already has the section).
- Backfill an `## Original message` section containing the verbatim handler message + timestamp/source link in any doc that is missing it.

**Out:**

- Items I7–I13, I15–I26: no per-task docs exist yet; not in scope.
- Rewrites or changes to any other sections of existing docs.
- Creating missing per-task docs for items that don't have one (separate task if needed).

## Scope review

Original message is clear and bounded. Files in scope:

- I2 (`I2-master-md-migration.md`) — has `## Original message` ✅ skip
- I3 (`I3-memory-migration-to-repo.md`) — missing ❌
- I4 (`I4-block-claude-projects-md-writes.md`) — missing ❌
- I5 (`I5-project-tracking-workflow.md`) — missing ❌
- I6 (`I6-stable-ids.md`) — missing ❌
- I14 (`I14-stable-ids-all-sections.md`) — missing ❌

No ambiguity. Proceed.

## Deliverables

- Each of I3, I4, I5, I6, I14 per-task docs has an `## Original message` section with verbatim handler text + timestamp/source.
- Validation: `grep -rL "## Original message" docs/project-tracking/task-summary/I[0-9]*.md` returns empty (or only files outside scope).

## Plan

1. Read each missing doc to find the best available source of the original message (MASTER.md bullet, task description, git log, transcript).
2. Add `## Original message` section at the top of each doc (after the title, before other sections).
3. Commit + push after all 5 are done (single commit is fine — they're all the same type of change).

## Scope guardrails

- Do not rewrite other sections while backfilling.
- If the original message is genuinely unrecoverable, note that in the section rather than inventing text.

## Open questions

- None at creation time.

## Log

- 2026-05-24 — task created (I27), per-task doc committed as save point before work begins.
