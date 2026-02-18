---
id: PHASE1-012
title: "Make team name customizable (not hardcoded)"
status: open
assignee: Bugs Bunny (Software Eng)
priority: high
phase: 1
blocked_by: [PHASE1-002]
blocks: []
created: 2026-02-17
updated: 2026-02-17
task_id: "125"
---

# PHASE1-012: Make team name customizable (not hardcoded)

The team name should be a configurable parameter, not hardcoded. The launcher/orchestrator must accept a team name and propagate it to all agent spawning and team management operations.

## Scope

1. Add `team_name` as a required parameter to the agent launcher
2. Pass team name to `TeamCreate` and all `Task` tool invocations with `team_name`
3. Use team name in config file paths (`~/.claude/teams/{team-name}/`)
4. Default value: derive from project directory name or require explicit parameter
5. Ensure no hardcoded references to "looney-tunes" or "agent-team" remain in launcher code

## Acceptance Criteria

- [ ] Launcher accepts `--team-name` parameter (or equivalent)
- [ ] Team name propagated to all team creation and agent spawning calls
- [ ] Config paths use the provided team name
- [ ] Sensible default when no team name is provided
- [ ] Unit test: different team names produce correct config paths

## References

- Current hardcoded team name in claude-team: `~/src/nsheaps/claude-utils/bin/claude-team`
- Agent launcher spec: `docs/specs/draft/agent-launcher.md` (will include this requirement)
