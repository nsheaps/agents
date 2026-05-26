---
type: feature
id: GSD-44
legacy_ids:
  - "1779755971"
created: 2026-05-26T01:02:31Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508636419617194044
events:
  - { ts: 2026-05-26T01:02:31Z, by: alex, change: "drafted from Discord ask[^discord-ask] — P1 split from task-work-on-it (P0)" }
  - { ts: 2026-05-26T01:40:00Z, by: alex-triager, change: "promoted to-triage → GSD-44 (state=triage) per triager-v2 workflow" }
---

# Journaling topic-list skill (persistent topics + auto-consult when journaling without explicit topic)

## Original ask

> keep a topic list for journaling that you keep updated that when you journal without a topic you think about those topics too (and capture the other topics we've talked about so far)
>
> The mentioned journaling stuff is a p1 ticket separate from the task-work-on-it skill and it's associated hooks and agent files.

Source: Discord msg[^discord-ask] (2026-05-26 01:00Z)

## Goal

Maintain a persistent "topic list" for the writing-journal-entries skill so that journaling without an explicit topic still surfaces relevant ongoing themes. The topic list is updated over time as new themes emerge from Discord conversations, architecture drafts, and ongoing work.

## Requirements

- A persistent topic list file (e.g. `docs/journal/.topics.md` or a memory file in `memory/`).
- When the writing-journal-entries skill is invoked without an explicit topic:
  1. Consult the topic list.
  2. Choose the most relevant topic (or a cluster of related ones) based on current task context.
  3. After journaling, update the topic list: add new topics surfaced during writing, mark topics as "recently covered" to avoid repetition.
- Backfill: capture topics from recent Discord conversations + `ARCHITECTURE_DRAFT.md` open questions into the initial topic list.
- The topic list is versioned (in git), not ephemeral.

## Acceptance criteria

- Topic list file exists and contains at least 10 seed topics from recent work.
- Writing-journal-entries skill reads the topic list when invoked without an explicit topic.
- After journaling, the topic list is updated (new topics added, covered topics noted).
- Backfill commit exists that populates initial topics from recent Discord + ARCHITECTURE_DRAFT.md.

## Notes

- P1 (vs P0 for task-work-on-it GSD-43) — journaling is important but doesn't block the task-dispatch loop.
- This skill is adjacent to the brain-utils plugin (GSD-37) — the topic list could eventually become a node type in the brain-utils graph. For now, a simpler file-backed approach is fine.
- The writing-journal-entries skill is the integration point — update it to call this skill (or inline the topic-list logic if lightweight enough).

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508636419617194044
