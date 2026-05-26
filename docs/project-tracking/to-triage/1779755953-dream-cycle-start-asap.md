---
type: feature
created: 2026-05-26T00:45:00Z
state: to-triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062
events:
  - { ts: 2026-05-26T00:45:00Z, by: alex, change: "created from Discord ask[^discord-ask]" }
---

# Dream cycle: start ASAP to self-correct behavior

## Original ask

> I want you to dream and make a new version of your self asap so you can really correct these things. and I know making the dream cycle is not gonna be trivial.

Source: Discord msg[^discord-ask] (2026-05-26 00:45Z)

## Triage notes

- Re-prioritizes existing I38 (agentic-behavior self-rewrite) — see MASTER.md M6 dreaming section.
- Implementation: archive current ruleset → score against rubric → emit new ruleset → PR with CI review.
- Non-trivial: needs design pass on rubric categories + archive structure BEFORE dispatch.

## Footnote references

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062
