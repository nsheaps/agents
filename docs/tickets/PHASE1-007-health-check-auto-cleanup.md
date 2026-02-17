---
id: PHASE1-007
title: "Implement: health check + auto-cleanup of stale agents"
status: open
assignee: Bugs Bunny (Software Eng)
priority: medium
phase: 1
blocked_by: [PHASE1-006]
blocks: [PHASE1-008]
created: 2026-02-17
updated: 2026-02-17
task_id: "112"
---

# PHASE1-007: Implement health check + auto-cleanup of stale agents

Phase 1C implementation. Build health check capability that detects when an agent's backend (tmux pane) has died, and auto-cleanup that removes dead agents from config.

## Scope

1. Health check: query tmux to determine if an agent's pane is still alive
2. Report agent status: running, dead, unknown
3. Auto-cleanup: periodically or on-demand scan for dead agents and remove from config
4. Hook into agent launch to run cleanup before spawning (prevent name collisions)

## Acceptance Criteria

- [ ] Health check correctly identifies running vs dead agents
- [ ] Auto-cleanup removes dead agent entries from config.json
- [ ] Pre-launch cleanup prevents name collision issues
- [ ] Handles edge cases: tmux server not running, pane ID changed
- [ ] Unit tests for health check logic
- [ ] Integration test: spawn agent, kill tmux pane manually, verify auto-cleanup detects and cleans

## References

- Architecture MVP priority: `docs/specs/draft/agent-team-architecture.md` (health check + auto-cleanup)
- Stale entry problem: `.claude/behaviors/team-member-cleanup.md`
