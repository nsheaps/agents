---
type: chore
created: 2026-05-26T00:51:24Z
state: to-triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508633620087312454
events:
  - {
      ts: 2026-05-26T00:51:24Z,
      by: alex,
      change: "filed from Discord ask[^discord-ask] per immediate-file-on-receive rule",
    }
---

# Install agent-observe plugin (from another marketplace)

## Original ask

> In the past your config had an agent-observe plugin from another marketplace, please install it
>
> — Nate Discord [1508633620087312454](https://discord.com/channels/1490863845252665415/1497431286661517353/1508633620087312454) (2026-05-26 00:51:24Z)

## Triage notes

- Find the marketplace `agent-observe` was sourced from (check git history of `.claude/settings.json` `extraKnownMarketplaces` block — likely a third marketplace beyond the current `ai-mktpl` + `agents` entries)
- Add the marketplace to `extraKnownMarketplaces` (if not already listed) and enable `agent-observe@<marketplace>` in `enabledPlugins`
- Verify post-install: plugin loads at session start, observability hooks/tooling become available
- Context for ask: Nate just flagged "your tasks look wrong" — agent-observe is the visibility tool that surfaces task state, so installing it unblocks downstream task-discipline work

## Footnote references

[^discord-ask]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508633620087312454>
