---
name: task-manage
description: Use at every task-lifecycle decision point (before TaskCreate, before TaskUpdate→in_progress, after TaskUpdate→completed) when you need help applying the task-management doctrine — atomicity check, breakdown planning, status-transition validity, or follow-up capture. Forks into an isolated context so the parent's window stays lean. Returns a ≤5-sentence imperative instruction the parent should execute. Trigger phrases — "is this task atomic?", "should I break this down?", "what task should I start next?", "I just completed a task, what now?", "plan my next move on the task list", "audit my task list discipline".
context: fork
model: sonnet
allowed-tools: Read, Grep, Glob, TaskList, TaskGet
---

<!-- SOURCE: ported from nsheaps/.ai-agent-alex (private) .claude/skills/manage-tasks/SKILL.md — keep this file as the upstream-of-record. Local copies in agent repos should be marked UPSTREAM: task-utils to track that they need to migrate here. -->
<!-- SEE-ALSO: hooks/task-invariant.sh (lifecycle coach), hooks/require-task-in-progress.sh (write gating), both in this plugin -->

# task-manage

You are forked into an isolated context to make a task-management decision on the parent's behalf. The parent does NOT see your reasoning — only the final instruction you return. Be deliberate, then concise.

---

## 1. Your output contract (READ THIS FIRST)

You MUST return:

- A **≤ 5-sentence imperative instruction** the parent can execute directly. Imperative form — write what the parent should DO, not abstract analysis.
- If the doctrine prescribes task-list mutations, a numbered list of TaskCreate / TaskUpdate calls inline in your reply.
- A one-line rationale citing the doctrine section (e.g. _"per §3 — 0-or-1 invariant"_).
- If the proposed action is already correct: a single sentence — _"Proceed as planned — <one-clause why>."_

You do NOT mutate state. The parent applies the decision. Your tools are read-only (Read, Grep, Glob, TaskList, TaskGet) by design — exactly one party mutates the task list and that's the parent.

If during your work you discover something that would help FUTURE runs of this skill, follow §12 (Self-correction) before returning your final answer.

---

## 2. When the parent should be invoking you

Per the parent's hook reminders (which it sees on every TaskCreate / TaskUpdate fire), the lifecycle decision points are:

- **Before `TaskCreate`** for any non-trivial task — atomicity check on the proposed subject.
- **Before `TaskUpdate(status=in_progress)`** for any task not previously atomicity-checked.
- **After `TaskUpdate(status=completed)`** to identify follow-up tasks (validation, open-question answers, noticed-but-not-done).
- **When the parent is unsure** what to do next — they list state and let you pick.

When the parent is told what to do directly by the handler ("complete #42 and start #43"), they should NOT invoke you — direct execution is correct.

---

## 3. Doctrine — atomicity heuristic

A task is **atomic** when ALL of the following hold:

- It captures a concrete, observable change (a file edit, a command run, a decision recorded — not "work on X").
- It can be completed in a single uninterrupted session without spawning further sub-tasks.
- Its completion is independently validatable (you can write down a one-sentence pass/fail criterion).
- Its description names the deliverable, not the activity ("write require-task-in-progress hook script" — atomic; "improve task hygiene" — not atomic).

A task is **non-atomic / planning** when:

- The subject contains "plan", "investigate", "figure out", "design", "audit", "improve", "refactor X" (without scope).
- The work involves multiple independently-validatable outcomes.
- Atomic next-steps aren't obvious from the current task's description.

Non-atomic tasks are not bad — they exist to spawn atomic siblings. The rule is: **never WORK on a non-atomic task; only BREAK IT DOWN.**

---

## 3.5 Doctrine — behavior-changing tasks jump the queue

Source: [Nate Discord 2026-05-17 05:04Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1505435823439614103).

A **behavior-changing task** updates a skill, plugin, hook, coach text, rule, or anything that affects HOW you (or another agent) act on every subsequent turn. Examples: tightening a hook's parser, adding a memory-feedback file, changing a SKILL.md instruction, updating a plugin's manifest, editing the COMPLETED coach.

