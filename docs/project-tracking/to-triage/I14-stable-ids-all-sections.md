> The following is the contents of the file as previously lived in docs/project-tracking/task-summary/xxxx.md. To triage this ticket, we'll need to appropriately file this as an actual ticket within the appropriate project.
> Review the summary, and MASTER.md, and build out the ticket to triage.
> Then, get the triage request to the actual ticket(s) in triage state and in the correct project(s). This will likely be one ticket per file for now, but you may choose to make more than one if you deem appropriate.
> The ticket should capture this original summary, and the original messaging as it appears in MASTER.md. It MUST also be linked to the appropriate milestone.
> When the ticket is ready, in the triage state, and is confirmed to have the needed information, update master.md appropriately to link to the ticket instead of keeping info in master.md. The link should be: `[$emojiState | $ticketShortDescription](relative/link/to/file/that/works/on/github/and/local/instead/of/link/to/github/directly.md)` the ticket short description.


---

# Stable ticket-style IDs — all MASTER.md sections

**Track-doc item:** `I14` — [`#intro` / I14](../MASTER.md#intro)
**Status:** ✅ done
**Owner:** alex

## Original message

> Give all the bullets stable IDs not just the ones we're working on

— Nate, Discord 2026-05-24 ([msg `1507976714448535682`](https://discord.com/channels/1490863845252665415/1497431286661517353/1507976714448535682)). I14 is a meta-task created by alex after I6 scope-deviation: no pre-N2 MASTER.md bullet exists for I14 because it was created as a follow-up to I6's narrowed scope. The open question in the doc ("I14..I25 vs I14..I26") is resolved: `next-id: I27` in MASTER.md confirms I14..I26 / next-id I27 was correct.

## Deliverable

- Every top-level numbered bullet in EVERY section of MASTER.md carries a stable ticket-style ID as a short prefix (e.g. `F1`, `C1`, `R1`, `D1`, `E1`).
- Intro section bullets that were added after the I6 bundle landed get IDs `I15`..`I26` in visual top-to-bottom order.
- A `<!-- next-id: ... -->` HTML comment is present under each section header tracking the next free counter.
- The `I14` meta-task bullet itself is added to the intro section linking to this doc.
- A report is written to `.claude/tmp/id-sweep-report.md` in the alex repo.

## Source

- Nate expanded the scope of I6 to cover ALL sections, not just intro.
- Original I6 scope guardrail explicitly deferred other sections: "Do NOT apply IDs to other sections (F, C, R, D, E) in this commit."
- Nate's expanded ask: "Give all the bullets stable IDs not just the ones we're working on" (context: 2026-05-24 session).

## ID scheme

Per I6 — see `I6-stable-ids.md` for the full spec. Summary:

- Format: `<section-code><number>` — single uppercase letter + monotonic counter, no hyphen, backticked when used in bullets.
- Section codes: `I` intro, `F` farish-skills, `C` cleanup-prs, `R` fix-reviews, `D` dreaming, `E` end-of-tonight.
- Counter rules: creation order; never reused; bootstrap pre-existing items in current visual top-to-bottom order.
- Bullet format (with emoji): `N. STATUS \`ID\`: rest-of-bullet-text`
- Bullet format (without emoji): `N. \`ID\`: rest-of-bullet-text`
- Sub-bullets do NOT get IDs.

## Section ID assignments

| Section             | Items                             | IDs      | next-id |
| ------------------- | --------------------------------- | -------- | ------- |
| Intro (new bullets) | 12 existing unlabeled + 1 new I14 | I14..I26 | I27     |
| farish-skills       | 1                                 | F1       | F2      |
| cleanup-prs         | 8                                 | C1..C8   | C9      |
| fix-reviews         | 1                                 | R1       | R2      |
| dreaming            | 2                                 | D1..D2   | D3      |
| end-of-tonight      | 41                                | E1..E41  | E42     |

**Note on intro count:** The task spec referenced I14..I25 (12 IDs) for 12 existing unlabeled bullets + 1 new I14 bullet. The actual file has 12 unlabeled bullets + 1 new meta-task bullet = 13 items total, so the range is I14..I26 with next-id I27. This discrepancy is documented in the sweep report for alex to confirm before committing.

## Validation

- `grep -cE '\`[IFCRDE][0-9]+\`' /home/nsheaps/src/nsheaps/agents/docs/project-tracking/MASTER.md` returns total count of all IDs.
- Per-section: `grep -cE '\`I[0-9]' MASTER.md` etc.
- Each section has a `<!-- next-id: ... -->` comment.
- No top-level numbered bullets in any section are missing an ID after this sweep.

## Implementation plan

1. Create this task-summary doc. ✓
2. Add I14 bullet to intro section of MASTER.md (🚧 status, link to this doc).
3. Add IDs I15..I26 to the 12 existing unlabeled intro bullets in visual order.
4. Update intro `<!-- next-id: I14 -->` to `<!-- next-id: I27 -->`.
5. For each non-intro section (F, C, R, D, E):
   a. Add `<!-- next-id: ... -->` comment after section heading.
   b. Add IDs to all top-level numbered bullets in visual order.
6. Run validation greps.
7. Write sweep report to `.claude/tmp/id-sweep-report.md`.
8. Alex commits and pushes (out of scope for this sub-agent).

## Scope guardrails

- Do NOT touch sub-bullets (nested lists under top-levels).
- Do NOT modify per-task docs in task-summary/ (other than creating this one).
- Do NOT add HTML anchors — bullet-prefix form is sufficient.
- Do NOT add status emojis to items that don't already have them.
- Do NOT commit or push (alex/dispatcher handles that).
- Do NOT renumber visible list numbers.

## Open questions

- The task spec says "I14..I25 / next-id I26" but the file has 12 existing unlabeled bullets + 1 new I14 = 13 items. Used I14..I26 / next-id I27 instead. Needs alex confirmation before committing.

## Log

- 2026-05-24 (sub-agent sonnet dispatch): Created this task-summary doc as part of the ID sweep. Began MASTER.md edits.
