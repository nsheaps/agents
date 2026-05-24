# Stable letter+number IDs for MASTER.md items

**Track-doc item:** [`#intro#6`](../MASTER.md#intro) (becomes its own stable ID once this lands — likely `intro-F` or similar per the scheme below)
**Status:** 🚧 in_progress
**Owner:** alex

## Deliverable

- Every tracked item in MASTER.md carries a **stable, position-independent** ID as an HTML anchor (e.g. `<a id="intro-F"></a>`) immediately preceding the bullet.
- ID is bound to the item at creation time and NEVER changes when items are reordered, inserted, or removed.
- All cross-references in MASTER.md (Rules section) + per-task docs use the new stable IDs instead of the fragile `#intro#N` list-number form.
- The `project-tracking-workflow` skill is updated to reference the ID scheme so future agents apply it consistently.

## Source

- Nate Discord 2026-05-24 04:07Z (msg [`1507958814106849461`-adjacent]): "jack in the past you've given list item ids with a combo of letters and numbers. Can you please do that and make sure those are in the task summary files?"
- Nate Discord 2026-05-24 04:07:44Z: "you can't use the list numbering since thats going to change when things shift around."
- Nate Discord 2026-05-24 04:14Z: "Alex should be the one doing it. That scope change is still there. You must capture the scope change and do it since it improves our on-going process."

## ID scheme

**Format:** `<section-slug>-<letter><optional-number>` where:

- `<section-slug>` is the existing `<a id="...">` anchor of the section header (e.g. `intro`, `farish-skills`, `cleanup-prs`, `fix-reviews`, `dreaming`, `end-of-tonight`).
- `<letter>` is a SHORT alpha tag — for now, sequential A, B, C, …, AA, AB, … — assigned in CREATION order, not visual position. Letters are scarce enough that reorders/renames almost never collide.
- `<optional-number>` is appended ONLY when an item is broken down into atomic siblings — e.g. `intro-F1`, `intro-F2` are the breakdown of the original `intro-F`.

**Why letters in creation order, not positional:**

- Positional IDs (A=first, B=second) regress to the same problem as `#intro#N` — reorders break them.
- Letters assigned at creation are stable. The visible list order is whatever it is; the anchor stays put.
- We can track "next letter to assign per section" in a header comment in MASTER.md (`<!-- next-id: intro-G -->`).

**Examples (creation-order assignment as of this writing):**

| Item (intro section)                  | List # now | Stable ID |
| ------------------------------------- | ---------- | --------- |
| turn off agent teams and restart      | 1          | `intro-A` |
| fix numbering / MASTER.md migration   | 2          | `intro-B` |
| migrate alex memory to repo           | 3          | `intro-C` |
| PreToolUse hook block .md writes      | 4          | `intro-D` |
| project-tracking-workflow skill       | 5          | `intro-E` |
| stable letter+number IDs (this task)  | 6          | `intro-F` |
| spin down jack/henry                  | 7          | `intro-G` |
| tmux fork/compact                     | 8          | `intro-H` |
| extract project-tracking into scripts | 9          | `intro-I` |
| Take X passes                         | 10         | `intro-J` |
| INTAKE.md                             | 11         | `intro-K` |
| do-in-order / golden-child            | 12         | `intro-L` |
| task-utils maxInProgress config       | 13         | `intro-M` |

(Other sections — farish-skills, ball-rolling/cleanup-prs, fix-reviews, dreaming, end-of-tonight — get their own letter spaces. Pre-existing items in each section are assigned A, B, C, … in current list order, since we have no other creation-order signal for them. From now on, new items in any section get the next free letter for that section.)

## Implementation plan (atomic sub-steps)

1. **Add anchors to intro section** — insert `<a id="intro-A"></a>` … `<a id="intro-M"></a>` before each bullet's text. Letters per the table above.
2. **Add anchors to other sections** — farish-skills (A only, 1 item), cleanup-prs (A–G, 7 items), fix-reviews (A), dreaming (A–B), end-of-tonight (A–Z..AN, ~41 items). Use compact letter assignment; consider running a sub-agent if applying ~50 anchors gets tedious.
3. **Add per-section "next-id" hint** — small HTML comment after each section header noting the next free letter, so future inserts know what to assign without re-scanning.
4. **Update Rules section refs** — `#intro#12` → `#intro-L`; `#intro#4` → `#intro-D`; `#intro#2` → `#intro-B`; `#intro#3` → `#intro-C`. (Also drop the parenthetical "Number will become stable when …" note from Rule 3 — it'll be obsolete.)
5. **Update 5 per-task doc back-refs** — agent-teams-off, master-md-migration, memory-migration-to-repo, block-claude-projects-md-writes, project-tracking-workflow. Each currently has `#intro#N` refs in its header + body.
6. **Update SKILL.md "Worked example" section** — currently mentions `#intro#6`; swap to `#intro-F`.
7. **Validate** — `grep -rn '#intro#[0-9]' docs/project-tracking/` returns 0 hits; `grep -rn 'a id="intro-' docs/project-tracking/MASTER.md` returns 13; cross-link clicks work in GitHub render.
8. **Commit + push** — one commit covering MASTER.md anchors + Rule ref updates, one per per-task doc updated (since each is its own task summary), or one combined commit if all per-task doc updates are small.
9. **Flip MASTER.md item 6 to ✅ + Log line** — final commit.

## Scope guardrails

- Do NOT change the visible list ordering. This is a pure-anchor + ref-rename pass.
- Do NOT renumber the prettier-rendered list numbers — those are auto-managed.
- Do NOT add stable IDs to bullets inside sub-bullets (the nested `1. 2. 3.` under e.g. INTAKE.md). Only top-level items in each section get IDs; nested sub-bullets are addressable as `intro-K-1`, `intro-K-2`, … if needed later.
- Do NOT touch the spin-down item (`#intro#7` → `#intro-G`) work itself — only its anchor + refs.
- Do NOT mass-update unrelated docs (research notes, journal entries) even if they happen to mention `#intro#N`. Limit to MASTER.md + the 5 per-task docs + SKILL.md.

## Open questions

- Should the letter assignment for non-intro sections use creation order (which we don't know for old items) or current list position as a one-time bootstrap? **Decision (committing now):** one-time bootstrap from current list position for pre-existing items, then creation-order for new items going forward. Documented above.
- Should the SKILL.md's worked-example references go through the skill's "keep up to date" loop? **Decision:** yes — sub-step 6 captures this.

## Log

- 2026-05-24 04:21Z (Nate Discord 1507961632469549076 + earlier): handed me the 7-step workflow AND directed me to do the stable-IDs work myself.
- 2026-05-24 04:27Z (alex): #intro#5 (project-tracking-workflow skill) closed ✅ on commit 246474e; this task (#intro#6) is the next per Rule 2.
- 2026-05-24 04:28Z (alex): this per-task doc created with full plan + ID-scheme decision; about to link from MASTER.md + flip to 🚧.