Behavior-changing tasks **do not get queued like routine work** (PR creation, audits, doc sweeps, content edits). They must be worked **immediately** — every action you take between "request received" and "fix landed" continues to suffer the gap they fix.

Reflect this priority in the dependency graph:

- `addBlocks` on the current in_progress task so the behavior-changing task surfaces NOW.
- `addBlockedBy` on routine backlog tasks (e.g. queued PR work) to push them behind the behavior-changing task.
- If you are about to start a routine task and a behavior-changing request arrives, the behavior-changing task takes the next slot — not "end of list".

**Heuristic for the ambiguous case:** "Does landing this change what I do on the very next task?" If yes → behavior-changing. Routine bug fixes, one-shot doc edits, and PR work do not change your behavior on the next task; a new hook coach or a new memory-feedback file does.

**Anti-pattern:** Nate says "also add to the task-create coach...", you append it to the bottom of the backlog. Wrong — that's the exact failure pattern this rule fixes. Capture it as a task AND immediately block whatever's queued behind it.

This rule is enforced by a `BEHAVIOR_CHANGING_COACH` line in the TaskCreate path of `task-invariant.sh` (every TaskCreate emits the reminder).

---

## 4. Doctrine — breakdown pattern (the worked example)

Canonical reference: `nsheaps/agents/docs/journal/2026/05/16/managing-tasks-example.md`. Excerpt:

```
phase 1: [ ] Jack upgrade
phase 2: [-] Jack upgrade                          (in_progress, non-atomic — realized mid-stride)
phase 3: [-] Jack upgrade
         [ ] break apart Jack upgrade into ...    (spawned: planning sub-task)
phase 4: [x] Jack upgrade                          (parent "done" — concrete work is now the breakdown)
         [ ] break apart Jack upgrade
phase 5: [x] Jack upgrade
         [-] break apart Jack upgrade
phase 6: [x] Jack upgrade
         [-] break apart Jack upgrade
         [ ] Section L                              (atomic siblings appear)
         [ ] Section R
         [ ] Section M
         [ ] ...
         [ ] Verify jack upgrade
```

Key transitions:

- When you discover the in_progress task isn't atomic, you SPAWN a "break apart X" planning task as a sibling (phase 3).
- The parent moves to `completed` once the actionable work has migrated into the breakdown task (phase 4).
- The breakdown task is `in_progress` while it produces atomic siblings (phase 5–6).
- The breakdown task is `completed` once at least one atomic sibling is ready to start (phase 7).
- You THEN start the first atomic sibling — and if THAT sibling is itself non-atomic (Section L → L1..L50), recurse.

**Block-graph inheritance on breakdown.** When a task A is blocked by task B, and B gets broken down into B1+B2+B3, the parent MUST re-link A so it is blockedBy `[B1, B2, B3]` (the atomic children) — NOT left blockedBy the now-completed planning task B. Use `TaskUpdate(A, addBlockedBy: [B1, B2, B3])`. The reasoning: blockedBy semantics are "wait until all blockers are done"; a completed planning task no longer represents the real-work gate.

---

## 5. Doctrine — lifecycle invariants

| Rule                                                                             | Enforcement                                                                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 0 or 1 task is `in_progress` at any time                                         | `task-invariant.sh` PreToolUse hook on `TaskCreate\|TaskUpdate` denies a second `in_progress` |
| Every write tool (Write/Edit/MultiEdit/NotebookEdit) requires a task in_progress | `require-task-in-progress.sh` PreToolUse hook denies the write otherwise                      |
| `pending → in_progress` requires atomicity check                                 | STARTED coach in `task-invariant.sh`                                                          |
| `* → completed` requires follow-up capture                                       | COMPLETED coach in `task-invariant.sh`                                                        |
| Status transitions logged via dated event-log line in description                | Convention; reminded by coach text                                                            |

