---
type: feature
id: GSD-18
priority: 4
state: done
created: 2026-05-24T03:30:00Z
completed: 2026-05-24T04:30:00Z
project: GSD
assignee: contacts://heaps-group/byGithubUsername/nsheaps
requester: contacts://heaps-group/byGithubUsername/nsheaps
milestone: ../../../milestones/M1.md
legacy_ids:
  - I5
aliases:
  - "I5"
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-571"
    note: "#571: Round 1 — promote 10 done-bucket to-triage → GSD-N tickets"
  - id: discord-1507961632469549076
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1507961632469549076
events:
  - {
      ts: 2026-05-25T23:43:00Z,
      by: alex,
      change: "promoted from to-triage/I5-project-tracking-workflow to GSD-18 (state=done)",
    }
---

# [old I5] Create `project-tracking-workflow` skill

**Track-doc item:** `I5` — [`#intro` / I5](../MASTER.md#intro) (assigned stable ID `I5` per `I6` on 2026-05-24)
**Status:** ✅ done
**Owner:** alex

## Original message

> capture this in a skill … keep it up to date as we iterate on the process.

— Nate, Discord 2026-05-24 04:22Z ([msg `1507961632469549076`][^discord-1507961632469549076]). I5 is alex-created (no pre-N2 MASTER.md bullet with verbatim handler text). The full 7-step workflow content Nate provided is documented in the `## Source` section below.

## Deliverable

- A skill at `.claude/skills/project-tracking-workflow/SKILL.md` in alex repo that codifies Nate's 7-step workflow for iterating tasks tracked in `docs/project-tracking/MASTER.md`.
- The skill includes the canonical 7 steps verbatim, plus a "keep this skill up to date as we iterate" reminder so the workflow can evolve in-place.
- A `<!-- UPSTREAM: agentic-behavior -->` (or similar) marker noting it's a candidate for upstreaming once stable, per `skill-resolution-order.md`.

## Source

Nate Discord 2026-05-24 04:21Z ([msg `1507961632469549076`][^discord-1507961632469549076]):

The 7 generic steps:

1. find the task in the master doc, add if missing, add any needed detail
2. before you start working on the task, make the task-summary doc and link it
3. before you start working on the task, update it with a plan and other relevant info
4. update master.md to mark the task as in progress
5. do some stuff. update the task summary with what was done and next steps. Think, replan your next moves. Update the tasks overall plan. Do any necessary validation to ensure that bit is complete. update master list with any new tasks you learn about along the way. Avoid scope creep
6. Repeat 5 as many times as needed until the task is complete.
7. update master list to mark task as done

The 10-step concrete example (for adding stable IDs) is documented in the skill as a "worked example" reference rather than copy-pasted, so the skill stays small.

## Validation

- File exists at `.claude/skills/project-tracking-workflow/SKILL.md` with non-empty body.
- Skill body contains exactly 7 numbered top-level steps, in Nate's order, matching the verbiage above (paraphrasing allowed if intent preserved).
- Skill has a "keep up to date" note near the top so future iterations land in this file rather than a new one.
- Skill has an `<!-- UPSTREAM: ... -->` marker per `skill-resolution-order.md`.
- Skill is discoverable via `Skill(project-tracking-workflow)` (folder structure follows existing local skills like `idle-5-min`).
- MASTER.md flips this item from 🚧 → ✅ in the same commit that completes the task.

## Implementation

1. Bootstrap exception: write the skill directly from Nate's message, since the skill itself codifies the workflow being used to create it (per Rule 1's "doc bootstrap" allowance).
2. Folder: `mkdir -p .claude/skills/project-tracking-workflow`.
3. Write `SKILL.md` with frontmatter (name + description), upstream marker, applicability note, 7 steps, and self-update reminder.
4. Self-check: re-read the SKILL.md, confirm all 7 steps are present and ordered.
5. Update MASTER.md: flip item 5 emoji 🚧 → ✅. Add Log line in this file.
6. Commit + push: one commit covering the MASTER.md scope-bullet + skill file + this task doc + state flip.

## Scope guardrails

- Do NOT inline the 10-step stable-IDs example into the skill body — link to `task-summary/stable-ids.md` (the next item) once that doc exists, or just paraphrase as one bullet. Keeps the skill narrow.
- Do NOT add hooks or coach text changes — that's separate scope (and would be a new MASTER.md item).
- Do NOT upstream to a plugin in this iteration — local first per `skill-resolution-order.md`. Mark for future upstream.
- Do NOT touch the spin-down (`#intro#7`, was `#5`) work in this commit — Nate explicitly held that.

## Open questions

- None.

## Log

- 2026-05-24 04:22Z (Nate Discord): handed me the 7-step workflow with directive to "capture this in a skill … keep it up to date as we iterate on the process."
- 2026-05-24 04:23Z (alex): added items 5 (this skill) + 6 (stable IDs) to MASTER.md, renumbered subsequent items 5–10 → 7–12, updated Rule 3's `#intro#9` ref → `#intro#11`, marked this item 🚧.
- 2026-05-24 04:23Z (alex): this per-task doc created (step 2 of the workflow).
- 2026-05-24 04:24Z (alex): commit `d558e55` landed scope-bullet + renumber + per-task doc; pushed to nsheaps/agents main.
- 2026-05-24 04:25Z (Nate Discord): inserted new `9. extract … into scripts` bullet AND `## ACTUAL END OF TONIGHT. TOMORROW STARTS HERE` header between `#intro#7` and `#intro#8`. Renumbered duplicate 9→10, 10→11, 11→12, 12→13. Bumped Rule 3's ref `#intro#11` → `#intro#12` (We're-gonna-do-this-in-order is now item 12).
- 2026-05-24 04:25Z (alex): SKILL.md written at `.claude/skills/project-tracking-workflow/SKILL.md` (alex repo). Self-check: 7 steps present + in order, UPSTREAM marker, "keep up to date" note, Rules + Anti-patterns + Worked-example sections. Discoverable via Skill() (confirmed in skill list).
- 2026-05-24 04:25Z (alex): flipped MASTER.md item 5 🚧 → ✅. Commit + push next.

[^discord-1507961632469549076]: https://discord.com/channels/1490863845252665415/1497431286661517353/1507961632469549076
