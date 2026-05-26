---
type: feature
id: GSD-43
legacy_ids:
  - "1779755970"
created: 2026-05-26T01:02:31Z
state: triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508636419617194044
events:
  - { ts: 2026-05-26T01:02:31Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-43 (state=triage) per triager-v2 workflow",
    }
---

# task-work-on-it skill (forked, executes atomic task work end-to-end)

## Original ask

> we probably should have a task-work-on-it skill (p0). (with context:fork too? not sure, if the skill returns and it just has some output but not all of the tool calls and such, the agent might still have to look through transcripts (if the code and PR and commits and outputs aren't good enough, and outputs can be improved over time by better prompting), so forking might hurt? who knows.... maybe...lets start with yes lets fork but keep a topic list for journaling that you keep updated that when you journal without a topic you think about those topics too (and capture the other topics we've talked about so far)) Maybe those skills can have hooks that auto manage task state to remove something from your needs

Source: Discord msg[^discord-ask] (2026-05-26 01:00Z)

## Goal

A skill that takes a pending Task ID, executes the atomic work for it end-to-end, updates task state, commits/pushes if relevant, and auto-manages the task lifecycle so the orchestrator doesn't need to issue manual `TaskUpdate` calls.

## Design decisions

### Fork question (Nate's lean: start with yes, fork)

- `context: fork` isolates parent's context but loses tool-call/intermediate-output visibility.
- If skill's final output + git artifacts (PR, commits) aren't sufficient, parent has to grep transcripts to recover.
- Nate's position: "start with yes lets fork" — accept the trade-off, improve output quality over time via better prompting.
- Revisit if transcript-grep-to-recover becomes a common pain pattern.

### Task lifecycle hooks

- Skill emits TaskStart/TaskComplete lifecycle events (via `TaskUpdate`) so parent doesn't have to.
- Eliminates parent context bloat from per-step task ops (`TaskCreate`/`TaskUpdate`/`TaskGet` chatter).
- Complements the task-dispatch handshake hook (GSD-46) — both reduce manual task state management.

### Companion skills

- Ticket-intake skill (GSD-32) — handles intake of new tickets (parallel workflow).
- Journaling topic-list skill (GSD-44) — spawned from the same Discord message; not part of this skill's scope.

## Acceptance criteria

- Skill exists at an appropriate location (project or plugin level).
- Invoking `Skill(task-work-on-it, task_id=<N>)` results in the task being claimed, worked on, and completed (or paused with reason) without manual parent intervention.
- Task state transitions (pending → in_progress → completed/pending) are handled inside the skill.
- The skill's final output includes sufficient artifact links (PR URL, commit SHA, summary) for the parent to evaluate success without grepping transcripts.
- The skill uses `context: fork` (initial implementation; revisit if recover-via-transcript becomes a pain).

## Notes

- This is P0 because once it exists, the orchestrator can dispatch most work as `Skill(task-work-on-it, task_id=N)` and stay lean — huge context savings.
- Depends on GSD-41 (task vs ticket criteria) being landed first so the skill can self-classify whether a new Ticket is also needed.
- Related to GSD-46 (task-dispatch handshake hook) — both are about enforcing lifecycle discipline; this is the skill-layer, that is the hook-layer.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508636419617194044
