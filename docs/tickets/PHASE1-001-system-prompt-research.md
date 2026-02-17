---
id: PHASE1-001
title: "Research: does Claude Code support --system-prompt (replace) flag?"
status: open
assignee: Road Runner (Researcher)
priority: critical
phase: 1
blocked_by: []
blocks: [PHASE1-002, PHASE1-004]
created: 2026-02-17
updated: 2026-02-17
task_id: "103"
---

# PHASE1-001: Research — does Claude Code support --system-prompt (replace) flag?

Phase 1A prerequisite. The agent launcher needs to support REPLACE mode (agent prompt fully replaces system prompt). Research whether Claude Code supports a `--system-prompt` flag that replaces the built-in system prompt, versus `--append-system-prompt` which extends it.

## Scope

1. Run `claude --help` and document all prompt-related flags
2. Check Claude Code docs at https://code.claude.com/docs/en/
3. Search for any experimental flags that might enable prompt replacement
4. Document the exact behavior of `--append-system-prompt` (does it append to the end? Is it a system-reminder? How does it interact with CLAUDE.md?)

## Acceptance Criteria

- [ ] All prompt-related CLI flags documented
- [ ] Clear answer: can the built-in system prompt be replaced or only extended?
- [ ] If replace isn't possible, document alternative approaches
- [ ] Findings saved to `.claude/tmp/system-prompt-flags-research.md` in agent-team repo

## References

- Claude Code CLI: https://code.claude.com/docs/en/cli
- Current `claude-team` script uses `--append-system-prompt`: `bin/claude-team:174`
