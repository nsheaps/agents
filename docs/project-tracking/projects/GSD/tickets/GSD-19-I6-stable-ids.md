---
type: feature
id: GSD-19
priority: 4
state: done
created: 2026-05-24T04:00:00Z
completed: 2026-05-24T05:00:00Z
project: GSD
assignee: contacts://heaps-group/byGithubUsername/nsheaps
requester: contacts://heaps-group/byGithubUsername/nsheaps
milestone: ../../../milestones/M1.md
legacy_ids:
  - I6
aliases:
  - "I6"
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-571"
    note: "#571: Round 1 — promote 10 done-bucket to-triage → GSD-N tickets"
  - id: discord-1507968405213286580
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1507968405213286580
  - id: discord-1507968726396440678
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1507968726396440678
  - id: commit-04246cd
    type: github-commit
    url: https://github.com/nsheaps/agents/commit/04246cd
  - id: commit-a71de32
    type: github-commit
    url: https://github.com/nsheaps/.ai-agent-alex/commit/a71de32
  - id: commit-159058d
    type: github-commit
    url: https://github.com/nsheaps/.ai-agent-alex/commit/159058d
  - id: discord-1508130974091841647
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508130974091841647
events:
  - {
      ts: 2026-05-25T23:48:00Z,
      by: alex,
      change: "promoted from to-triage/I6-stable-ids to GSD-19 (state=done)",
    }
---

# [old I6] Stable ticket-style IDs for MASTER.md items

