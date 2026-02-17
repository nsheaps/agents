---
name: requirements-verification
description: Verify task requirements from authoritative sources before starting work. Use EVERY time you receive a task assignment, resume after compaction, or feel uncertain about what's being asked. Highest-priority behavior — addresses the team's most common failure pattern.
---

# Requirements Verification

Procedure for ensuring you have correct, current requirements before starting any work. This is the single highest-value behavior on this team — 4 of 9 logged failures trace to starting work with wrong, stale, or assumed requirements.

## Purpose

Prevent wasted effort and incorrect deliverables by verifying requirements from authoritative sources before executing. "Measure twice, cut once."

## When to Use

- Before starting ANY task (no exceptions)
- After compaction (requirements in the summary may be corrupted or incomplete)
- When you feel uncertain about any aspect of the task
- When multiple approaches seem valid
- When a mechanism or tool is mentioned that you haven't verified works

## Steps

1. **Read the task from TaskGet** — Do not rely on the message summary, your memory, or the compaction summary. Run `TaskGet` and read the full description field. This is the authoritative source.

2. **Read referenced materials** — If the task mentions research files, specs, docs, or other deliverables, read them before starting. Do not assume you know what they contain.

3. **Verify mechanisms before implementing** — If the task mentions a specific approach, tool, or mechanism (like @file references, frontmatter syntax, CLI flags), verify that it actually works with a minimal test case BEFORE building your implementation around it.

4. **Check for ambiguity** — If the requirements could mean more than one thing, or if multiple valid approaches exist:
   - STOP. Do not pick one autonomously.
   - Present the options to team-lead with pros/cons.
   - Wait for a decision before proceeding.

5. **Confirm no HOLD is in effect** — Check recent messages for any HOLD orders. If a HOLD was issued, do not start work until explicitly released.

6. **State your understanding** — Before beginning work, briefly state what you're about to do. This creates a checkpoint where misunderstandings can be caught early.

7. **Post-compaction extra verification** — After any compaction event:
   - Re-read task requirements from TaskGet (not the compaction summary)
   - Re-read team config for teammate names
   - Re-read any referenced files (your memory of their contents may be wrong)
   - Do not trust ANY details from the compaction summary for execution purposes — use it only for orientation, then verify everything

## Anti-Patterns

- Starting work from the task assignment message without running TaskGet
- Trusting the compaction summary as a source of requirements
- Picking an approach when multiple are valid without asking
- Assuming you know what a referenced document says without reading it
- Proceeding when uncertain — "I think this is what they meant" is a red flag
- Implementing around an unverified mechanism, then discovering it doesn't work
- Treating "I've done similar tasks before" as a substitute for reading this task's requirements
