---
id: PHASE1-006
title: "Implement: agent kill + team config cleanup"
status: open
assignee: Bugs Bunny (Software Eng)
priority: high
phase: 1
blocked_by: [PHASE1-005]
blocks: [PHASE1-007]
created: 2026-02-17
updated: 2026-02-17
task_id: "109"
---

# PHASE1-006: Implement agent kill + team config cleanup

Phase 1C implementation. Build the kill command that cleanly terminates an agent and removes it from team configuration, solving the stale entry problem.

## Scope

1. Kill an agent by name: find its tmux pane and terminate it
2. Remove the agent from `~/.claude/teams/{team-name}/config.json`
3. Handle the case where the tmux pane is already dead
4. Handle the case where the agent is in the config but not running
5. Ensure no `-2` suffix entries are left behind after kill + relaunch

## Acceptance Criteria

- [ ] Kill command terminates the agent's tmux pane
- [ ] Agent entry removed from team config.json
- [ ] Handles already-dead agents gracefully (no error, just cleanup)
- [ ] Handles agents in config but not running (orphaned entries)
- [ ] No stale entries left in config after kill
- [ ] Integration test: spawn agent, kill it, verify config is clean

## References

- Stale entry problem: `.claude/behaviors/team-member-cleanup.md`
- Architecture MVP priority: `docs/specs/draft/agent-team-architecture.md` (Section "MVP Priority")
- Current manual cleanup: jq-based procedure in team-member-cleanup behavior
