---
id: PHASE1-009
title: "Update agent file frontmatter with launcher fields"
status: open
assignee: Tweety Bird (Technical Writer)
priority: medium
phase: 1
blocked_by: [PHASE1-002]
blocks: [PHASE1-010]
created: 2026-02-17
updated: 2026-02-17
task_id: "115"
---

# PHASE1-009: Update agent file frontmatter with launcher fields

Update all existing `.claude/agents/*.md` files to include the new launcher-specific frontmatter fields defined in the agent launcher spec.

## Scope

1. Read the agent launcher spec for the definitive frontmatter schema
2. Update all 8 existing agent files with new fields: framework, model, prompt_mode, base_prompt, permissions, tools (as applicable)
3. Preserve existing frontmatter (name, description, color) and markdown body
4. Use sensible defaults where specific values aren't yet determined
5. Ensure YAML is valid and parseable after updates

## Acceptance Criteria

- [ ] All 8 agent files have launcher-compatible frontmatter
- [ ] New fields added: framework, model, prompt_mode, base_prompt (at minimum)
- [ ] Existing content preserved (no loss of description, color, or body)
- [ ] YAML validates cleanly (test with parser)
- [ ] Changes committed with conventional commit message

## Files to Update

- `.claude/agents/ai-agent-eng.md`
- `.claude/agents/deep-researcher.md`
- `.claude/agents/docs-writer.md`
- `.claude/agents/ops-eng.md`
- `.claude/agents/orchestrator.md`
- `.claude/agents/project-manager.md`
- `.claude/agents/quality-assurance.md`
- `.claude/agents/software-eng.md`

## References

- Agent launcher spec: `docs/specs/draft/agent-launcher.md` (once written)
- Existing agent files: `.claude/agents/*.md`
