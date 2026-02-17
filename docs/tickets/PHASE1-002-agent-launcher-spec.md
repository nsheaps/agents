---
id: PHASE1-002
title: "Write agent launcher spec"
status: open
assignee: Elmer Fudd (Project Manager)
priority: critical
phase: 1
blocked_by: [PHASE1-001]
blocks: [PHASE1-003, PHASE1-009, PHASE1-011]
created: 2026-02-17
updated: 2026-02-17
task_id: "104"
---

# PHASE1-002: Write agent launcher spec

Write the detailed agent launcher specification at `docs/specs/draft/agent-launcher.md`. This is the core design document that guides all Phase 1 implementation work.

## Scope

1. Define agent file discovery (glob `.claude/agents/*.md`)
2. Define YAML frontmatter schema for agent files (name, role, framework, model, permissions, tools, prompt_mode, base_prompt)
3. Define prompt assembly logic (EXTEND vs REPLACE modes)
4. Define base prompt selection (`_builtin` or custom file path)
5. Define spawning interface (Claude Code backend first, extensible to others)
6. Define lifecycle commands (launch, kill, relaunch, health-check, list)
7. Define interaction with `--append-system-prompt` and potential `--system-prompt` flags

## Acceptance Criteria

- [ ] Spec covers all Phase 1A, 1B, 1C sub-phases from the multi-repo phase plan
- [ ] YAML frontmatter schema defined with all fields and types
- [ ] Prompt assembly algorithm documented step-by-step
- [ ] Spawning interface defined for Claude Code backend
- [ ] Lifecycle management commands documented
- [ ] Edge cases addressed (missing fields, invalid YAML, duplicate agent names)
- [ ] Spec saved to `docs/specs/draft/agent-launcher.md`

## References

- Multi-repo phase plan: `docs/specs/draft/multi-repo-phase-plan.md`
- Architecture discussion: `docs/specs/draft/agent-team-architecture.md`
- Current claude-team script: `~/src/nsheaps/claude-utils/bin/claude-team`
- Agent wrapper PRD: `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md`
