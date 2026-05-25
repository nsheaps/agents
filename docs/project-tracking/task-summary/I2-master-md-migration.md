# MASTER.md migration + numbering + key + rules sections

**Track-doc item:** `I2` — [`#intro` / I2](../MASTER.md#intro) (was list-position #4 before completed items were hoisted on 2026-05-24 04:05Z per `#rules` Rule 2; assigned stable ID `I2` per `I6` on 2026-05-24)
**Status:** ✅ done
**Owner:** alex

## Original message

> fix the numbering in here before I go crazy. numbers don't matter, make them all have emoji for status. Define a key at the top level. Don't work on more than one. Move this entire thing to `nsheaps/agents/docs/project-tracking/MASTER.md`. You must start a doc for each one and link it from this list before doing anything, including work. Each of these gets a doc at `nsheaps/agents/docs/project-tracking/task-summary/TASK.md` TO BE CREATED ONLY WHEN YOU LINK IT.

— Nate, MASTER.md `#intro` (item 2 in the original track-doc). Original verbatim bullet text recovered from agents commit [`5f69967`](https://github.com/nsheaps/agents/commit/5f69967) before the N2 ticket-style title rewrite.

## Deliverable

- Track doc lives at `docs/project-tracking/MASTER.md` (was `docs/journal/2026/05/23/entry008-getting-back-on-track.md`).
- All headers have `<a id="..."></a>` anchor IDs (`key`, `rules`, `intro`, `farish-skills`, `ball-rolling`, `cleanup-prs`, `fix-reviews`, `dreaming`, `end-of-tonight`).
- Status emoji key defined at top of doc as its own H1 section (`#key`).
- Cross-cutting Rules section defined as its own H1 (`#rules`), above the intro.
- Each tracked item has a status emoji prefix.
- Numbering normalized via prettier; nested lists use `1.` repeated (prettier auto-numbers in render).
- Old journal path preserved as a redirect stub pointing at MASTER.md.

## Validation

- `docs/project-tracking/MASTER.md` exists at HEAD of `main`.
- `docs/journal/2026/05/23/entry008-getting-back-on-track.md` exists as a one-paragraph redirect.
- Every header in MASTER.md has a unique `<a id="...">` anchor.
- Every item from `#intro` through `#end-of-tonight` has a status emoji.
- Per-task docs referenced from MASTER.md exist at `docs/project-tracking/task-summary/`.

## Implementation

1. Format-pass (commit `c6be06a`): prettier, anchor IDs, status emojis, renumbering.
2. Rules + per-task-doc-first protocol (commit `ac1cffd`): cross-cutting `#rules` section added; first per-task doc (agent-teams-off.md) created.
3. Lift Key to its own H1 (commit `c7486a8`): emoji key promoted out of intro bullet; "one in-flight" rule (alex extrapolated, not Nate-written) removed; `#intro#1` marked ✅.
4. Link path fix (commit `93f2ce1`): `../../project-tracking/...` → `../../../../project-tracking/...` (4 levels up from journal location).
5. Rename to MASTER.md (this commit): `git mv` to new path; redirect stub at old path; agent-teams-off.md back-link updated.

## Scope guardrails

- Do NOT change Nate's wording in tracked items unless explicitly asked.
- Do NOT renumber items in a way that breaks anchor references — emoji status is the canonical state, not numbers.
- Did NOT renumber nested lists by hand — prettier handles that.

## Open questions

- The `#intro#5` item ("Take another X number of passes") is still 🆕. Will need its own per-task doc when started.

## Log

- 2026-05-24 03:30Z (alex): commit c6be06a — first format pass with anchor IDs, status emojis, prettier.
- 2026-05-24 03:38Z (Nate correction): work was done without per-task doc, violated own rule. Doc-first rule added retroactively.
- 2026-05-24 03:45Z (alex): commit c7486a8 — Key lifted, "one in-flight" rule dropped, agent-teams marked ✅.
- 2026-05-24 03:53Z (alex): commit 93f2ce1 — fixed broken relative link path.
- 2026-05-24 04:00Z (alex): this commit — `git mv` to MASTER.md, redirect stub, retroactive item entries for in-flight session work (#intro#9, #intro#10).
