---
type: feature
id: GSD-52
legacy_ids:
  - "1779766960"
created: 2026-05-26T03:42:40Z
state: triage
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20"
    note: "missing — no originating task found; ticket created without ticket-first discipline (bad job — task should be filed retroactively)"
events:
  - {
      ts: 2026-05-28T02:01:38Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-52 (state=triage)",
    }
---

# GSD-52 — Task hierarchy blocking relaxation

## Original ask

> hmmm maybe instead of forcing one task in progress at a time, allow you to start another task if that task blocks the current one. Both can be in progress. The current task cannot move to completed until the one it is blocked by moves to completed. When starting the task that blocks the current one, the current task gets an update with why the pivot or sub-work. When a task that blocks another task is completed, remind the agent of any in-progress tasks that were blocked by that task, and suggest continuing work.

## Goal

Relax the one-task-in-progress constraint in task-utils so that an agent can pivot to a blocking sub-task without abandoning or fully suspending the parent task. Both tasks remain in-progress simultaneously; completion ordering is enforced by the blocking relationship. When the blocker resolves, the system surfaces the unblocked tasks and prompts the agent to resume.

## Example flow

1. Agent creates a task to update skill-utils with best practices and moves it to in-progress.
2. Agent discovers it needs to research skills first — creates a research sub-task.
3. Agent cannot make progress on skill-utils without the research, so it starts the research task (also in-progress). The skill-utils task gets an update noting the pivot and why.
4. Agent completes the research task. System reminds agent of the blocked skill-utils task and suggests resuming.
5. Agent resumes skill-utils work, now informed by the research.
6. skill-utils task cannot complete until the research task was completed (already done) — unblocked, agent completes it.

Key benefit: after compaction/session loss, the system can recall blocked tasks the agent may have forgotten and prompt resumption with context.

## Acceptance criteria

1. `task-utils` (or equivalent) allows multiple tasks in-progress when a blocking relationship exists between them.
2. Starting a task as a blocker of an in-progress task automatically records an update on the blocked task explaining the pivot.
3. Completing a task that blocks other tasks triggers a reminder listing those now-unblocked in-progress tasks, with a suggestion to continue work on each.
4. A task cannot be marked completed if it has an incomplete blocking dependency.
5. The blocking relationship and state are preserved across compaction/session restart (so the agent can be reminded even after context loss).

## Related

- task-utils plugin — primary implementation target
- GSD-37 (brain-utils / dreaming) — related self-correction mechanism; distinct scope