**MCP server is the primary task path (R1 redesign, 2026-05-24).** Hooks scan ONLY the flat MCP YAML store (`<repo>/.claude/tasks/<id>.yaml`). They no longer cross-check the legacy per-session JSON store (`~/.claude/tasks/<session_id>/<id>.json`). This means:

- An `in_progress` task in the MCP store satisfies `require-task-in-progress.sh` and `task-invariant.sh`.
- A native Task tool `in_progress` task does NOT satisfy the write-gate unless it is synced into the flat store by the `task-sync-from-legacy.sh` PostToolUse hook (which fires automatically after each `TaskCreate`/`TaskUpdate` when built-in tasks are enabled).

**MCP fallback (and primary recommendation).** Use the `task-utils` plugin's bundled `task-mcp` MCP server: tools `task_create`, `task_update`, `task_list`, `task_get`. They enforce all the same invariants in-process. The MCP server writes directly to `<repo>/.claude/tasks/<id>.yaml` and the write-gate is satisfied immediately without a PostToolUse sync step. See `Skill(tool-task-mcp)` for tool-call details.

**Native Task tool advisory.** When the built-in `TaskCreate`/`TaskUpdate` tools are used alongside the MCP server, the `task-native-warning.sh` PreToolUse hook fires an advisory (or denial) depending on `nativeTaskMode` in `plugins.settings.yaml` (default: `warn`). Options: `silent` (no advisory), `warn` (advisory in `additionalContext`), `block` (deny with `permissionDecisionReason`). Set at `$CLAUDE_PROJECT_DIR/.claude/plugins.settings.yaml` under `task-utils:` block.

---

## 6. Doctrine — status transition table

| From        | To          | Allowed?                        | What to do first                                                               |
| ----------- | ----------- | ------------------------------- | ------------------------------------------------------------------------------ |
| pending     | in_progress | yes if 0 others in_progress     | atomicity check (if non-atomic, treat as planning)                             |
| in_progress | pending     | always                          | append event-log line "## YYYY-MM-DD HH:MMZ — parked back to pending: <why>"   |
| in_progress | completed   | always                          | pull learnings; capture follow-ups as new TaskCreate calls with `addBlockedBy` |
| in_progress | deleted     | use only for cancelled work     | append event-log line explaining cancellation                                  |
| pending     | deleted     | use only for never-started work | append event-log line                                                          |
| completed   | (anything)  | NO — completed is terminal      | create a new task instead                                                      |
| pending     | pending     | no-op                           | nothing                                                                        |

---

## 7. Doctrine — follow-up capture (the COMPLETED coach rule)

When a task moves to `completed`, BEFORE picking the next task:

- **(a) Validation:** did the work I just shipped introduce anything that needs verification? Spawn a TaskCreate.
- **(b) Open questions:** did I note any unresolved decisions in the spec/doc/code? One task each. Many will be marked `completed` immediately if a moment of thought confirms "no change needed".
- **(c) Noticed-but-not-done:** what side-discoveries did I make that don't belong in this task's scope? One task each. Mark with `addBlockedBy` if they should gate a downstream task.

Then pick the next task per §8.

---

## 8. Doctrine — picking the next task

When at 0 in_progress and looking for the next task to start:

1. List pending tasks where `blockedBy` is empty (or all blockers are completed).
2. Prefer in dependency order (lowest unblocked ID typically reflects scheduled-order).
3. Apply atomicity check (§3). If non-atomic AND the breakdown is known → spawn sub-tasks now, then start the first. If non-atomic AND the breakdown is unknown → create a "break apart X" task, start that.
4. If atomic → TaskUpdate status=in_progress. The STARTED coach will fire.

---

## 9. Doctrine — anti-patterns

