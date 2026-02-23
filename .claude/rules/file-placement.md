# File Placement

Place files according to their permanence. Temporary artifacts go in `.claude/tmp/`. Everything else goes in a permanent location.

## Quick Reference

| Content | Location |
|:--------|:---------|
| Research findings | `docs/research/` |
| Specifications | `docs/specs/{draft,reviewed,in-progress,live,deprecated,archive}/` |
| Implementation plans | `.claude/plans/` |
| Working notes | `.claude/scratch/` |
| Intermediate/disposable output | `.claude/tmp/` |
| Team working files | `.claude/tmp/` (shared between teammates) |

## The Test

> "If this session ends and this file is deleted, was the work wasted?"

- **Yes** -- permanent location (`docs/`, `.claude/plans/`, `.claude/scratch/`)
- **No** -- `.claude/tmp/`

## Rules

- Completed research never goes to `.claude/tmp/` -- save directly to `docs/research/`
- Completed specs never go to `.claude/tmp/` -- save directly to `docs/specs/`
- When in doubt, default to a permanent location
- Always summarize `.claude/tmp/` findings into a permanent file before considering work done
