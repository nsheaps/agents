---
type: feature
created: 2026-05-25T20:04:18Z
state: to-triage
project: GSD
priority: 4
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508561371275722812
  - id: blocks-ticket-updater-agents
    type: ticket
    url: ./1779737000-build-ticket-updater-agents-for-parallel-triage.md
events:
  - { ts: 2026-05-25T20:04:18Z, by: alex, change: "created from Discord ask[^discord-ask]" }
---

# task-utils: assign-on-launch + auto-handoff (one-task-at-a-time enhancement)

## Original Discord message

> we should also pull forward the task-utils one-task-at-a-time ticket to the front, and make sure the "not blocked by this" includes making something that can assign a task to an agent on launch rather than manual editing of the tasks so you can just call an agent and tell it to work on a task and hooks auto-assign it to that agent (and when the agent is done, the task is updated and moved back to pending?). Make that triage 1779737001 so it's done second.

Source: Discord msg[^discord-ask] (2026-05-25 20:04Z)

## Goal

Extend the `task-utils` plugin so launching an agent against a specific task auto-assigns it via hooks — no manual `TaskUpdate(owner=...)` call required. When the agent finishes (or its session ends), the task automatically updates back to `pending` (or `completed` if the work was successful).

## Why now

Currently the manual flow for sub-agent dispatch is:

1. Foreground agent creates the task (or finds an existing one).
2. Foreground agent calls `TaskUpdate(taskId, owner="<short-name>")` to claim it for the subagent.
3. Foreground agent dispatches the subagent.
4. Subagent does work, returns.
5. Foreground agent calls `TaskUpdate(taskId, status="completed")` (or back to pending if blocked).

That's 2 manual `TaskUpdate` calls per sub-agent dispatch — error-prone and verbose. With the ticket-updater-agents pattern from [`1779737000`][^blocks-ticket-updater-agents] launching many subagents in parallel, the friction multiplies.

## Requirements

- A way to dispatch an agent with `--task-id N` (or equivalent) that auto-claims the task via a SessionStart (or Agent-launch) hook.
- On agent exit (clean or error), the task's owner is cleared back to unassigned (so others can pick it up) OR the task is marked completed (if the agent reported success).
- The "one task at a time" invariant remains enforced — an agent can't be auto-assigned a task if it already has an in_progress one.
- Configurable per-agent or per-task: some flows want auto-completion on exit, others want manual confirmation.

## Acceptance criteria

- Launching an agent with a task-id reference results in that agent's task list showing the task as in_progress owned by the launched agent — with no manual TaskUpdate.
- Exiting the agent's session triggers the appropriate state transition automatically.
- The race condition where two agents could both claim the same task at near-simultaneous launches is prevented (atomic claim).
- Existing manual-claim flows still work (don't break what's there).

## Notes

- Adjacent to the existing 0-or-1 in_progress invariant in `require-task-in-progress.sh`.
- Integration point: the `Agent` tool dispatch path. Some hook would need to fire on agent launch to do the claim.
- See also: [`1779737000`][^blocks-ticket-updater-agents] which is blocked by this — ticket-updater agents will benefit hugely from auto-assign since they're meant to be many + short-lived.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508561371275722812

[^blocks-ticket-updater-agents]: ./1779737000-build-ticket-updater-agents-for-parallel-triage.md