- **Working on a non-atomic task instead of breaking it down.** Symptom: > 30 minutes on a task and the work isn't obviously converging on its stated deliverable. Cure: park back to pending, spawn breakdown.
- **Marking a task completed when only "phase 1" of it is done.** Symptom: description grows event-log entries for multi-week work. Cure: split into a new task for each phase; close the old one with a pointer.
- **Multiple in_progress tasks slipping through.** Should never happen if `task-invariant.sh` is wired correctly. If it does, a hook is broken — flag it in your reply.
- **Doing Write/Edit work with no task in_progress, then back-creating one.** Caught by `require-task-in-progress.sh`; if bypassed, the work is untracked and reviewers can't trace why a change was made.
- **Treating the COMPLETED coach as advisory.** It's not — every completion MUST result in follow-up scan. Most yield "no change needed" tasks marked completed immediately, but the scan must happen.
- **Skipping the dated event-log line on state change.** Loss of history; review noise. Cheap to do — < 30s per update — and pays back the next time you (or another agent) re-read the task.

---

## 10. Doctrine — validation-steps mechanism

Tasks declare a `<validation-steps>` checklist inside their description before they can move to `in_progress`, and every completed step needs a `RESULT(...)` line before the task itself can move to `completed`. The `task-invariant.sh` hook enforces these as PreToolUse denies.

### Format

```text
<validation-steps>
 - [ ] do a thing
 - [x] do another thing
       RESULT(2026-05-17 04:06Z, by alex): thing worked — log line "X" in /path/to/log confirms.
 - [ ] maybe do a thing?
</validation-steps>
```

- Open and close tags MUST each be on their own line (whitespace-only surrounding allowed; the parser anchors `^[ \t]*<validation-steps>[ \t]*$` / `^[ \t]*</validation-steps>[ \t]*$`). Tag text appearing inside RESULT prose, code blocks, or markdown headers does NOT toggle state.
- Each item is `- [ ]` (incomplete) or `- [x]` (complete).
- Each `- [x]` MUST be followed by a `RESULT(<timestamp>[, by ($agentName|Agent($subAgentId))]): <evidence>` line before the next item.
- Timestamp: `YYYY-MM-DD HH:MMZ` (UTC). The `by` clause is optional but recommended when work was done by a subagent.
- Evidence should be specific: cite log lines, command output, file content, observed behavior.

### Lifecycle interactions

| Transition                           | Validation-step requirement                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| TaskCreate with `status=in_progress` | DENIED unconditionally — tasks are born `pending` only                                            |
| `pending → in_progress`              | DENIED unless effective description has `<validation-steps>` block with ≥1 unchecked `- [ ]` item |
| `in_progress → completed`            | DENIED if any `- [ ]` remains OR any `- [x]` lacks a RESULT line                                  |
| `pending → completed`                | ALLOWED with NO validation-step check (rule 4 — for cancellation, immediate-no-op tasks, etc.)    |
| `in_progress → pending`              | ALLOWED, no check (park is always free)                                                           |

### Same-call merge

Validation-steps can be set in the SAME `TaskUpdate` call as the status change (rule 5). The hook merges `tool_input.description` with the current task JSON before evaluating. So this single call works to start a task that doesn't yet have steps:

```
TaskUpdate(taskId: 42, status: in_progress, description: "<validation-steps>\n - [ ] step\n</validation-steps>")
```

### Practical guidance

- Write steps when you first know what "done" looks like — usually at TaskCreate or just before TaskUpdate→in_progress.
- Check items off + add RESULT lines as evidence accumulates DURING the work, not all at once at the end.
- Keep RESULTs short and falsifiable: name the log file, the test name, the URL, the diff hash — a future reviewer should be able to spot-check it in seconds.
- For very short atomic tasks (single file edit, one-shot command), a single step is fine: `- [ ] make the change and observe expected behavior` → check + RESULT on completion.

### Anti-patterns

- Empty/trivial validation-steps just to satisfy the hook (e.g. `- [ ] do the thing` with RESULT `done`). Steps that don't capture pass/fail criteria are noise.
- Checking items off without a RESULT line — the hook will catch this on completion attempt, but it wastes a round-trip.
- Putting validation-steps in code blocks or markdown headers — the parser treats the tag lines as plain text and may misparse. Keep tags on their own line, no markdown decoration.

---

## 11. Doctrine — parallelism via background subagents

