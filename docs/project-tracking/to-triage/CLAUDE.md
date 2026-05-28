**DEPRECATED for new items.** This folder is no longer the intake path for new asks. New asks are filed DIRECTLY into `projects/<P>/tickets/<id>-<slug>.md` with `state: triage` — no staging step. Files already present here are backlog; process them by promoting to tickets/ in a separate sweep. CLAUDE.md is included recursively — keep it short.

## Legacy naming (for existing files only)

- `$epoch-$slug.md` where `$epoch` = unix seconds at file creation (`date +%s`).
- Slug = short kebab-case description (e.g. `1779766960-task-hierarchy-blocking-relaxation.md`).
- Existing files starting with an `I<N>` legacy MASTER.md ID are grandfathered.

## New intake flow (use this going forward)

0. **Determine the correct project.** Default: `GSD` (general sprint-driven work). Use a different project only when the ask clearly belongs to one (e.g. a dedicated product project already exists). When in doubt, use `GSD`.
1. Determine the next-free ticket ID: scan `projects/<P>/tickets/` for the highest `<P>-N`, increment by 1.
2. Create `projects/<P>/tickets/<P>-<N>-<slug>.md` directly, with frontmatter `state: triage`.
3. Commit immediately — one ticket = one commit.

## Legacy triage lifecycle (for existing files in this folder)

- Triage promotes to `projects/<P>/tickets/GSD-<N>-$slug.md` (or merges into an existing ticket), source file removed in the SAME commit (`git mv` preferred so history follows).
- Each promotion = its own commit (one ticket event = one commit; see [`feedback_one_commit_per_ticket_event.md`](https://github.com/nsheaps/.ai-agent-alex/blob/main/memory/feedback_one_commit_per_ticket_event.md)).

## Do not

- Don't delete this CLAUDE.md or the folder itself. If the folder is empty, leave the `.gitkeep` so it's tracked.
