---
id: PHASE1-004
title: "Implement: prompt assembly (extend/replace modes + base prompt selection)"
status: open
assignee: Bugs Bunny (Software Eng)
priority: high
phase: 1
blocked_by: [PHASE1-001, PHASE1-003]
blocks: [PHASE1-005]
created: 2026-02-17
updated: 2026-02-17
task_id: "106"
---

# PHASE1-004: Implement prompt assembly

Phase 1A implementation. Build the prompt assembly module that constructs the final system prompt for each agent based on their configuration.

## Scope

1. Implement EXTEND mode: agent prompt content appended to base via `--append-system-prompt`
2. Implement REPLACE mode: agent prompt content fully replaces the system prompt (if supported — depends on PHASE1-001 research)
3. Implement base prompt selection: `_builtin` (Claude Code default) or path to custom file
4. Combine frontmatter metadata, markdown body, and base prompt into final prompt string
5. Handle prompt mode fallback if REPLACE is not supported

## Acceptance Criteria

- [ ] EXTEND mode works: generates `--append-system-prompt` flag value
- [ ] REPLACE mode works (or graceful fallback documented if not supported)
- [ ] Base prompt selection: `_builtin` returns empty (lets Claude Code use its default), custom path reads file
- [ ] Prompt includes agent role, character, and markdown body content
- [ ] Unit tests for both modes and base prompt selection

## Dependencies

- PHASE1-001: Need to know if `--system-prompt` flag exists for REPLACE mode
- PHASE1-003: Need parsed agent definitions as input

## References

- Agent launcher spec: `docs/specs/draft/agent-launcher.md` (once written)
- Current `--append-system-prompt` usage: `~/src/nsheaps/claude-utils/bin/claude-team:174`
