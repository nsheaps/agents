---
name: idle-5-min
description: Cron-delegate skill for the 5-minute self-poll. Invoked every 5 minutes by cron — checks (a) in_progress tasks, (b) MONITORING(...) pending tasks, (c) AGENT(...) pending tasks, and any background shells; applies the self-correction discipline ladder (1st/2nd/3rd-fire); delegates to active-convo-goes-idle when the conversation has been idle past 30m. Trigger phrases — "5m self-poll fired", "cron tick", "check what I'm waiting on", "Skill(idle-5-min)".
---

<!-- SOURCE: nsheaps/.ai-agent-alex/.claude/skills/idle-5-min/SKILL.md (alex commit 3a324d0) -->
<!-- SEE-ALSO: ../active-convo-goes-idle/SKILL.md (30m-idle reminder), https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/skills/manage-tasks/SKILL.md (task lifecycle doctrine — cross-plugin: task-utils) -->

# idle-5-min

You are mid-cron-tick. The 5-minute self-poll just fired. Walk this checklist in order, then either advance work or fall silent. No content dump in chat — only post if discipline says to.

---

## 1. Three-bucket task check

### (a) Your in_progress tasks

If any task is `status=in_progress` and there's a step you can take RIGHT NOW to advance it, take it. Do not abandon in-flight work to chase shiny new things.

If the in_progress task has been blocked for multiple ticks without your touch (no edits, no tool calls), reconsider: is it actually blocked on an external event? If yes, it should have been a MONITORING(...) task — convert it (rename, move back to pending) and pick something else.

### (b) Pending tasks prefixed `MONITORING(<monitor-id>):` (or legacy `MONITORING:`)

The `<monitor-id>` names what's watching:

- `cron-<this-cron-id>` (typically `cron-0c345733`) — this cron is the monitor. Re-check whether the awaited event happened (file appeared, log line written, CI green, restart completed, peer-agent replied).
- `AGENT(<short-name>)` — a subagent is watching. Don't re-check here; the subagent will report back.

If the awaited event HAS happened: move the task to in_progress, validate the result, complete it.

**Broken-state guard** (per Nate Discord [1505429791833194687](https://discord.com/channels/1490863845252665415/1497431286661517353/1505429791833194687)): a `MONITORING(...)` task whose monitor-id is `cron-XXX` but XXX is NOT in `CronList`, OR whose monitor-id is `AGENT(name)` but no such subagent is running — that's broken state. Fix it: either re-establish the monitor or rename/cancel the task.

### (c) Pending tasks prefixed `AGENT(<short-name>):`

These represent dispatched background subagents (per `manage-tasks/SKILL.md` §11). If the subagent has returned:

1. Pause whatever you're doing.
2. Move the AGENT(...) task to in_progress.
3. Review the subagent's summary AND verify its actual output (don't trust the summary alone — read the diff/file).
4. Either complete the task, OR send another round via `SendMessage({to: "<short-name>"})`.

### (d) Background shells

Check any background shells you launched (`run_in_background: true` Bash calls). Same rules as subagents: if exited, read output and act; if still running on tick 2+ with no progress markers, investigate.

---

## 2. Self-correction discipline (fire ladder)

For each thing you're waiting on, classify the fire — based on how many consecutive ticks you've been waiting with no change:

| Fire                                    | Action                                                                                                                                                                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1st (this is the first tick of waiting) | Noted, proceed normally.                                                                                                                                                                                                                                          |
| 2nd consecutive (~10 min)               | **Actively investigate THIS tick.** Read the relevant log, fetch state from the external system (tmux pane, GitHub API, peer-agent transcript), check the handle is alive. Don't just re-check the task and shrug.                                                |
| 3rd consecutive (~15 min)               | Almost certainly stuck OR your logging is opaque. Dig deeper. If you genuinely cannot tell what's going on, that itself is a finding — post to Discord with expected-vs-observed + hypothesis, and either kill the stuck thing or file an observability-gap task. |

**Cannot point to the moment you initiated it?** That's a failure. Diagnose the gap and either initiate it now or stop waiting (don't pretend to be waiting on something that never started).

Reference: Nate Discord [1505421176590307469](https://discord.com/channels/1490863845252665415/1497431286661517353/1505421176590307469) (2026-05-17 04:06Z).

---

## 3. Active-convo idle check (30m threshold)

If the active conversation has gone silent and you're blocked on the handler (or a peer agent) for answers, run `Skill(active-convo-goes-idle)`. It decides whether enough time has passed (30m default) and drafts the single reminder message.

Do **not** inline that logic here. The decision (and the message format) lives in that skill so cron stays a thin delegator.

---

## 4. When to post to Discord

Post ONLY if:

1. Something materially advanced this tick (an awaited event happened — report it briefly with artifact links).
2. You hit the 3rd-fire escalation on something you're waiting on.
3. A background handle (subagent or shell) returned with a result needing handler attention.
4. The active-convo-goes-idle skill returned a "send reminder now" decision (post the reminder it drafted).

Otherwise: stay silent. The default is no post. A handful of "No change. Idle." messages in a row is fine — better than nag.

---

## 5. Output contract

This skill executes inline (it does NOT fork). After running the checklist:

- If actions were taken: a short summary in chat (e.g. "Validated PR #142 merged, completed #113. Starting #117.")
- If no actions: one terse line — "No change. Idle." or equivalent.
- Never re-narrate the checklist itself in chat. The checklist is internal.

---

## 6. What this skill does NOT do

- Decide WHEN to ping the handler about idle conversation (that's `active-convo-goes-idle`).
- Mutate the cron itself (that's a config edit, not a tick action).
- Spawn new work that wasn't already on the task list — if a tick reveals new work, that's a TaskCreate, not a free-floating action.
