---
type: feature
id: GSD-47
legacy_ids:
  - "1779759524"
created: 2026-05-26T01:37:23Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508645192092221502
events:
  - {
      ts: 2026-05-26T01:37:23Z,
      by: alex,
      change: "filed from Discord ask[^discord-ask] per immediate-file-on-receive rule",
    }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-47 (state=triage) per triager-v2 workflow",
    }
---

# Move task-dispatch handshake+rename+un-assign sequence into hooks

## Original ask

> alex what are you doing bro, where are you getting that AGENT(spec-filer) syntax from, that's not what we discussed. doesn't task utils guide you to move a task to in-progress, launch the agent to do the task, and have the agent init handshake have the agent confirm that it will do that task, then you update the task name for the appropriate pattern, and continue the same sub-agent.
> Then you can start another task.
> When the sub-agent finishes, you must finish or pause the in_progress task before un-assigning the task from the sub-agent and then you can evaluate the outputs
>
> Lets add a p1 ticket to move this into hooks instead of describing it in the skill/rules. I'm sure this also has bits from our lovely scratch/arch-draft/initialize files

Source: Discord msg[^discord-ask] (2026-05-26 01:37Z)

## Goal

Enforce the canonical task-dispatch lifecycle via hooks (PreToolUse on TaskUpdate / Agent / TaskCreate) so the sequence is impossible to skip — instead of leaving it to the agent's discipline + skill/rule descriptions.

## Canonical sequence (per Nate 01:37Z)

1. **Task → in_progress** (existing `task-invariant.sh` already requires validation-steps block)
2. **Launch sub-agent** via `Agent(run_in_background: true, name: "<handle>")` — the agent is dispatched against the in_progress task
3. **Agent init handshake** — the sub-agent's first action MUST confirm: "yes, I will do task #<N>"; only then does dispatch complete
4. **Rename parent task** to `AGENT(<handle>): <original-subject>` AFTER the handshake confirms — not before
5. Now the orchestrator can start another task (parallel sub-agent work permitted via additional AGENT(...) tasks)
6. **On sub-agent return**: parent task MUST be moved to completed (or back to pending if paused) BEFORE the AGENT(<handle>) prefix is removed
7. **Then** evaluate sub-agent outputs (read summary file, verify artifacts)

## Why hooks (not skill/rules)

- Skill/rule text is advisory; gets skipped under pressure (the spec-filer dispatch this session is the exact failure mode — agent pre-named the task before handshake)
- Hooks are enforcement: PreToolUse blocks the wrong-order action, agent sees error, agent must follow the correct sequence
- Same pattern as `task-invariant.sh` (which enforces 0/1 in_progress invariant) and `require-task-in-progress.sh` (which gates Write/Edit on a Task being in_progress)

## Adjacent bits to consolidate (per Nate's note)

Nate flagged that "this also has bits from our lovely scratch/arch-draft/initialize files". Files to scan + consolidate:

- `nsheaps/.ai-agent-alex/.claude/scratch/*` — any dispatch-pattern notes
- `nsheaps/agents/docs/architecture/ARCHITECTURE_DRAFT.md` (if present) — initial task-utils design
- `nsheaps/agents/docs/intake/project-setup.md` — bootstrap workflow
- `nsheaps/agents/plugins/claude-code/task-utils/skills/manage-tasks/SKILL.md` — current doctrine text
- `nsheaps/.ai-agent-alex/.claude/skills/manage-tasks*/SKILL.md` — Alex's local variant
- `nsheaps/.ai-agent-alex/.claude/rules/work-tracking.md` (and adjacent rules)

## Acceptance criteria

- PreToolUse hook on `Agent` (or wrapper skill) enforces handshake-before-rename — agent dispatch is rejected if the parent task is named with AGENT(...) prefix BEFORE the handshake completes
- PreToolUse hook on `TaskUpdate` rejects removing the AGENT(...) prefix while the parent task is still `in_progress` (must complete/pause first)
- A handshake mechanism exists — likely the sub-agent's first SendMessage back to parent OR an explicit "claim" tool — that the orchestrator can verify before renaming
- All adjacent doc/scratch/skill descriptions of this pattern are either deleted or replaced with a one-liner pointer to the hook
- The hook fires correctly in the existing `task-invariant.sh` chain (no double-blocks, no contradictions)

## Open questions

- What IS the handshake artifact? SendMessage back to parent? A new tool? A specific TaskUpdate from the sub-agent?
- Does this also apply to inline `Skill()` invocations (which run in `context: fork` sub-agents), or only `Agent()` dispatches?
- How does the un-assign step work mechanically — is it a TaskUpdate that removes the `AGENT(...)` prefix from `subject`, or a metadata field?

## Notes

- This ticket exists because skill/rule guidance was demonstrably insufficient: in this very session (2026-05-26 01:31-01:37Z) the orchestrator dispatched `spec-filer` with the AGENT(...) prefix already in place, skipping the handshake step entirely.
- Behavior-changing: once hooks land, every subsequent sub-agent dispatch enforces the canonical sequence — so this ticket must be worked early (P1).
- Related to GSD-33 (task-utils auto-assign on launch) — both touch the task lifecycle at sub-agent dispatch time. GSD-33 is about auto-assignment via hooks; this ticket is about handshake enforcement.
- Related to GSD-43 (task-work-on-it skill) — that skill WILL need to comply with the handshake sequence once this hook exists.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508645192092221502
