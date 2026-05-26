---
type: feature
id: GSD-38
legacy_ids:
  - "1779755953"
created: 2026-05-26T00:45:00Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062
  - id: discord-prio
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684
events:
  - { ts: 2026-05-26T00:45:00Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - { ts: 2026-05-26T01:18:27Z, by: alex, change: "priority 0 → 1 per Nate Discord[^discord-prio]" }
  - { ts: 2026-05-26T01:40:00Z, by: alex-triager, change: "promoted to-triage → GSD-38 (state=triage) per triager-v2 workflow" }
---

# Dream cycle: start ASAP to self-correct behavior

## Original ask

> I want you to dream and make a new version of your self asap so you can really correct these things. and I know making the dream cycle is not gonna be trivial.

Source: Discord msg[^discord-ask] (2026-05-26 00:45Z)

## Goal

Kick off the first dream cycle as soon as the brain-utils plugin (GSD-37) and the agentic-behavior self-rewrite skill (I38) are sufficiently ready to run. The dream cycle archives the current ruleset, scores it against a rubric, and emits a new version of the ruleset as a PR. The urgency signal here is Nate's explicit "asap" — this should be treated as the first meaningful test of the brain-utils / dreaming subsystem.

## Triage notes

- Re-prioritizes existing I38 (agentic-behavior self-rewrite) — see MASTER.md M6 dreaming section.
- Implementation path: archive current ruleset → score against rubric → emit new ruleset → PR with CI review.
- Non-trivial: needs design pass on rubric categories + archive structure BEFORE dispatch.
- Depends on GSD-37 (brain-utils plugin) for the dreaming subskill infrastructure.
- The first dream run should focus on the **communication and silence failures** that prompted Nate's ask — specifically: auto-replying to messages not addressed to Alex, failing to stay quiet in shared channels, task-state accuracy issues.

## Acceptance criteria

- First dream cycle completes: a PR exists on ai-mktpl with a new version of the agentic-behavior ruleset, scored against the rubric.
- The PR documents what was archived, what scores changed, and which categories drove the ruleset updates.
- CI review label (`claude-review`) is requested on the PR.
- The result of the first dream run is journaled (entry in `docs/journal/` noting what the dream cycle surfaced + key behavior corrections).

## Notes

- This ticket represents urgency ("asap") not implementation scope — the implementation lives in I38 + GSD-37.
- The dream cycle is explicitly "not gonna be trivial" per Nate — do NOT rush into a half-baked first run. Design the rubric first, then run.
- Once the first cycle completes, the dream cycle should be scheduled as a recurring cron (low-frequency, e.g. weekly or per-milestone-completion) — that recurring setup is follow-on work.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062

[^discord-prio]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684
