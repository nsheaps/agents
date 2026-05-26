---
type: feature
created: 2026-05-26T01:02:31Z
state: to-triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508636419617194044
events:
  - { ts: 2026-05-26T01:02:31Z, by: alex, change: "created from Discord ask[^discord-ask]" }
---

# task-work-on-it skill (forked, executes atomic task work end-to-end)

## Original Discord message

> we probably should have a task-work-on-it skill (p0). (with context:fork too? not sure, if the skill returns and it just has some output but not all of the tool calls and such, the agent might still have to look through transcripts (if the code and PR and commits and outputs aren't good enough, and outputs can be improved over time by better prompting), so forking might hurt? who knows.... maybe...lets start with yes lets fork but keep a topic list for journaling that you keep updated that when you journal without a topic you think about those topics too (and capture the other topics we've talked about so far))  Maybe those skills can have hooks that auto manage task state to remove something from your needs

Source: Discord msg[^discord-ask] (2026-05-26 01:00Z)

## Triage notes

- Skill that takes a pending Task ID, executes the atomic work for it, updates state, commits/pushes if relevant.
- **Fork question (Nate uncertain)**: `context:fork` = isolates parent's context but loses tool-call/intermediate-output visibility. If skill's final output + git artifacts (PR, commits) aren't enough, parent has to grep transcripts to recover. Nate's lean: "start with yes lets fork" — accept the trade-off, improve output quality over time via better prompting.
- **Hooks to auto-manage task state**: lifecycle hooks (TaskStart/TaskComplete) that the skill emits so parent doesn't have to `TaskUpdate` manually.
- Eliminates parent context bloat from per-step task ops (`TaskCreate`/`TaskUpdate`/`TaskGet` chatter).
- Companion to ticket-intake skill ([to-triage/1779755955](./1779755955-forked-skill-ticket-intake.md)).

[^discord-ask]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508636419617194044>
