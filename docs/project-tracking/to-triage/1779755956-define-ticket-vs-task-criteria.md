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
  - {
      ts: 2026-05-26T00:50:39Z,
      by: alex,
      change: "filed from Discord ask[^discord-ask] per immediate-file-on-receive rule",
    }
  - {
      ts: 2026-05-26T00:55:27Z,
      by: alex,
      change: "appended Nate's refined criteria[^discord-refinement]",
    }
  - {
      ts: 2026-05-26T00:56:37Z,
      by: alex,
      change: "appended Nate's delegation-preference refinement[^discord-delegate]",
    }
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

## Refinement (Nate 00:55Z)

Per Discord [1508634642868207747](https://discord.com/channels/1490863845252665415/1497431286661517353/1508634642868207747)[^discord-refinement]:

> Sub-steps internal to an open ticket [and] Routine housekeeping — should be covered by skill with context:fork, so in essence those are being delegated to a sub-agent. In reality we should say that calling Skill() and Read() and those other trivial things are always allowed, but any CHANGES require a Task. If it's a single char change on a repo with PR restrictions, it might seem like a reactive trivial fix but it has to go through PR review too unfortunately. Rules be rules. So really unless its chatting, searching (and writing notes, but not significant research), and other read-like actions like skills, then it probably needs a task. it might be quick. it might seem useless. but a change is a change.

**Sharpened criteria:**

**NO Task needed (read-like / chat / search):**
- `Skill()` invocations (delegated to sub-agent context via `context: fork`)
- `Read()` and other read-only file inspections
- `Grep`/`Glob` searches
- Discord/Telegram chat replies that don't change state
- Note-writing (scratch, journal drafts) where it's NOT significant research

**Task REQUIRED (any change):**
- ANY file write/edit/delete (even single-char) — change is a change
- ANY git operation that mutates state (commit, push, merge, branch, etc.)
- ANY config edit (settings.json, plugin config, env var change)
- ANY hook/skill/agent definition change (these are also behavior-changing → task immediately + worked immediately)
- ANY sub-agent dispatch that performs writes

**Ticket REQUIRED (in addition to Task) — first-cut from initial filing, still pending Nate ack:**
- Anything with a deliverable (PR, doc, skill, plugin)
- Anything multi-step
- Anything behavior-changing
- Anything someone else might pick up / Nate might ask status on

**Implementation note:** sub-steps internal to an open ticket + routine housekeeping aren't "no task needed" — they're "delegate to a context:fork skill". The skill takes the task on behalf of the parent. So the parent still has ONE in_progress task (the parent's main work) and the skill's own task lives in the forked context.

## Refinement 2 (Nate 00:56Z)

Per Discord [1508634934321872988](https://discord.com/channels/1490863845252665415/1497431286661517353/1508634934321872988)[^discord-delegate]:

> and to top it all off, most changes or things that require tasks, can and likely should be delegated to sub-agents via context:fork skills

**Default delegation pattern:** when work needs a Task (per refinement 1), the default execution path is `Skill(<some-skill>)` with `context: fork` — the skill body becomes the sub-agent. The parent agent stays focused on the higher-level orchestration; the sub-agent owns the implementation work (and its own task discipline within the fork).

When NOT to delegate:
- Single-tool-call atomic edits where dispatch overhead exceeds the work itself
- Work that requires tight back-and-forth with the parent's evolving context
- Work where the result MUST inform the very next parent action (use foreground sub-agent if delegating; otherwise inline)

**Implementation implication:** the forked-skill ticket-intake ([1779755955](./1779755955-forked-skill-ticket-intake.md)) is the canonical example of this pattern. Other change-actions (file-write tickets, plugin edits, settings tweaks) should similarly grow forked-skill wrappers so the default path is delegation, not inline execution.

## Footnote references

[^discord-ask]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508633434082512946>
[^discord-refinement]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508634642868207747>
[^discord-delegate]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508634934321872988>
