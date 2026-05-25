---
type: bug
created: 2026-05-25T19:36:06Z
state: to-triage
project: GSD
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508554062340034831
events:
  - { ts: 2026-05-25T19:36:06Z, by: alex, change: "created from Discord ask[^discord-ask]" }
---

# task-utils PreToolUse hook: validation error is non-comprehensive — wastes tool calls

## Original Discord message

> Add a bug (bugs should get higher priority than picking up something else on the MASTER.md list)
>
> Task-utils, the error blocks moving to completed with invalid validation step states (unchecked or missing results). That caused you to just try to move the state twice because the first error wasn't descriptive enough. Make the error better and make it include the steps that need to be completed before moving it.
>
> Capture that right now so you keep the context of the tool calls you just made, but drop it into to-triage

Source: Discord msg[^discord-ask] (2026-05-25 19:35Z)

## Problem

The `task-invariant.sh` hook (PreToolUse on `TaskUpdate`) blocks transitions to `completed` when validation steps are invalid. The current error message emits ONE class of issue at a time:

1. First call: `Cannot move task #N to completed — X validation step(s) remain unchecked...`
2. Caller fixes the checked boxes, retries.
3. Second call: `Cannot move task #N to completed — the following checked validation step(s) are missing RESULT lines (1-based item indices): ...`
4. Caller fixes the RESULT lines, retries again.

Net effect: two error-correction cycles for what is logically one fix. Wastes a tool-call round-trip and the caller has to re-load context twice.

## Expected

A single comprehensive error that lists ALL of the issues at once:

- which boxes are unchecked
- which checked boxes are missing `RESULT(...)` lines
- the exact format expected (so the caller can produce a single corrected description)

## Actual

See "Problem" above — issues are reported one class at a time.

## Steps to reproduce

1. Create a task with `<validation-steps>` containing 5 unchecked items.
2. Move to `in_progress` (passes).
3. Do the work.
4. Move to `completed` WITHOUT checking any boxes — first error mentions only "unchecked".
5. Check all the boxes, re-call without RESULT lines — second error mentions only "missing RESULT".
6. Add RESULT lines, re-call — now succeeds.

Today this happened on alex/task #540 (commit `8fd8ad1` predecessor work). Three TaskUpdate(completed) calls were needed instead of one.

## Suggested fix

`hooks/task-invariant.sh`: when blocking a `completed` transition, run BOTH the unchecked-check AND the missing-RESULT-check, and emit a single error that lists all findings. Could format as:

```
Cannot move task #N to completed — fix the following before retrying:

UNCHECKED items (need `- [x]`):
  - <step 3 text>
  - <step 5 text>

CHECKED-but-missing-RESULT items (need `RESULT(<ts>[, by ...]): <evidence>` directly after the line):
  - item 1: <step 1 text>
  - item 2: <step 2 text>
  - item 4: <step 4 text>

Format example:
  - [x] step text
    RESULT(2026-05-17 04:06Z, by alex): log line "X" in /path/to/log confirms
```

## Scope

- Plugin: `task-utils` (in `nsheaps/agents/plugins/claude-code/task-utils/`)
- File: `hooks/task-invariant.sh`
- Affects: every agent using task-utils (alex, jack, henry)

## Acceptance criteria

- A single failed `TaskUpdate(status=completed)` call returns ALL classes of validation-state problems at once.
- Existing successful transitions still succeed (no regressions to the happy path).
- Error message includes a copy-pasteable format example for the RESULT line.

## Notes

- This is meta-tooling-debt; while not blocking work, it costs 1 wasted tool-call per task completion when boxes/RESULTs are forgotten.
- Currently no validation-step linter exists for the create/in-progress path either — caller can only discover the requirements at completion time. Worth surfacing in the hook coach text on transition-to-in-progress too (already partially done).

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508554062340034831
