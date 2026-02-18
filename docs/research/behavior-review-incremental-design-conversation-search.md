# Behavior Review: incremental-design + conversation-search

**Reviewer:** Wile E. Coyote (AI Agent Engineer)
**Date:** 2026-02-16

---

## incremental-design.md — PASS

**Format compliance:** Follows established pattern — YAML frontmatter (name + description), Purpose, When to Use, Steps, Anti-Patterns. Matches failure-reporting.md, research.md, etc.

**Quality assessment:**
- Clear, opinionated, actionable — "Start embarrassingly small" sets the right tone
- Steps are concrete: 5-15 lines max, share, wait, expand one section, repeat
- "The First Draft Test" is a strong addition — gives a measurable threshold
- Anti-Patterns are specific and relevant (future considerations, edge cases before happy path)
- 53 lines — appropriate length for a behavior file

**No issues found.** This is one of the better-written behaviors in the set.

---

## conversation-search.md — PASS with notes

**Format compliance:** Follows established pattern — YAML frontmatter, Purpose, When to Use, Steps, Anti-Patterns, References.

**Quality assessment:**
- Core procedure (Steps 1-5) is clear and practical
- Critical safety warning about context bloat is well-placed
- Schema table (line 52-61) is useful and concise
- References section links to JSONL research doc — good traceability
- Anti-Patterns cover the key risks

**Notes (not failures):**

1. **Length (115 lines)** — This is roughly 2x the typical behavior file. Most existing behaviors are 40-65 lines. Not a problem per se, but worth noting.

2. **Behavior vs. Skill boundary** — The CLI Recipes section (lines 65-100) is reference material, not procedural guidance. The existing rule from the user is: "Prefer to capture 'how to do things' as skills, rather than rules." The core Steps (1-5) are clearly behavioral, but the CLI recipes read more like a skill's reference section. Consider:
   - Extracting CLI recipes to a skill or reference doc
   - Keeping just the core procedure in the behavior
   - Or accepting the hybrid format since the recipes directly support the behavior's purpose

3. **Model suggestion** — Step 2 recommends `model: "haiku"` which is good cost-saving advice. However, this creates a coupling to a specific model name that could become stale. Minor risk.

---

## Consistency Check

| Aspect | incremental-design | conversation-search | Existing behaviors |
|--------|-------------------|--------------------|--------------------|
| Frontmatter | name + description | name + description | name + description |
| Sections | Purpose, When, Steps, Anti-Patterns | Purpose, When, Steps, Anti-Patterns, Refs | Varies (all have Purpose, When, Steps, Anti-Patterns) |
| Length | 53 lines | 115 lines | 40-65 lines typical |
| Tone | Directive | Practical/tutorial | Directive |
| Cross-refs | None needed | Links to research doc | Some have them |

Both are consistent with the established behavior format. conversation-search is on the longer end but justified by the technical nature of the topic.

---

## Verdict

| Behavior | Result | Notes |
|----------|--------|-------|
| incremental-design | **PASS** | High quality, follows format |
| conversation-search | **PASS** | Good quality, slightly long due to CLI recipes (hybrid behavior/skill) |
