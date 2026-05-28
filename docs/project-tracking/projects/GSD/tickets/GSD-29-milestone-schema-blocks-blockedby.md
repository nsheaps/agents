---
type: chore
created: 2026-05-26T00:45:00Z
id: GSD-29
legacy_ids:
  - "1779755950"
state: triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-605"
    note: "#605: AGENT(triager) Background sub-agent — execute #601 triage-promotion workflow"
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062
events:
  - { ts: 2026-05-26T00:45:00Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:25:00Z,
      by: alex,
      change: "promoted to-triage → GSD-29 (state=triage) per #601 workflow",
    }
---

# Milestone schema: blocks / blockedBy ordering fields

## Original ask

> we need to make milestones support ordering (blocks/blockedBy). I wanna do m6 immediately after m5.

Source: Discord msg[^discord-ask] (2026-05-26 00:45Z)

## Triage notes

- Extend `.metadata/schema-milestone.yaml` with `blocks: []` and `blockedBy: []` array fields (string IDs like `M5`).
- Default: M6 blockedBy M5; backfill across all 16 milestone frontmatter files.
- ticket-updater agent's cascade-hooks (per GSD-27 + GSD-28) should auto-rewrite MASTER.md ordering when these fields change.

## Footnote references

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062
