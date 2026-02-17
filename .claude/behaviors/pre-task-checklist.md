---
name: pre-task-checklist
description: Mandatory "step 0" checklist to complete before beginning any task. This is the proactive prevention behavior that would have prevented 5 of 9 logged team failures. Use EVERY time you start work on a task — no exceptions.
---

# Pre-Task Checklist

Mandatory checklist to complete before starting any task. This is the proactive counterpart to self-correction (which is reactive). Most team failures could have been prevented by pausing at "step 0" before executing.

## Purpose

Force a deliberate pause between receiving a task and starting work. This pause is where most failures are preventable — wrong requirements, wrong recipients, wrong assumptions, unapproved approaches.

## When to Use

- Before starting ANY task — this is not optional
- After compaction, before resuming work
- When switching from one task to another
- When a task's requirements change mid-execution

## Steps

Complete ALL items before writing any code, making any edits, or producing any deliverables:

1. **Read requirements from TaskGet** — Not from memory, not from the assignment message, not from the compaction summary. Run TaskGet and read the actual description.

2. **Read referenced materials** — If the task references research, specs, docs, prior deliverables, or other files, read them now. Skipping this step is the most common cause of incorrect work.

3. **Verify your approach** — Ask yourself:
   - Is there only one way to do this, or are there alternatives?
   - If multiple approaches exist: STOP and present options to team-lead
   - If only one approach: does it rely on any mechanism you haven't verified?

4. **Verify tools and mechanisms** — If the task involves a tool, format, syntax, or mechanism you haven't personally tested:
   - Test it with a minimal example before building your implementation around it
   - "I think this works" is not verification — run it and see

5. **Verify recipients** — If this task involves delivering work to someone:
   - Read team config to confirm the recipient's exact name
   - Plan to save deliverables to files first, then send summary messages

6. **Check for HOLD orders** — Review recent messages for any HOLD, STOP, or WAIT directives. If one is active, do not proceed.

7. **State your plan** — Briefly state what you're about to do and how. This creates a visible checkpoint. Format:

   ```
   Starting [task #X]. My understanding:
   - Goal: [one sentence]
   - Approach: [one sentence]
   - Output: [what I'll deliver and where]
   ```

8. **Begin work** — Only after completing items 1-7.

## Anti-Patterns

- Skipping the checklist because the task "seems simple"
- Reading the assignment message instead of running TaskGet
- Starting work while planning to "verify later"
- Assuming you know what referenced documents say without reading them
- Picking an approach autonomously when alternatives exist
- Beginning implementation before testing that a mechanism works
- Treating this checklist as optional or "nice to have"
- Rushing through the checklist without actually doing each step
