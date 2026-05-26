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
  - {
      ts: 2026-05-26T01:31:22Z,
      by: alex,
      change: "appended Nate's new triage workflow spec — big spec message[^discord-spec-process]",
    }
  - {
      ts: 2026-05-26T01:31:49Z,
      by: alex,
      change: "appended Nate's rationale for iterative-context capture[^discord-spec-rationale]",
    }
  - {
      ts: 2026-05-26T01:32:12Z,
      by: alex,
      change: "appended Nate's execution-mode clarification (always background)[^discord-spec-background]",
    }
  - {
      ts: 2026-05-26T01:32:40Z,
      by: alex,
      change: "appended Nate's alteration-scope rule (triage-queue may alter todo/in_progress with approval)[^discord-spec-alteration]",
    }
  - {
      ts: 2026-05-26T01:33:08Z,
      by: alex,
      change: "appended Nate's acceptance-criteria constraint (alteration must update AC)[^discord-spec-acceptance]",
    }
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

## Refinement (Nate 2026-05-26 01:31–01:33Z) — new triage workflow spec

Five messages from Nate constitute a comprehensive new spec for how the triage queue process should work going forward. This spec supersedes the phased workflow above (see "Implications for current ticket body" below).

### Refinement 1 (Nate 01:31Z) — the full iterative triage process[^discord-spec-process]

> going forward, I think iteratively processing the triage queue should look like:
>
> 1. capture everything in to-triage immediately, with a priority indicative of the resulting ticket, not of the triaging.
> 2. everything must go from to-triage to project triage queues before the triage queues can be processed
>    a. if you are processing triage queues and something shows up in to-triage, you must triage that first.
> 3. When triaging the to-triage folder, do so chronologically. For each item, scan the rest of the triage items and related resources. To process that item, you can fold in bits and pieces of future items as long as those are appropriately marked in the item in to-triage. Take each bit of the item you're triaging and use it to build the files in the project triage queues. Each item in to-triage can update 0, 1, or more tickets in the triage queue. Keep processing chunks of the item in to-triage and the items you've pulled forward (and marked) in future triage items, until no more remain in the current file. Do not pull forward unrelated items. If an item is in the current triage item and is unrelated to teh current item, it can be moved to a new, next-in-line item.
> 4. when the to-triage folder is empty, we can triage the stuff in the triage-queue one at a time to get stuff into the triage state. Until a ticket is manually moved from triage to todo by a grooming process, or by a priority of that ticket 3 or higher (if multiple triages make the same queued triage ticket, the highest priority wins), the ticket stays in the triage state. If the ticket has a priority p3 or higher, it should immediately be moved into the backlog.
> 5. whenever stuff comes into to-triage, that takes highest priority. Those items in there make their way to triage queues, and those either a) become new triage tickets or b) updates tickets already in existence in backlog or triage state.

**Implication:** The new process mandates strict ordering: to-triage is always processed before triage-queue, and triage-queue is always processed before the backlog. Items in to-triage are consumed chronologically, with forward-looking items folded in and marked. Each to-triage item may fan out to zero, one, or multiple tickets in the project triage queues. P3+ priority items auto-promote to backlog state; lower-priority items remain in triage state until groomed or manually promoted.

### Refinement 2 (Nate 01:31Z) — rationale: iterative context accumulation[^discord-spec-rationale]

> This way when we keep talking about stuff, your final created ticket can get a comprehensive viewpoint of what's being asked even if we've iterated a couple times in context

**Implication:** The incremental fold-in approach is specifically designed for conversations where requirements evolve across multiple messages. Rather than creating a ticket from only the first message and losing later refinements, the process holds the item in to-triage until all related context has been folded in — so the final ticket reflects the full, iterated intent.

### Refinement 3 (Nate 01:32Z) — triage always runs in background[^discord-spec-background]

> the triage process _ALWAYS_ happens in the background though

**Implication:** No triage processing step (to-triage intake, to-triage → triage-queue, triage-queue → ticket state) should ever block the main session. All triage work must be dispatched via `run_in_background: true` (or equivalent cron/sub-agent mechanism) so Alex remains responsive to handler messages and other in-flight work.

### Refinement 4 (Nate 01:32Z) — alteration scope extends to todo and in_progress[^discord-spec-alteration]

> stuff in the project triage-queue can alter tickets in todo or in_progress with my approval

**Implication:** When processing the project triage-queue, if incoming items are related to a ticket already in `todo` or `in_progress` state, those tickets CAN be altered — but only with explicit handler (Nate) approval before the alteration is applied. This is not automatic; it requires a check-in.

### Refinement 5 (Nate 01:33Z) — acceptance criteria must accompany any alteration[^discord-spec-acceptance]

> but altering a ticket must also come with altering the acceptance criteria to account for the alteration as well

**Implication:** Any alteration to a ticket (whether in `triage`, `todo`, or `in_progress` state) must be accompanied by a corresponding update to that ticket's acceptance criteria. Altering scope or requirements without updating acceptance criteria is incomplete work. This applies to all ticket mutations triggered by the triage queue processing.

## Implications for current ticket body

The original "Phases" section above (Phase 1: drafts→to-triage, Phase 2: to-triage→GSD-N, Phase 3: MASTER.md update) described a one-time batch sweep in response to Nate's 01:08Z ask. The new spec (Refinements 1–5) replaces the ad-hoc phased model with a **canonical ongoing triage workflow**.

Specifically:

- The new spec is the standing process going forward, not just for this sweep.
- The "Phase 2" step (to-triage → GSD-N assignment) is now formalized as part of the to-triage → project-triage-queue step in the new spec.
- The "Phase 3" step (MASTER.md update) is downstream of the triage-queue → ticket state transitions in the new spec.
- The original Phases section remains for historical context of what the immediate ask was, but the new spec is the authoritative, repeatable workflow.
- The Acceptance criteria section above still applies to the immediate sweep that prompted this ticket; the new spec's Refinement 5 (AC must accompany any alteration) applies to all future ticket mutations.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508637831411662960

[^discord-spec-process]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643677935898826

[^discord-spec-rationale]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643791337422848

[^discord-spec-background]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508643891325304993

[^discord-spec-alteration]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508644006551093381

[^discord-spec-acceptance]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508644125807869962
