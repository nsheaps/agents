---
name: incremental-design
description: Procedure for designing specs, plans, and documents incrementally instead of all at once. Use when creating any new design artifact — specs, PRDs, architecture docs, behavior files. Prevents over-engineering by forcing small first drafts and explicit expansion cycles.
---

# Incremental Design

Start embarrassingly small. Expand only when asked or when gaps block progress.

## Purpose

Prevent over-engineering in design artifacts. Claude's default behavior is to produce comprehensive output in one pass — this leads to bloated specs, premature abstractions, and decisions made without enough context. This behavior forces the opposite: tiny drafts, then deliberate expansion.

## When to Use

- Writing a new spec, PRD, or design doc
- Creating a new behavior, skill, or agent file
- Drafting any document that will guide implementation
- Any time you catch yourself writing more than a page on the first pass

## Steps

1. **Write the smallest useful draft** — 5-15 lines maximum. Cover only:
   - What is this?
   - What problem does it solve?
   - What's the simplest possible approach?

   Stop. Share it. Do NOT continue writing.

2. **Wait for feedback** — Send the draft to the requester. Ask: "What should I expand first?" Do not guess what they want elaborated.

3. **Expand one section at a time** — When told to expand, add detail to ONE section. Then stop and share again.

4. **Repeat until done** — Each cycle adds one layer of detail. The document grows through review, not through imagination.

## The First Draft Test

If your first draft is longer than 15 lines, you over-engineered it. Delete and start over.

Ask yourself:

- Can I say this in fewer words? (Yes. Always yes.)
- Am I solving a problem that exists right now? (If not, cut it.)
- Would I need this if we were building it tomorrow? (If not, cut it.)

## Anti-Patterns

- Writing a complete spec in one pass
- Adding "future considerations" sections before the core is reviewed
- Defining edge cases before the happy path is agreed on
- Including implementation details in a design doc's first draft
- Expanding sections nobody asked about
- Treating comprehensiveness as quality — brevity is quality
