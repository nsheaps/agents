---
type: feature
created: 2026-05-26T01:02:31Z
state: to-triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508636419617194044
events:
  - {
      ts: 2026-05-26T01:02:31Z,
      by: alex,
      change: "drafted from Discord ask[^discord-ask] — P1 split from task-work-on-it (P0)",
    }
  - {
      ts: 2026-05-25T00:00:00Z,
      by: alex-triager,
      change: "promoted drafts/ → to-triage/ (priority 1)",
    }
---

# Journaling topic-list skill (persistent topics + auto-consult when journaling without explicit topic)

## Raw ask

> keep a topic list for journaling that you keep updated that when you journal without a topic you think about those topics too (and capture the other topics we've talked about so far)
>
> The mentioned journaling stuff is a p1 ticket separate from the task-work-on-it skill and it's associated hooks and agent files.

Source: Discord msg[^discord-ask] (2026-05-26 01:00Z)

## Quick capture

- Writing-journal-entries skill currently picks topic from active task / handler ask.
- Extend: maintain a persistent "topic list" file (e.g. `docs/journal/.topics.md` or memory file).
- When journaling without explicit topic, skill consults the topic list AND adds the chosen one (or extends with new topics surfaced during writing).
- Backfill: capture topics from recent Discord conversations + `ARCHITECTURE_DRAFT.md` OQs into initial topic list.

[^discord-ask]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508636419617194044>
