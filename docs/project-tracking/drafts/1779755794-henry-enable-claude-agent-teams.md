---
type: chore
created: 2026-05-26T00:36:34Z
state: draft
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508628998366691458
events:
  - {
      ts: 2026-05-26T00:36:34Z,
      by: alex,
      change: "drafted from Discord ask[^discord-ask] — filed to drafts/ per new rule[^drafts-rule]",
    }
---

# Reconfigure henry to enable Claude agent teams

## Raw ask

> can you also p0 reconfigure henry to have claude agent teams turned on?
>
> — Nate Discord [1508628998366691458](https://discord.com/channels/1490863845252665415/1497431286661517353/1508628998366691458) (2026-05-26 00:33Z)

## Quick capture

- Enable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in henry's runtime env
- Likely path: add `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` to the `env` block in `nsheaps/.ai-agent-henry/.claude/settings.json`
- Verify after restart: agent-teams features available in henry's session
- Cross-check parity: alex/jack/henry — should agent teams be on for all peer agents, or just henry for this experiment?

## Open question (Discord reply pending)

Per the new drafts rule (Nate Discord [1508628282814496808](https://discord.com/channels/1490863845252665415/1497431286661517353/1508628282814496808)), new asks go to drafts and are triaged later. But the ask carries an explicit P0 label — asked Nate whether to execute now or hold until triage.

## Triage to-do

- [ ] Confirm scope (henry-only vs all peer agents)
- [ ] Promote to `projects/GSD/tickets/GSD-N-<slug>.md` with priority=0
- [ ] Decide commit author (henry self-edits + restarts, OR alex pushes branch + henry merges)

## Footnote references

[^discord-ask]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508628998366691458>

[^drafts-rule]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508628282814496808>
