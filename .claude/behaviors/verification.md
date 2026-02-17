---
name: verification
description: Independent verification of deliverables before reporting done. Use when reviewing your own work or a teammate's output to ensure it meets requirements and quality standards.
---

# Verification

Procedure for independently verifying that work meets requirements. "Trust but verify" — check deliverables against the original request, not just the plan.

## Purpose

Catch gaps, errors, and drift between what was requested and what was delivered before declaring work complete.

## When to Use

- Before marking any task as completed
- When reviewing a teammate's deliverable
- After making changes that affect multiple files
- Before committing code or documentation changes

## Steps

1. **Re-read the original request** — Go back to the actual user/team-lead message that initiated the work. Don't rely on your plan or memory.

2. **Create a checklist** — Extract every requirement from the original request as a checkable item:

   ```
   [ ] Requirement A from the original request
   [ ] Requirement B from the original request
   [ ] Requirement C added during discussion
   ```

3. **Verify each item independently** — For each checklist item:
   - Read the actual file/output (don't trust memory)
   - Confirm it matches the requirement
   - Note any deviations

4. **Check for side effects** — Did the changes break anything adjacent?
   - Run formatter (`mise run fmt-check`)
   - Run tests if available (`mise run test`)
   - Check git diff for unintended changes

5. **Compare plan vs. original request** — If there's a gap between your plan and the original request, the original request wins. Flag any deviations.

6. **Document the verification** — Note what you checked and the result. For formal verifications, save to a file.

7. **Report honestly** — If something doesn't pass, say so. "Almost done" is not "done."

## Anti-Patterns

- Declaring "done" without re-reading the original request
- Verifying against your plan instead of the original request
- Trusting memory instead of reading actual files
- Skipping formatter/test validation
- Marking a task complete when issues remain ("it mostly works")
- Verifying only the happy path without checking edge cases