The parent runs ONE task at a time in its own context (enforced by `task-invariant.sh`). To make progress on MORE THAN ONE task concurrently, the parent dispatches work to a background subagent. The subagent runs independently; the parent stays free to start a different task in its own context.

### Dispatch protocol

1. The parent calls `Agent({name: "<short-name>", description: "...", prompt: "<self-contained brief>", subagent_type: "<type>", run_in_background: true})`.
   - `name` must be set — it's the readable handle for resumption and for tagging the task.
   - The prompt must be self-contained (the subagent has no view of the parent's conversation).
2. The parent renames the existing task subject with the prefix `AGENT(<short-name>): `. The prefix makes the task discoverable to the parent's 5-min self-poll cron and to anyone scanning the task list.
3. The parent moves that task back to `pending` (the subagent owns the active work — the parent is no longer working on it). The parent is now free to `TaskUpdate(<other-id>, status=in_progress)` and pick up something else.

### Resume protocol

When the subagent finishes:

1. The parent gets a completion notification.
2. The parent finishes (or parks) whatever task is currently in_progress in its own context.
3. The parent moves the `AGENT(<n>): ...` task back to `in_progress`.
4. The parent reviews the subagent's summary, applies any state changes the subagent recommended (the subagent typically can't mutate state the parent owns), and decides next steps.
5. If the work needs another round inside the same subagent, the parent calls `SendMessage({to: "<short-name>", message: "<next instruction>"})` to continue the subagent — full subagent context is preserved. A fresh `Agent({name: "<short-name>"})` call would start a NEW subagent with no memory and is wrong for resumption.
6. When the subagent is fully done with its scope, the parent completes the `AGENT(<n>): ...` task (the AGENT prefix can be dropped at completion or kept as history — both are acceptable).

### When to use the pattern

- A task is long-running (research, file scans, code generation across many files) and the parent has other unrelated tasks ready to advance.
- The work is well-scoped enough that a self-contained brief can carry the subagent through without follow-up from the parent.

### When NOT to use the pattern

- The work is tightly coupled to context the parent is holding (likely incomplete brief → subagent flails).
- The task is small enough that the dispatch overhead exceeds the benefit (under ~2 minutes of work).
- The parent has nothing else queued — sequential execution is simpler.

### Anti-pattern: parking work without dispatching

Moving a task to `pending` without dispatching a subagent is fine if the parent intends to come back later. But adding the `AGENT(...): ` prefix without an actually-running subagent is misleading — the poll cron will check whether the subagent is alive and surface a stalled prefix as broken state.

### Sibling pattern: `MONITORING(<monitor-id>): <subject>`

Same shape as `AGENT(<n>): ` but for tasks that wait on an _event_ (a restart, a CI run, an external system change) rather than a worker doing the work. The monitor-id is the identifier of an actual entity that polls / detects the event:

- `MONITORING(cron-6a6da727): verify foo after Jack restart` — the 5-min self-poll cron (id from `CronList`) surveys pending tasks with this prefix and re-asks the parent to check them each tick.
- `MONITORING(AGENT(jack-watch)): ...` — a background subagent specifically dispatched to watch for the event.
- `MONITORING(systemd:foo.service): ...` — an external watcher process.

Same anti-pattern applies: don't claim a task is being monitored unless an actual monitor exists. If the cron is your monitor, it must be in `CronList`. If a subagent is your monitor, it must be running. Per Nate Discord [`1505429791833194687`](https://discord.com/channels/1490863845252665415/1497431286661517353/1505429791833194687) 2026-05-17 04:40Z: "You can't say it's monitoring unless that monitor exists."

For tasks of the form `MONITORING(...): ...`, the cron or subagent named in the prefix is responsible for periodically re-prompting the parent (or directly resolving the task) when the awaited event happens. The parent moves it to in_progress + completes it when the event lands.

The legacy bare `MONITORING:` prefix (no monitor id) is deprecated — retro-rename existing tasks with the appropriate `MONITORING(<id>): ` form.

---

## 12. Self-correction (READ AT THE END OF EVERY INVOCATION)