**Track-doc item:** `I6` — [`#intro` / I6](../MASTER.md#intro)
**Status:** ✅ done
**Owner:** alex

## Original message

> that's not what I meant for stable ids. I mean like ticket ids. … Like A-234, LAUNCHER-1, T45.

— Nate, Discord 2026-05-24 04:48Z ([msg `1507968405213286580`][^discord-1507968405213286580]). Follow-up at 04:49Z: "i'd prefer keeping bullets over making a table, I just want the ID prefixed and in the file name." I6 was originally alex-created from an earlier intent to add stable IDs; the 04:48Z message is the definitive statement of what ticket-style IDs should look like. Full source context in the `## Source` section below.

## Deliverable

- Every tracked item in MASTER.md carries a **stable, ticket-style ID** as a SHORT prefix in the bullet text (`I1`, `F1`, `C1`, … — jack-style: single-letter section code + monotonic number).
- ID is bound to the item at creation time. NEVER reassigned, NEVER reused.
- Per-task doc filenames are renamed to include the ID prefix: `I1-agent-teams-off.md`, `I2-master-md-migration.md`, etc.
- All cross-references (Rules section, per-task doc headers, SKILL.md "Worked example") use the ticket IDs instead of fragile `#intro#N` list-number form.
- The `project-tracking-workflow` skill is updated to reference the ID scheme.

## Source

- Nate Discord 2026-05-24 04:48Z: "that's not what I meant for stable ids. I mean like ticket ids. … Like A-234, LAUNCHER-1, T45." ([^discord-1507968405213286580])
- Nate Discord 2026-05-24 04:49Z: "i'd prefer keeping bullets over making a table, I just want the ID prefixed and in the file name" ([^discord-1507968726396440678])
- Pattern reference: `/home/nsheaps/src/nsheaps/.ai-agent-jack/docs/cross-agent-consistency.md` uses `L1`, `S1`, `P1`, `R1`, `B1`, `I1` (single-letter section code + sequential number).

## ID scheme

**Format:** `<section-code><number>` — single uppercase letter for section + monotonic counter, NO hyphen (matches jack's existing convention).

**Section codes:**

- `I` = intro (`#intro`)
- `F` = farish-skills (`#farish-skills`)
- `C` = cleanup-prs (`#cleanup-prs`)
- `R` = fix-reviews (`#fix-reviews`)
- `D` = dreaming (`#dreaming`)
- `E` = end-of-tonight (`#end-of-tonight`)

**Counter rules:**

- Assigned in CREATION order, not visual position.
- Numbers NEVER get reused. If `I2` is killed/removed, the gap stays — `I14` is the next free counter, not "reuse `I2`".
- One-time bootstrap for pre-existing items: assign in current visual order (we have no creation-order signal for old items). From then on, new items get the next free number for that section.

**Per-section "next-id" hint:** small HTML comment under each section header tracks the next free counter, e.g. `<!-- next-id: I14 -->`. Avoids re-scanning to assign a new ID.

**Bullet format in MASTER.md:**

```markdown
1. ✅ `I1`: [turn off agent teams and restart.](./task-summary/I1-agent-teams-off.md)
```

(Backticked ID + colon + linked title, prefixed after the status emoji.)

**Filename format:** `<ID>-<short-slug>.md`, e.g. `I1-agent-teams-off.md`. The slug is the existing slug minus any leading numbers; the ID replaces them.

## Intro-section ID assignment (creation-order — bootstrap)

| List # now | ID  | Item                                  |
| ---------- | --- | ------------------------------------- |
| 1          | I1  | turn off agent teams + restart        |
| 2          | I2  | fix numbering / MASTER.md migration   |
| 3          | I3  | migrate alex memory to repo           |
| 4          | I4  | PreToolUse hook block .md writes      |
| 5          | I5  | project-tracking-workflow skill       |
| 6          | I6  | stable IDs (this task)                |
| 7          | I7  | spin down jack/henry                  |
| 8          | I8  | tmux fork/compact                     |
| 9          | I9  | extract project-tracking into scripts |
| 10         | I10 | Take X passes                         |
| 11         | I11 | INTAKE.md                             |
| 12         | I12 | do-in-order / golden-child            |
| 13         | I13 | task-utils maxInProgress config       |

Next free: `I14`.

## Implementation plan (atomic sub-steps — all in ONE commit batch)

1. **Rewrite per-task doc** (this file) with the new scheme. ✓ done in this edit.
2. **MASTER.md — intro section bullets**: prefix each top-level bullet with `` `IN`: `` (after status emoji, before linked title).
3. **MASTER.md — Rules section refs**: `#intro#12 → I12`, `#intro#4 → I4`, `#intro#2 → I2`, `#intro#3 → I3`, `#intro#6 → I6`. Drop the parenthetical "(Number will become stable when …)" in Rule 3 — obsolete.
4. **MASTER.md — `<!-- next-id: I14 -->` hint** under the `#intro` section header (after the existing `<a id="intro"></a>` and the prose intro paragraph).
5. **git mv 6 per-task docs:** add `IN-` prefix to each filename. Update the MASTER.md link targets in step 2 to match.
6. **Update each per-task doc's `Track-doc item:` header** to use the new ID form: `**Track-doc item:** \`I1\` — [#intro / I1](../MASTER.md#intro)` (no fragile list-number ref).
7. **SKILL.md "Worked example"**: swap `#intro#6` → `I6`, mention the new ID convention.
8. **Other-section IDs deferred**: do NOT mass-apply `F1`, `C1...C7`, etc. now — those don't have task-summary docs, no cross-refs to update. Apply ID-at-creation when those items get task-summary docs (going forward). The `project-tracking-workflow` skill enforces this.
9. **Validate**:
   - `grep -rn '#intro#[0-9]' docs/project-tracking/` returns 0 hits.
   - `ls docs/project-tracking/task-summary/I*.md | wc -l` returns 6.
   - `grep -c '\`I[0-9]' docs/project-tracking/MASTER.md` returns 13.
10. **Commit + push** the bundle.
11. **Flip MASTER.md item I6 → ✅** in a second commit + push.

## Scope guardrails

- Do NOT renumber visible list numbers — prettier auto-manages those.
- Do NOT touch sub-bullets (nested 1./2./3. under top-levels) — only top-level intro items get IDs in this pass.
- Do NOT apply IDs to other sections (F, C, R, D, E) in this commit — deferred until their items get task-summary docs.
- Do NOT mass-update unrelated docs that mention `#intro#N`. Limit to MASTER.md + the 6 per-task docs + SKILL.md.
- Do NOT add HTML anchors — the bullet-prefix form is sufficient (Nate's correction).

## Open questions

- None.

## Log

- 2026-05-24 04:21Z (Nate Discord): handed me the 7-step workflow + directed me to do the stable-IDs work.
- 2026-05-24 04:28Z (alex): first per-task doc with letter-suffix HTML-anchor scheme (`intro-A`, `intro-B`, …).
- 2026-05-24 04:30Z (alex): dispatched sonnet sub-agent `stable-ids-applier` to apply the letter scheme.
- 2026-05-24 04:48Z (Nate Discord [^discord-1507968405213286580]): "that's not what I meant for stable ids. I mean like ticket ids. … A-234, LAUNCHER-1, T45."
- 2026-05-24 04:49Z (alex): killed sub-agent + reverted its in-flight edits to MASTER.md + 5 per-task docs + SKILL.md.
- 2026-05-24 04:50Z (Nate Discord [^discord-1507968726396440678]): "i'd prefer keeping bullets over making a table, I just want the ID prefixed and in the file name."
- 2026-05-24 04:51Z (alex): this per-task doc rewritten with corrected ticket-style scheme. Applying manually myself, no sub-agent.
- 2026-05-24 05:05Z (alex): closed. MASTER.md item 6 flipped 🚧 → ✅ in commit [`04246cd`][^commit-04246cd] (agents/main); skill update landed in commit [`a71de32`][^commit-a71de32] (alex/main).
- 2026-05-24 15:34Z (Nate Discord [^discord-1508130974091841647]): **retro on scope deviation.** The MASTER.md bullet for `I6` said "every tracked item in MASTER.md" but this per-task doc narrowed scope to intro-only with the explicit guardrail "Do NOT apply IDs to other sections (F, C, R, D, E)." Reasons I narrowed: (a) other sections had no per-task docs yet, so there were no cross-refs needing update; (b) intro-only felt like manageable single-commit scope. Net effect: `I14` had to be created afterward as a separate ticket to cover the all-sections sweep when Nate said "Give all the bullets stable IDs" — duplicating coordination overhead for the same conceptual work. **Lesson:** when MASTER.md bullet text and per-task doc scope diverge, that's a signal to STOP and ask, not to silently narrow. **Behavior fix:** project-tracking-workflow skill step 3.3 "Scope review" now mandates re-reading the original message and explicitly asking the handler if drafted scope is narrower/broader than the message. Skill update landed in [`159058d`][^commit-159058d].

[^discord-1507968405213286580]: https://discord.com/channels/1490863845252665415/1497431286661517353/1507968405213286580

[^discord-1507968726396440678]: https://discord.com/channels/1490863845252665415/1497431286661517353/1507968726396440678

[^commit-04246cd]: https://github.com/nsheaps/agents/commit/04246cd

[^commit-a71de32]: https://github.com/nsheaps/.ai-agent-alex/commit/a71de32

[^commit-159058d]: https://github.com/nsheaps/.ai-agent-alex/commit/159058d

[^discord-1508130974091841647]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508130974091841647
