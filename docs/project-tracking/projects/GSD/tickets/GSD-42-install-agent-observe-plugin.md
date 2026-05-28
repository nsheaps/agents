---
type: chore
id: GSD-42
legacy_ids:
  - "1779755957"
created: 2026-05-26T00:51:24Z
state: triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-611"
    note: "#611: AGENT(triager-v2): Process to-triage chronologically per new spec (14 items)"
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508633620087312454
events:
  - {
      ts: 2026-05-26T00:51:24Z,
      by: alex,
      change: "filed from Discord ask[^discord-ask] per immediate-file-on-receive rule",
    }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-42 (state=triage) per triager-v2 workflow",
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

## Acceptance criteria

- `agent-observe` plugin is listed in alex's `.claude/settings.json` `enabledPlugins`.
- The source marketplace is identified and added to `extraKnownMarketplaces` if not already present.
- Plugin loads successfully at next session start (no startup errors from agent-observe).
- Agent-observe tooling/hooks are functional (verify via a post-install test).

## Notes

- Priority P0 because: agent-observe gives Nate visibility into task state, which was the trigger for the task-discipline push. Installing it is fast (config change + maybe a PR to the marketplace entry) and unblocks the GSD-41 (task vs ticket criteria) work.
- Do NOT confuse with `agent-controller` (future event-bus daemon) — agent-observe is an existing observability plugin, not the controller.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508633620087312454
