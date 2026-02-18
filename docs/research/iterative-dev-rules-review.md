# Iterative Development Rules & Plugin Review

**Reviewer**: Wile E. Coyote (AI Agent Engineer)
**Date**: 2026-02-18
**User request**: Check whether existing rules and plugin adequately cover "iterative approach to development" and "extract first, improve later" pattern.

---

## What Was Checked

1. **`nsheaps/.ai/.ai/rules/mantras-and-incremental-development.md`** — The shared incremental development rule
2. **`product-development-and-sdlc` plugin** (nsheaps-claude-plugins marketplace) — PRD writing skill

## Findings

### Gap 1: "Extract first, improve later" was not covered (FIXED)

The incremental development rule covered building features step-by-step (plan → start small → iterate → test → refactor) but had NO guidance on operational tasks like extraction, migration, or restructuring.

**Fix applied**: Added "Incremental Operations: Extract, Migrate, Refactor" section to `mantras-and-incremental-development.md` in nsheaps/.ai. Covers:
- Phase 1: Pure move (zero functional changes, verify identical behavior)
- Phase 2: Improvements (only after move is verified)
- Why this matters (separates relocation breakage from modification breakage)
- What it applies to (repo extraction, file moves, monolith splits, config migration)
- Anti-pattern: "While I'm moving this, I'll also fix/improve/refactor it"

### Gap 2: product-development-and-sdlc plugin covers PRD but not SDLC execution (NOT FIXED — larger effort)

The plugin name promises "product development AND SDLC" but only contains one skill: `prd-writing`. There is no skill for:
- Implementation phasing (how to break a PRD into phased execution)
- Extraction/migration workflows
- Release management
- Feature flagging / rollout strategies
- Post-launch validation

This is a real gap but a larger effort than the user's immediate ask. The "extract first, improve later" pattern belongs in the rules (where I put it) because it's a general development principle, not a specific skill workflow.

**Recommendation**: File a ticket or note for the plugin to add SDLC execution skills in a future pass. The PRD writing skill is good for the "define" phase; the plugin needs skills for the "execute" and "validate" phases too.

### Gap 3: The rule doesn't explicitly say "don't make this a plugin concern" (no fix needed)

The boundary between rules (general principles) and skills (specific workflows) is correct here. "Extract first, improve later" is a principle that applies everywhere — it belongs in rules, not in a skill that only activates on specific triggers. No fix needed, but noting the reasoning for future reference.

## Summary

| Item | Status | Action |
|:-----|:-------|:-------|
| Incremental operations pattern | **Fixed** | Added to `mantras-and-incremental-development.md` |
| Plugin SDLC execution gap | **Noted** | Recommend future plugin enhancement |
| Rule vs skill boundary | **Correct** | No action needed |

## References

- Rule updated: `/Users/nathan.heaps/src/nsheaps/ai/.ai/rules/mantras-and-incremental-development.md`
- Plugin source: `/Users/nathan.heaps/src/nsheaps/ai/plugins/product-development-and-sdlc/`
- User request context: "extract first, improve later" decision on claude-team extraction
