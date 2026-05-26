---
type: chore
id: GSD-46
legacy_ids:
  - "1779755990"
created: 2026-05-26T01:08:08Z
state: triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508637831411662960
  - id: discord-spec-process
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643677935898826
  - id: discord-spec-rationale
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643791337422848
  - id: discord-spec-background
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643891325304993
  - id: discord-spec-alteration
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508644006551093381
  - id: discord-spec-acceptance
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508644125807869962
events:
  - { ts: 2026-05-26T01:08:08Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - { ts: 2026-05-26T01:31:22Z, by: alex, change: "appended Nate's new triage workflow spec — big spec message[^discord-spec-process]" }
  - { ts: 2026-05-26T01:31:49Z, by: alex, change: "appended Nate's rationale for iterative-context capture[^discord-spec-rationale]" }
  - { ts: 2026-05-26T01:32:12Z, by: alex, change: "appended Nate's execution-mode clarification (always background)[^discord-spec-background]" }
  - { ts: 2026-05-26T01:32:40Z, by: alex, change: "appended Nate's alteration-scope rule (triage-queue may alter todo/in_progress with approval)[^discord-spec-alteration]" }
  - { ts: 2026-05-26T01:33:08Z, by: alex, change: "appended Nate's acceptance-criteria constraint (alteration must update AC)[^discord-spec-acceptance]" }
  - { ts: 2026-05-26T01:40:00Z, by: alex-triager, change: "promoted to-triage → GSD-46 (state=triage) per triager-v2 workflow (self-referential meta-ticket)" }
---

# triage-promotion + MASTER.md update (P3+ workflow)

## Original ask

> lets do the triage process for any draft p3 and above into to-triage, and and to-triage p3 and above into a ticket in triage state. I want numbers for all the p3+ tickets we've added to triage asap. We can add details to those tickets. Then I want MASTER.md updated with all those tickets. If they're not in a milestone, put em at the top in a 'no milestone' section. Make sure tickets in MASTER.md also list the priority.

Source: Discord msg[^discord-ask] (2026-05-26 01:08Z)

## Goal

Multi-phase triage sweep: promote drafts to to-triage, promote to-triage items to numbered GSD-N tickets in triage state, and update MASTER.md to reflect everything — including a new "No milestone" section for tickets that don't yet belong to a milestone, with priority shown on every line.

## Phases

### Phase 1: drafts/ → to-triage/ promotion (P3+ only)

- Scan `drafts/*.md` for `priority: <0-3>` items.
- For each P3+, move to `to-triage/` (keep epoch filename, just change folder).
- Frontmatter update: `state: draft` → `state: to-triage`.

### Phase 2: to-triage/ → GSD-N ticket assignment (P3+ only)

- Scan `to-triage/*.md` for `priority: <0-3>` items.
- Assign next-free GSD-N number to each (starting from GSD-33 per triager-v2 session).
- Write `projects/GSD/tickets/GSD-N-<slug>.md` with frontmatter `state: triage`.
- After promotion, REMOVE the to-triage file (it's now a GSD-N ticket).

### Phase 3: MASTER.md update

- For every P3+ ticket (newly-assigned + existing), ensure it appears in MASTER.md.
- Tickets WITHOUT a milestone go under a NEW top-of-file section: `## No milestone`.
- Each ticket bullet MUST list priority.
- Additive — do not drop existing MASTER.md content.

## New triage workflow spec (Refinements 1–5, Nate 01:31–01:33Z)

Five messages from Nate constitute a comprehensive new spec for how the triage queue process should work going forward. This spec supersedes the phased workflow above.

### Refinement 1 — the full iterative triage process[^discord-spec-process]

The new process mandates strict ordering: to-triage is always processed before triage-queue, and triage-queue is always processed before the backlog. Items in to-triage are consumed chronologically, with forward-looking items folded in and marked. Each to-triage item may fan out to zero, one, or multiple tickets in the project triage queues. P3+ priority items auto-promote to backlog state; lower-priority items remain in triage state until groomed or manually promoted.

### Refinement 2 — rationale: iterative context accumulation[^discord-spec-rationale]

The incremental fold-in approach is specifically designed for conversations where requirements evolve across multiple messages. Rather than creating a ticket from only the first message and losing later refinements, the process holds the item in to-triage until all related context has been folded in.

### Refinement 3 — triage always runs in background[^discord-spec-background]

No triage processing step should ever block the main session. All triage work must be dispatched via `run_in_background: true` (or equivalent cron/sub-agent mechanism) so Alex remains responsive to handler messages and other in-flight work.

### Refinement 4 — alteration scope extends to todo and in_progress[^discord-spec-alteration]

When processing the project triage-queue, if incoming items are related to a ticket already in `todo` or `in_progress` state, those tickets CAN be altered — but only with explicit handler (Nate) approval before the alteration is applied.

### Refinement 5 — acceptance criteria must accompany any alteration[^discord-spec-acceptance]

Any alteration to a ticket (whether in `triage`, `todo`, or `in_progress` state) must be accompanied by a corresponding update to that ticket's acceptance criteria.

## Acceptance criteria

- All to-triage items at P3+ have a numbered GSD-N ticket in `projects/GSD/tickets/` with `state: triage`.
- The corresponding to-triage files have been removed after promotion (or marked with folded-forward annotations).
- MASTER.md lists every P3+ ticket with priority + GSD-N link + state emoji; unmilestoned tickets appear under a new "No milestone" section above M1.
- The new triage workflow spec (Refinements 1–5) is captured as a rule or skill in the appropriate location (project-tracking-workflow skill or a new triage-process rule).

## Out-of-scope

- P4/P5 items stay in drafts (P3+ only for this sweep).
- Filling out ticket bodies beyond minimum-viable (separate work per ticket).
- Milestone assignment for currently-unmilestoned tickets ("No milestone" section is acceptable for now per Nate).

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508637831411662960

[^discord-spec-process]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643677935898826

[^discord-spec-rationale]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643791337422848

[^discord-spec-background]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643891325304993

[^discord-spec-alteration]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508644006551093381

[^discord-spec-acceptance]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508644125807869962
