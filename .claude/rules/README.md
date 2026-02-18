# Rules

Rules are **short declarative constraints** loaded on every Claude Code API call. They define what to always do or never do — not how to do it.

## Rules vs Behaviors

| Aspect  | Rules (`.claude/rules/`)           | Behaviors (`.claude/behaviors/`)                   |
| ------- | ---------------------------------- | -------------------------------------------------- |
| Format  | Short declarative statements       | Multi-step procedures with steps and anti-patterns |
| Loading | Every API call (always in context) | On demand (referenced when relevant)               |
| Purpose | Constraints and principles         | Repeatable work patterns                           |
| Length  | Keep short — every token counts    | Can be detailed — loaded only when needed          |
| Example | "Never expose teammate internals"  | "How to verify deliverables before marking done"   |

## Token Budget

Rules consume context on **every API call**. Keep them concise. If a rule needs steps, procedures, or detailed anti-patterns, it belongs in `.claude/behaviors/` instead.

## Current Rules

- `teammate-abstraction.md` — Teammates are black boxes; never expose implementation details
- `research-before-broadcasting.md` — Verify before broadcasting to the team; guessing wastes everyone's context
