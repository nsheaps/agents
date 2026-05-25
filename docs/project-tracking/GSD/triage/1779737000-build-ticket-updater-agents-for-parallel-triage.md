---
type: feature
created: 2026-05-25T20:04:18Z
state: triage
project: GSD
priority: top-of-queue (epoch 1779737000 explicitly chosen to sort first)
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
  - { ts: 2026-05-25T21:00:00Z, by: alex, change: "moved to triage; ticket-updater agent file shipped in nsheaps/.ai-agent-alex@7567ab0; this very dispatch is the first real use" }
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

- **Meta-bootstrap:** The first real use of the ticket-updater agent is this very dispatch — the agent updating this ticket is itself the artifact being triaged. Self-referential but intentional.
- **Blocking relationship still holds:** The dependency on [`1779737001`][^blocked-by-task-utils-assign] (auto-assign on launch) remains active. Manual assignment is the current friction this ticket exists to remove; the ticket cannot be marked done until auto-assign-on-launch is implemented and removes the race condition class.
- **Acceptance criteria status:** Only the agent file ships as of `nsheaps/.ai-agent-alex@7567ab0`. The "parallelize" demo (3 concurrent agents, 3 independent commits) and the skill/scaffold for launching ticket-update agents are still TODO.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508561371275722812

[^blocked-by-task-utils-assign]: ./1779737001-task-utils-assign-on-launch-and-auto-handoff.md
