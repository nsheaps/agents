---
type: feature
created: 2026-05-26T00:38:00Z
id: GSD-31
legacy_ids:
  - "1779755954"
state: triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508630474720018503
events:
  - { ts: 2026-05-26T00:38:00Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:25:00Z,
      by: alex,
      change: "promoted to-triage → GSD-31 (state=triage) per #601 workflow",
    }
---

# ticket-utils plugin: hoist ticket-updater + project-tracking-workflow from alex repo

## Original ask

> I think next step would be to make ticket-utils and pull stuff up there. You can keep the plugin as a plugin from a local marketplace (the worktree with your changes to the plugin) so it's not specific to you. Henry will need it, so will jack. Make a p0 ticket to cover the plugin creation and hoisting from your repo

Source: Discord msg[^discord-ask] (2026-05-26 00:38Z)

## Triage notes

- Hoist `ticket-updater` agent (`nsheaps/.ai-agent-alex/.claude/agents/ticket-updater.md`) and `project-tracking-workflow` skill (`nsheaps/.ai-agent-alex/.claude/skills/project-tracking-workflow/SKILL.md`) from alex repo into reusable plugin in `nsheaps/agents`.
- Local-marketplace pattern: install plugin from worktree path for in-dev iteration.
- Cascade hooks (per GSD-27): ticket-write → milestone+MASTER updates; milestone-write → tickets+MASTER updates; auto-update references+events fields.

## Footnote references

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508630474720018503
