---
type: chore
id: GSD-41
legacy_ids:
  - "1779755956"
created: 2026-05-26T00:50:39Z
state: triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-611"
    note: "#611: AGENT(triager-v2): Process to-triage chronologically per new spec (14 items)"
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508633434082512946
  - id: discord-refinement
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508634642868207747
  - id: discord-delegate
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508634934321872988
  - id: discord-monitorid
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508635180137582703
  - id: discord-priority
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508635284189872219
  - id: discord-henrystart
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508635451253325976
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
  - {
      ts: 2026-05-26T01:00:00Z,
      by: alex,
      change: "appended Nate's 3 refinements 00:57Z+00:58Z×2 (monitor-id format, task-tracking-priority, agent-start-needs-validation)[^discord-monitorid][^discord-priority][^discord-henrystart]",
    }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-41 (state=triage) per triager-v2 workflow",
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

## Refinement 1 (Nate 00:55Z) — sharpened criteria[^discord-refinement]

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

**Implementation note:** sub-steps internal to an open ticket + routine housekeeping aren't "no task needed" — they're "delegate to a context:fork skill". The skill takes the task on behalf of the parent.

## Refinement 2 (Nate 00:56Z) — default delegation via context:fork[^discord-delegate]

> and to top it all off, most changes or things that require tasks, can and likely should be delegated to sub-agents via context:fork skills

**Default delegation pattern:** when work needs a Task (per refinement 1), the default execution path is `Skill(<some-skill>)` with `context: fork`.

When NOT to delegate:

- Single-tool-call atomic edits where dispatch overhead exceeds the work itself
- Work that requires tight back-and-forth with the parent's evolving context
- Work where the result MUST inform the very next parent action

**Implementation implication:** the forked-skill ticket-intake (GSD-32) is the canonical example of this pattern. Other change-actions should similarly grow forked-skill wrappers.

## Refinement 3 (Nate 00:57Z): MONITORING(<id>) prefix must be actual Monitor() task ID[^discord-monitorid]

> No, it should be a Monitor() and you track the ID of that, not the PR. The monitor monitors the PR

**Corrected convention:** `MONITORING(<task-id>)` where `<task-id>` is the actual `Monitor()` task ID, NOT a descriptive label. The Monitor IS what's monitoring the PR; the prefix names the Monitor, not its subject.

Workflow:

1. Arm a `Monitor()` with `persistent: true` watching for the relevant event
2. Capture the Monitor's task ID from the result
3. Use that ID as the `MONITORING(<id>)` prefix on the dependent Task

Backfill needed: every existing `MONITORING(<descriptive-label>)` task in TaskList should be re-evaluated.

## Refinement 4 (Nate 00:58Z): Task tracking = first priority[^discord-priority]

> task tracking should always be first priority. if your tasks are out of order, then my scatter brain is just gonna confuses us all

**Implication:** before any other work in a turn, task discipline check first:

- Is TaskList state accurate to reality (no stale `in_progress`, no missing tasks for in-flight work)?
- Is the next intended action's Task in_progress + correctly scoped?
- Are MONITORING/AGENT prefixes valid + IDs current?

## Refinement 5 (Nate 00:58Z): Even starting a peer agent needs a Task with validation steps[^discord-henrystart]

> for now, even starting henry should have a task with validation steps

**Implication:** task-discipline scope extends to peer-agent ops (tmux start/stop, restart, kill). Every such op needs:

- A pre-created Task BEFORE the action
- A `## Validation steps` section in the Task description that confirms expected post-state
- Status updates as validation proceeds

Concretely for "start henry":

- Task before `./bin/run-agent`
- Validation: tmux session exists → wait → capture-pane shows live claude prompt → Discord ping round-trip succeeds → state PASS
- If any step fails, task stays `in_progress` (or new sub-task) until resolved

## Acceptance criteria

- Documented criteria (in `project-tracking-workflow` skill or equivalent) for when a Task is required vs optional.
- Documented criteria for when a Ticket is required in addition to a Task.
- Documented MONITORING() prefix convention (actual Monitor task ID, not descriptive label).
- `task-invariant.sh` (or a new coach hook on TaskCreate) surfaces the criteria at creation time.
- forked-skill intake (GSD-32) and task-work-on-it skill (GSD-42) implement the delegation default.
- Backfill of existing MONITORING() tasks in alex's TaskList with real Monitor() IDs.

## Notes

- This ticket must land and be baked into tooling BEFORE the task-work-on-it skill (GSD-42) is dispatched, because task-work-on-it will self-manage Tasks using these criteria.
- The 5 refinements from Nate in 00:55Z–00:58Z constitute the authoritative criteria; the "first-cut" items above are proposals that still need Nate ack.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508633434082512946

[^discord-refinement]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508634642868207747

[^discord-delegate]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508634934321872988

[^discord-monitorid]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508635180137582703

[^discord-priority]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508635284189872219

[^discord-henrystart]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508635451253325976