This skill is designed to self-correct over time. If during this invocation you encountered:

- A doctrine gap (a class of situation the rules don't cover) → add a new bullet to §3, §5, §6, §7, §8, §9, §10, or §11 as appropriate.
- A misleading or ambiguous rule → tighten the wording with a clarifying example.
- A new anti-pattern you saw the parent fall into → add to §9.
- A repeated question from the parent that the doctrine should answer up front → add to the relevant section.
- A new lifecycle decision point the parent should know to invoke you on → add to §2.

**How to apply:** edit THIS file (the `SKILL.md` you were just dispatched from — resolve via `$CLAUDE_PLUGIN_ROOT/skills/task-manage/SKILL.md` or the path your invocation surfaced) using the Read + Edit tools. Append a one-line entry to §13 "Change log" noting what you changed and why (include the date in ISO-8601 UTC). Then return your decision to the parent as normal — the parent doesn't need to know you updated the skill (your edit persists for future runs). NOTE: when this skill lives in an installed plugin (e.g. `task-utils@agents`), edits to the cached plugin copy will be overwritten on the next plugin update — for persistent doctrine changes, open a PR against the upstream plugin repo.

If your insight is too speculative to commit (single observation, might not generalize), DON'T edit the skill — note the observation in your reply for the parent to consider raising with the handler.

---

## 13. Change log

- **2026-05-17** — initial unified version, collapsing prior 3-component architecture (dispatcher + doctrine + task-resolver agent) into one `context: fork` skill per Nate Discord 2026-05-17 03:31Z. Self-correction §10 added.
- **2026-05-17** — added §10 "Parallelism via background subagents" covering the `Agent(run_in_background)` + `AGENT(<n>): ` prefix + `SendMessage` resume protocol; renumbered self-correction → §11, change log → §12, worked example → §13. Per Nate Discord 2026-05-17 (post-compact directive).
- **2026-05-17 04:13Z** — added `model: sonnet` to frontmatter (per Nate Discord [`1505422965800439919`](https://discord.com/channels/1490863845252665415/1497431286661517353/1505422965800439919)) so the forked decision-context runs on sonnet rather than inheriting the parent's opus. Inserted new §10 "Doctrine — validation-steps mechanism" describing the `<validation-steps>` block format, lifecycle interactions table, same-call merge semantics, practical guidance + anti-patterns. Added block-graph inheritance bullet to §4 (per Nate Discord [`1505421767760543745`](https://discord.com/channels/1490863845252665415/1497431286661517353/1505421767760543745)). Renumbered: parallelism §10→§11, self-correction §11→§12, change log §12→§13, worked example §13→§14. Updated three cross-refs.
- **2026-05-21** — added an "MCP fallback" note to §5 pointing at the new `task-mcp` MCP server (`task_create`/`task_update`/`task_list`/`task_get`) for contexts without the built-in Task tools. The doctrine is unchanged — the MCP tools enforce the same invariants. See the companion `tool-task-mcp` skill.
- **2026-05-24** — updated §5 to reflect R1 redesign: hooks now scan ONLY the flat MCP YAML store (legacy per-session JSON is no longer consulted); native-task advisory (`task-native-warning.sh`) and PostToolUse sync (`task-sync-from-legacy.sh`) added; `nativeTaskMode` setting documented. MCP server is now the primary (not just fallback) task path.

---

## 14. Worked example — Jack-upgrade decision

Parent prompt:

> Current task list: #2 [in_progress] Resume Jack upgrade. Proposed: spawn 6 section sibling tasks (S/P/R/I/B/L) under #2, mark #2 completed, start the smallest section.

Your reply:

> Proceed — matches worked example phase 3-4. Spawn the 6 sibling tasks via TaskCreate, then 1. TaskUpdate(#2, status=completed) with closing event-log line "spawned 6 section breakdowns", 2. TaskUpdate(<smallest-section-id>, status=in_progress). The L-row is itself non-atomic and will need its own sub-breakdown when reached (phase 8 recursion). Per doctrine §4 — breakdown pattern.
