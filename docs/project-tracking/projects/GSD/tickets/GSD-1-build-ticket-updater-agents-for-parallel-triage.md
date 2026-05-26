---
type: feature
id: GSD-1
legacy_ids:
  - "1779737000"
created: 2026-05-25T20:04:18Z
state: in-progress
project: GSD
priority: 4
assignee: contacts://heaps-group/byGithubAppUrl/https://github.com/apps/alex-nsheaps
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508561371275722812
  - id: blocked-by-task-utils-assign
    type: ticket
    url: ./1779737001-task-utils-assign-on-launch-and-auto-handoff.md
events:
  - { ts: 2026-05-25T20:04:18Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-25T20:31:00Z,
      by: Agent(aeb7696f8486500de),
      change: "moved to triage; ticket-updater agent file shipped in nsheaps/.ai-agent-alex@7567ab0; first real dispatch",
    }
  - {
      ts: 2026-05-25T20:55:00Z,
      by: alex,
      change: "renumbered 1779737000 -> GSD-1; moved out of triage/ subfolder (state now in frontmatter only per Nate Discord 1508572570239242382)",
    }
  - {
      ts: 2026-05-25T21:30:00Z,
      by: alex,
      change: "advanced triage -> in-progress; ticket-updater agent used 6 times today (GSD-1 meta-bootstrap + M1-M5 milestone promotions); 2 follow-up gaps identified in Triage notes",
    }
---

# Build ticket-updater agents for parallel triage

## Original Discord message

> add a triage ticket right now for creating agents that can go do ticket updates and make that timestampped triage doc 1779737000 so it gets done first. The agents should be launched for each of these changes that you make, so you can quickly parallelize them.

Source: Discord msg[^discord-ask] (2026-05-25 20:04Z)

## Goal

Build a class of sub-agent that can be **launched per-ticket-change** so that Alex (or any orchestrator) can parallelize the work of moving tickets through their lifecycle: triage → in-progress → done, plus side updates (assignee changes, frontmatter edits, footnote-refs retro-application, etc.).

## Why now

Currently every ticket update is done by the foreground agent (Alex) sequentially. With ~17 tickets already in `to-triage/` and many more to come, sequential processing is slow + hogs the main context. A small sub-agent per change runs in seconds and frees the main loop to do other work.

## Requirements

- An agent can be launched against a single ticket file + a directive (e.g. "move to triage state", "update assignee to X", "add this acceptance criterion", "apply footnote-refs format").
- The agent reads only what it needs (the ticket + maybe the project's PROJECT.md for context); does not load MASTER.md or all of to-triage.
- The agent commits its change + reports the diff + commit SHA. Single-commit-per-change is the contract.
- Multiple agents can be launched in parallel (background mode) against different tickets without colliding on git locks (each agent does `git pull --rebase` before push).

## Acceptance criteria

- A skill (or scaffold) exists for launching a "ticket-update agent" with a minimal prompt + the target ticket path.
- An example dispatch from Alex to 3 ticket-update agents simultaneously demonstrates parallel execution + 3 independent commits.
- The pattern is documented + reusable for any future ticket-class work.

## Blocked by

- [`1779737001`][^blocked-by-task-utils-assign] — if launch-time auto-assign exists, the ticket-update agents don't need manual TaskUpdate calls to claim ownership, which removes a class of race conditions.

## Notes

- Closely related to the existing `AGENT(<name>):` sub-agent pattern (already in use for sonnet dispatch). This ticket is about formalizing it for ticket-CRUD specifically.
- Should integrate with the future `ticket-utils` plugin's CRUD skills once those exist.

## Triage notes

- **Meta-bootstrap:** First real use of the ticket-updater agent was the dispatch that moved this ticket to `triage` state (commit `60622b7`). Self-referential but intentional.
- **Today's usage (2026-05-25):** 6 dispatches total — 1 meta-bootstrap on this ticket + 5 milestone promotions (M1 `a83f32a`, M2 `8bb7e51`, M3+M5 bundled in `c2f2b6a`, M4 `ce7c37d`). All produced focused single-file commits per the agent contract; agent ships at `nsheaps/.ai-agent-alex@7567ab0`, contract updated `067b411`.
- **Remaining acceptance criteria (gaps tracked as follow-up tickets — TBD numbers):**
  - **Formal launch skill / scaffold** — currently the caller hand-writes the dispatch prompt each time. Needs e.g. `Skill(dispatch-ticket-updater)` that takes (target_ticket_path, directive) and renders the prompt with the contract boilerplate.
  - **Parallel-shared-workdir cross-bundling** — when 5 ticket-updaters dispatched in parallel against the same agents repo workdir, git rename detection absorbed M3's M3.md into M5's commit (`c2f2b6a`). Today's pivot: serial dispatch only. Long-term fix: worktree-per-subagent OR explicit serial-only mode in the agent contract.
- **Blocking relationship still holds:** The dependency on `1779737001`[^blocked-by-task-utils-assign] (auto-assign on launch) remains active. Auto-assign would remove the manual-claim race that this ticket exists to solve in the first place.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508561371275722812

[^blocked-by-task-utils-assign]: ./1779737001-task-utils-assign-on-launch-and-auto-handoff.md
