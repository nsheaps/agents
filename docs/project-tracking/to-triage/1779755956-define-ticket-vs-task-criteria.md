---
type: chore
created: 2026-05-26T00:50:39Z
state: to-triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508633434082512946
events:
  - { ts: 2026-05-26T00:50:39Z, by: alex, change: "filed from Discord ask[^discord-ask] per immediate-file-on-receive rule" }
---

# Define criteria: ALL work in Tasks; MOST work also in Tickets — what's "most"?

## Original ask

> ALL work in Tasks. MOST work (define the criteria please) should also be in Tickets.
>
> — Nate Discord [1508633434082512946](https://discord.com/channels/1490863845252665415/1497431286661517353/1508633434082512946) (2026-05-26 00:50:39Z)

Preceded by:

> your tasks look wrong, it seems like you're not updating them.
>
> even if your tasks aren't backed by a ticket, I still expect you to track your work there

— Discord [1508633169799413840](https://discord.com/channels/1490863845252665415/1497431286661517353/1508633169799413840) + [1508633250531250296](https://discord.com/channels/1490863845252665415/1497431286661517353/1508633250531250296)

## Triage notes

- **Hard rule (no criteria needed)**: ALL work → TaskList. Every unit of work I'm doing or about to do gets a Task. No exceptions.
- **Criteria question**: when does that work ALSO need a ticket (GSD-N or to-triage/drafts entry)?
  - **Probably ticket-worthy** (first cut): anything with a deliverable (PR, new doc, new skill, plugin), anything multi-step (>3 atomic steps), anything behavior-changing (hooks/rules/skills/agent behavior), anything someone else could pick up, anything Nate would later ask "status of X" about
  - **Probably task-only** (first cut): single-tool-call actions (one Discord reply, one read), reactive trivial fixes (typo, broken link), sub-steps internal to an open ticket (tracked via ticket plan + Tasks), routine housekeeping (cron tick, status refresh)
- Once criteria land: bake into `project-tracking-workflow` skill + `task-utils` plugin's task-create coach (`task-invariant.sh`) so the wrong choice surfaces at TaskCreate time
- Land alongside the ticket-intake forked skill (separate to-triage ticket) so the intake skill auto-routes per these criteria

## Footnote references

[^discord-ask]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508633434082512946>
