---
name: failure-reporting
description: Procedure for reporting failures to Coach immediately with full context. Use any time something goes wrong — errors, blockers, spec contradictions, unexpected behavior, coordination issues.
---

# Failure Reporting

Procedure for reporting failures to the team Coach. Every failure, no matter how small, must be reported. The Coach records patterns that help the team improve.

## Purpose

Create a complete record of what went wrong so the team can identify patterns, prevent recurrence, and learn from mistakes.

## When to Use

- Any tool call fails or produces unexpected results
- You encounter a blocker that prevents progress
- You find a contradiction in specs or documentation
- A teammate's deliverable doesn't meet expectations
- Coordination breaks down (e.g., messaging a non-existent teammate)
- You applied a workaround instead of a proper fix
- Anything unexpected happens, even if you recovered from it

## Steps

1. **Capture immediately** — Report as soon as the failure occurs, not after you've tried to fix it. The raw failure state is more valuable than a post-fix summary.

2. **Message Coach** — Send a message to `coach` (Wile E. Coyote) with:
   - **What happened**: Factual description of the failure
   - **What you expected**: What should have happened instead
   - **Context**: What you were doing, which task, which files
   - **Impact**: Did it block you? Did it affect other work?

3. **Also message team-lead** — If Coach is unavailable or the failure is blocking, message team-lead directly.

4. **Continue or stop** — Based on severity:
   - **Non-blocking**: Note the failure, continue work, address later
   - **Blocking**: Stop and wait for guidance from team-lead
   - **Critical**: Stop all work, broadcast to team if it affects others

## Message Template

```
Failure report:
- What: [factual description]
- Expected: [what should have happened]
- Task: [task number and name]
- Context: [what you were working on]
- Impact: [blocking / non-blocking / critical]
- Root cause (if known): [your analysis]
```

## Anti-Patterns

- Silently recovering from a failure without reporting it
- Waiting until the end of a task to report accumulated failures
- Reporting vaguely ("something went wrong") without context
- Assuming a failure is too small to report — all failures matter
- Fixing the problem yourself without telling Coach — even successful recoveries should be logged
- Sending failure reports only to team-lead and skipping Coach
