---
type: chore
created: 2026-05-26T01:08:08Z
state: to-triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508637831411662960
events:
  - { ts: 2026-05-26T01:08:08Z, by: alex, change: "created from Discord ask[^discord-ask]" }
---

# triage-promotion + MASTER.md update (P3+ workflow)

## Original Discord message

> lets do the triage process for any draft p3 and above into to-triage, and and to-triage p3 and above into a ticket in triage state. I want numbers for all the p3+ tickets we've added to triage asap. We can add details to those tickets. Then I want MASTER.md updated with all those tickets. If they're not in a milestone, put em at the top in a 'no milestone' section. Make sure tickets in MASTER.md also list the priority.

Source: Discord msg[^discord-ask] (2026-05-26 01:08Z)

## Goal

Multi-phase triage sweep: promote drafts to to-triage, promote to-triage items to numbered GSD-N tickets in triage state, and update MASTER.md to reflect everything — including a new "No milestone" section for tickets that don't yet belong to a milestone, with priority shown on every line.

## Phases

### Phase 1: drafts/ → to-triage/ promotion (P3+ only)

- Scan `drafts/*.md` for `priority: <0-3>` items.
- For each P3+, move to `to-triage/` (keep epoch filename, just change folder).
- Frontmatter update: `state: draft` → `state: to-triage`.
- Open question: single commit per file vs bulk commit (propose bulk for speed; revisit if traceability is required).

### Phase 2: to-triage/ → GSD-N ticket assignment (P3+ only)

- Scan `to-triage/*.md` for `priority: <0-3>` items (includes phase-1-promoted ones).
- Assign next-free GSD-N number to each (current max: GSD-27 + recent 1779755950..1779755990 batch; verify actual ceiling).
- Write `projects/GSD/tickets/GSD-N-<slug>.md` with frontmatter `state: triage` (verify `triage` is a valid state in `schema-ticket.yaml`; fall back to `open` if not).
- Body: copy the original ask + triage notes from the to-triage file.
- After promotion, REMOVE the to-triage file (it's now a GSD-N ticket).
- "We can add details to those tickets" — don't block on full body completeness. Minimum viable: original-ask + state + priority + milestone (default null → "No milestone" section).

### Phase 3: MASTER.md update

- For every P3+ ticket (newly-assigned + existing), ensure it appears in MASTER.md.
- Tickets in a milestone go under that milestone's section.
- Tickets WITHOUT a milestone go under a NEW top-of-file section: `## No milestone` (placed above M1).
- Each ticket bullet MUST list priority: `**P<priority>** | [GSD-N | <emoji-state>](relative-link) — <short-desc>`.
- Additive — do not drop existing MASTER.md content.

## Out-of-scope (capture as follow-ups if surfaced)

- P4/P5 items stay in drafts (this ticket = P3+ only).
- Filling out ticket bodies beyond minimum-viable (separate work per ticket).
- Milestone assignment for currently-unmilestoned tickets ("No milestone" section is acceptable for now per Nate).

## Acceptance criteria

- All drafts at P3+ have been moved to to-triage/ with `state: to-triage`.
- All to-triage items at P3+ have a numbered GSD-N ticket in `projects/GSD/tickets/` with `state: triage` (or `open` if schema dictates).
- The corresponding to-triage files have been removed after promotion.
- MASTER.md lists every P3+ ticket with priority + GSD-N link + state emoji; unmilestoned tickets appear under a new "No milestone" section above M1; nothing previously in MASTER.md was dropped.

## Open questions

- Confirm `schema-ticket.yaml` has `triage` as a valid state value, OR use `open` as the canonical post-to-triage state.
- Single-commit-per-file vs bulk commit for phases 1 + 2 (propose bulk).
- GSD-N numbering: assign sequentially in epoch-order of to-triage filenames (chronological)?

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508637831411662960
