---
name: code-review
description: Procedure for reviewing your own code before declaring done. Use after making any code or config changes, before marking a task complete.
---

# Code Review

Procedure for self-reviewing changes before declaring work complete. You are your own first reviewer — catch issues before anyone else has to.

## Purpose

Ensure changes are correct, complete, and match the original request before marking work done. Catch bugs, oversights, and drift early.

## When to Use

- After making any code, script, or configuration changes
- Before marking a task as completed
- Before creating or updating a PR
- After addressing review feedback (re-review your fixes)

## Steps

1. **Re-read the original request** — What was actually asked for? Not your plan — the original request.

2. **Review the diff** — Read every line you changed:

   ```bash
   git diff          # unstaged changes
   git diff --staged # staged changes
   git diff main     # all changes vs base branch
   ```

3. **Check each change against the request** — For every modified file:
   - Does this change serve the original request?
   - Is there anything extra that wasn't asked for?
   - Is there anything missing that was asked for?

4. **Look for common issues**:
   - **Security**: Command injection, path traversal, credential exposure
   - **Correctness**: Off-by-one errors, wrong variable names, incorrect logic
   - **Completeness**: Missing error handling at boundaries, missing edge cases
   - **Style**: Consistent with surrounding code, follows project conventions

5. **Run validation**:
   - Formatter: `mise run fmt-check`
   - Tests: `mise run test`
   - Lint: `mise run lint`
   - Manual verification where automated checks aren't available

6. **Check for unintended changes** — Run `git diff --name-only` against the base branch. Every file should be intentionally changed.

7. **Confirm done** — Only after all checks pass, mark the task complete.

## Related Behaviors

- **[commit-hygiene.md](commit-hygiene.md)** — After reviewing, use commit hygiene to ensure changes are committed correctly with proper messages and scope.

## Anti-Patterns

- Declaring "done" without reading your own diff
- Reviewing against your plan instead of the original request
- Skipping validation ("it should work")
- Adding unrequested improvements or refactors during review
- Ignoring formatter or linter warnings
- Reviewing only the files you remember changing (check the full diff)
