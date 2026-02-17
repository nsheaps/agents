---
name: documentation
description: Procedure for keeping documentation in sync with implementation. Use whenever you make changes that affect documented behavior, or when you notice doc/code drift.
---

# Documentation

Procedure for maintaining documentation alongside implementation work. Docs that drift from reality are worse than no docs — they actively mislead.

## Purpose

Keep all documentation accurate and current as implementation changes. Every code change should prompt a documentation check.

## When to Use

- After making any code or configuration change that affects documented behavior
- When you notice a discrepancy between docs and reality
- When adding new features, commands, or configuration options
- When removing or renaming existing functionality
- During spec implementation — update the spec as you discover reality differs from plan

## Steps

1. **Identify affected docs** — For every change you make, ask: "What documentation describes this behavior?" Check:
   - README.md
   - Specs in `docs/specs/`
   - Skills in `.claude/skills/`
   - Agent files in `.claude/agents/`
   - Team docs in `.claude/docs/`
   - Inline code comments (if they describe behavior, not just syntax)

2. **Compare doc to reality** — Read the relevant doc section and compare to the actual current behavior. Note discrepancies.

3. **Update docs in the same commit** — Documentation updates should be part of the implementation commit when possible, not a separate follow-up. This prevents drift windows.

4. **Update specs as you learn** — Specs are living documents. If implementation reveals that a spec's assumptions were wrong:
   - Update the spec to reflect reality
   - Note what changed and why
   - Flag significant deviations to the team lead

5. **Check cross-references** — When you rename or move things, search for references in other docs:

   ```bash
   grep -r "old-name" docs/ .claude/
   ```

6. **Verify links** — Ensure URLs, file paths, and cross-references still resolve.

## Anti-Patterns

- Making code changes without checking if docs need updating
- Planning to "update docs later" — do it now or it won't happen
- Updating docs in a separate commit from the code change (creates drift windows)
- Documenting your plan instead of the actual implementation
- Leaving stale TODO comments instead of resolving them
- Over-documenting — don't add docs for self-evident code
- Copying implementation details into docs (they'll drift) — instead, describe behavior and intent
