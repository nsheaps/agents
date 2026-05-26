---
type: feature
id: GSD-23
priority: 0
state: in-progress
created: 2026-05-25T23:42:00Z
project: GSD
assignee: contacts://heaps-group/byGithubAppUrl/https%3A%2F%2Fgithub.com%2Fapps%2Falex-nsheaps
requester: contacts://heaps-group/byGithubUsername/nsheaps
milestone: ../../../milestones/M2.md
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508616421360533577
  - id: sibling-hook-ticket
    type: ticket
    url: ./GSD-24-bash-chain-count-hook.md
events:
  - { ts: 2026-05-25T23:42:00Z, by: alex, change: "created from Nate Discord ask[^discord-ask]" }
---

## Original ask

> update mantras in arch draft. Only ever call a chain of commands at most twice. If you would do something like that a third time, save the chain to a tool/script first, then run that script for the third instance. Prefer adapt-existing tools/scripts > new tools/scripts. Prefer mcp > skills/scripts. Skills + scripts are fine too. Add hooks, tool signature (the shasum of a call containing at least 1 ; | && & or ||) called twice or more should print a warning to the agent. If the same task is called more than 10 times, block. Always have a break glass mechanism (in this case, just calling it again indicates breakglass and not be blocked, but reset on success).

— Nate, Discord 2026-05-25 23:42Z[^discord-ask]

## User story

As Alex (the agent), I want the chain-mantra documented in `ARCHITECTURE_DRAFT.md` so that I (and peer agents reading the doc) treat "do it a third time — script it" as a hard rule, not a soft preference.

## Stakeholders

- **Nate** (handler) — directive source
- **Alex** (subject) — primary author and first adopter of the mantra
- **Henry / Jack** — peer agents who will adopt the same mantra when they read the doc

## Requirements

The mantra entry in `ARCHITECTURE_DRAFT.md` must state:

- Only ever call a chain of commands (any shell expression containing `;`, `|`, `&&`, `&`, or `||`) at most twice; the third instance of the same chain must come from a saved script or tool.
- Prefer adapt-existing tools/scripts over creating new ones.
- Prefer MCP over skills/scripts; skills and scripts are acceptable when MCP is not available or appropriate.
- The rule is enforced at the tooling level by the Bash chain-count hook — see [GSD-24](./GSD-24-bash-chain-count-hook.md).

## Acceptance criteria

- [ ] Mantra section in `ARCHITECTURE_DRAFT.md` updated (in the `nsheaps/agents` repo)
- [ ] PR opened in `nsheaps/agents`
- [ ] PR merged
- [ ] Cross-link from GSD-24 added in the mantra section (so the reader sees the enforcement path alongside the rule)

## Implementation

PR URL: TBD — the actual `ARCHITECTURE_DRAFT.md` edit is a separate follow-on task dispatched after this ticket is filed.

## Follow-ups (out of scope)

The hook enforcement side (warning at 2+ uses, block at 10+, break-glass mechanism) lives in [GSD-24](./GSD-24-bash-chain-count-hook.md) and is tracked there.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508616421360533577
