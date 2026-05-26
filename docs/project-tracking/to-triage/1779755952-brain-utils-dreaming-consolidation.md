---
type: chore
created: 2026-05-26T00:45:00Z
state: to-triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062
events:
  - { ts: 2026-05-26T00:45:00Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:18:27Z,
      by: alex,
      change: "priority 0 → 1 per Nate Discord[^discord-prio]",
    }
---

# brain-utils owns M6: fold dreaming into brain-utils

## Original ask

> brain-utils which I mentioned earlier, should also be a part of m6 (dreaming), make dreaming part of brain-utils.

Source: Discord msg[^discord-ask] (2026-05-26 00:45Z)

## Triage notes

- brain-utils plugin (already triaged separately) becomes the M6 owner.
- dreaming becomes a subskill/component INSIDE brain-utils (not a separate plugin).
- Update the existing brain-utils triage ticket + M6.md milestone file accordingly.

## Footnote references

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062

[^discord-prio]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684>
