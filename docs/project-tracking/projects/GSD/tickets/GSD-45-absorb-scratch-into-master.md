---
type: chore
id: GSD-45
legacy_ids:
  - "1779755980"
created: 2026-05-26T01:04:29Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508636913098162307
  - id: discord-elaboration
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508637136302374933
events:
  - { ts: 2026-05-26T01:04:29Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - { ts: 2026-05-26T01:40:00Z, by: alex-triager, change: "promoted to-triage → GSD-45 (state=triage) per triager-v2 workflow" }
---

# Absorb scratch into MASTER.md without losing context or duplicating work

## Original ask

> I think we need a p1 ticket for absorbing scratch into MASTER.md without losing context or duplicating stuff. This organization is a massive undertaking. Lets start with a task that just updates the project-setup.md file with all the things we need to do so far with this convo because wow this is hard to keep track of

Source: Discord msg[^discord-ask] (2026-05-26 01:04Z)

## Related elaboration

> make a very clear ordered list alex, I want to see all the tickets listed chronologically in project-setup. Project tracking foundations seems to be m1 in MASTER.md, so project-setup maybe is just the milestone itself? what do you think?

Source: Discord msg[^discord-elaboration] (2026-05-26 01:05Z)

## Goal

Absorb the unstructured scratch content under `docs/` into MASTER.md (and/or appropriate milestone files) without losing context and without duplicating items that have already been promoted to tickets / milestones.

## Why now

The project-tracking organization work is in active flight tonight — many items from scratch have already been triaged into tickets, but the scratch files still exist as a parallel source of truth. Every additional triage pass risks (a) re-filing something that's already a ticket or (b) silently losing context from scratch that didn't make it into the canonical record. The longer this lives, the harder reconciliation gets.

## Scope notes

- Verify exact scratch filenames first. Per SETUP.md + earlier archaeology, at least `docs/scratch.md` exists; there may be more under `docs/`.
- Non-trivial because:
  - scratch is unstructured prose
  - MASTER.md uses stable IDs
  - many scratch items have already been promoted to tickets / milestones (need dedupe, not blind re-import)
- Must preserve context (rationale, links, side discussions), not just headline items.

## Open architecture question

`docs/project-tracking/intake/project-setup.md` overlaps with M1 (currently named "Session bootstrap + project-tracking foundations" in MASTER.md). Possible consolidation:

- `project-setup.md` becomes (or links to) `M1.md`
- `intake/` folder evolves to just the bootstrap instructions for someone setting up project-tracking from scratch (i.e. the "how to start using this system" doc, not a parallel milestone tracker)

Triage grooming should decide this before splitting work.

## Companion task (NOT part of this ticket)

Update `project-setup.md` with a chronological ordered list of all tickets surfaced in tonight's convo. Alex (parent) handled this directly — it is NOT part of this ticket and should NOT be re-filed by triage.

## Acceptance criteria

- Every item from scratch is either (a) reflected in MASTER.md / a milestone file, or (b) explicitly dropped with reasoning logged.
- No duplicates between scratch and the canonical tracking.
- Scratch files are either deleted or reduced to a pointer at the canonical location.
- Architecture question above is resolved (intake/project-setup.md vs M1.md).

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508636913098162307

[^discord-elaboration]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508637136302374933
