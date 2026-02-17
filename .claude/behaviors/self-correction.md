---
name: self-correction
description: Procedure for when something goes wrong — stop, reflect, identify root cause, fix the underlying issue, and update rules/skills to prevent recurrence. Use immediately when you notice unexpected behavior or make a mistake.
---

# Self-Correction

Procedure for handling mistakes and unexpected outcomes. Every teammate must follow this when something doesn't work as expected.

## Purpose

Turn failures into improvements. Don't just fix the immediate problem — fix the underlying cause so it doesn't happen again.

## When to Use

- A tool call fails or produces unexpected results
- You realize you made a mistake (wrong file, wrong approach, wrong assumption)
- A teammate or the team lead points out an error
- You notice your output doesn't match the original request
- A test, lint, or validation check fails

## Steps

1. **Stop immediately** — Do not continue working. Do not attempt workarounds.

2. **Reflect** — Think through these questions:

   ```
   What did I expect to happen?
   What actually happened?
   Why is there a difference?
   Was this caused by my action, a misunderstanding, or an external issue?
   ```

3. **Identify root cause** — Don't stop at symptoms. Ask "why" until you reach the actual cause:
   - Wrong assumption? → Where did the assumption come from?
   - Missing information? → Where should it have been documented?
   - Incorrect procedure? → Which step was wrong or missing?

4. **Report the failure** — Message the AI Agent Eng (and team-lead if the AI Agent Eng isn't available) with:
   - What happened
   - What you expected
   - Your root cause analysis

5. **Fix the root cause** — Address the underlying issue, not just the symptom:
   - Wrong assumption → Update the relevant doc or rule
   - Missing information → Add it to the appropriate location
   - Incorrect procedure → Update the behavior, skill, or rule file

6. **Verify the fix** — Confirm the original task now works correctly with the fix applied.

7. **Resume work** — Only after the root cause is addressed.

## Anti-Patterns

- Silently retrying the same action hoping for a different result
- Applying workarounds without understanding why something failed
- Fixing the symptom without addressing the root cause
- Continuing work after a failure without stopping to reflect
- Blaming external tools before verifying your own actions
- Skipping the report to the AI Agent Eng — all failures must be logged
