---
id: PHASE1-003
title: "Implement: agent file discovery + YAML frontmatter parsing"
status: open
assignee: Bugs Bunny (Software Eng)
priority: high
phase: 1
blocked_by: [PHASE1-002]
blocks: [PHASE1-004]
created: 2026-02-17
updated: 2026-02-17
task_id: "105"
---

# PHASE1-003: Implement agent file discovery + YAML frontmatter parsing

Phase 1A implementation. Build the module that discovers `.claude/agents/*.md` files and parses their YAML frontmatter into structured agent definitions.

## Scope

1. Glob `.claude/agents/*.md` to find all agent definition files
2. Parse YAML frontmatter from each file (using gray-matter or similar)
3. Extract agent metadata: name, role, framework, model, permissions, tools, prompt_mode, base_prompt
4. Validate required fields and report errors for malformed files
5. Return structured array of agent definitions

## Acceptance Criteria

- [ ] Discovers all `.md` files in `.claude/agents/`
- [ ] Parses YAML frontmatter correctly (handles multi-line strings, arrays, objects)
- [ ] Validates required fields (at minimum: name, description)
- [ ] Returns structured TypeScript types for agent definitions
- [ ] Handles edge cases: empty frontmatter, missing file, non-markdown files
- [ ] Unit tests for discovery and parsing

## References

- Agent launcher spec: `docs/specs/draft/agent-launcher.md` (once written)
- Existing agent files: `.claude/agents/*.md` (8 files as reference)
