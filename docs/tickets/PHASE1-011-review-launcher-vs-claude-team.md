---
id: PHASE1-011
title: "Review: compare agent launcher against claude-team for gaps"
status: open
assignee: Wile E. Coyote (AI Agent Eng)
priority: medium
phase: 1
blocked_by: [PHASE1-002]
blocks: []
created: 2026-02-17
updated: 2026-02-17
task_id: "117"
---

# PHASE1-011: Review — compare agent launcher against claude-team for gaps

AI Agent Eng review of the agent launcher spec against the existing `claude-team` script. Identify anything the current script does that the launcher spec doesn't account for.

## Scope

1. Read the agent launcher spec (`docs/specs/draft/agent-launcher.md`)
2. Read the current `claude-team` script (`~/src/nsheaps/claude-utils/bin/claude-team`)
3. Compare feature-by-feature: what does `claude-team` do that the launcher doesn't cover?
4. Identify gaps, risks, and migration concerns
5. Report findings with specific file:line references

## Acceptance Criteria

- [ ] Feature comparison matrix: claude-team vs agent launcher
- [ ] All gaps identified with severity rating
- [ ] Migration path documented: how to transition from claude-team to launcher
- [ ] Findings saved to `.claude/tmp/ai-agent-eng-launcher-review.md`
- [ ] Summary messaged to team lead

## Key Areas to Compare

- Interactive mode selection (gum-based UI in claude-team)
- iTerm2 detection and tmux -CC auto-launch
- Brew update check
- Environment variable setup
- Hook configuration (SessionStart, Stop)
- Permission mode selection
- `--continue` flag behavior

## References

- Agent launcher spec: `docs/specs/draft/agent-launcher.md` (once written)
- Current claude-team script: `~/src/nsheaps/claude-utils/bin/claude-team`
- Agent-team architecture: `docs/specs/draft/agent-team-architecture.md`
