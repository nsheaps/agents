---
id: PHASE1-008
title: "Implement: agent list + agent relaunch commands"
status: open
assignee: Bugs Bunny (Software Eng)
priority: medium
phase: 1
blocked_by: [PHASE1-007]
blocks: [PHASE1-010]
created: 2026-02-17
updated: 2026-02-17
task_id: "113"
---

# PHASE1-008: Implement agent list + agent relaunch commands

Phase 1C implementation. Build list and relaunch commands that complete the agent lifecycle management.

## Scope

1. List command: show all agents (from config + discovered files), their status (running/dead/not-spawned), and metadata
2. Relaunch command: kill an existing agent (if running) and spawn it again with same or updated config
3. Relaunch must not create `-2` suffix entries — clean kill + fresh spawn
4. Support relaunching with updated agent definition (re-read `.claude/agents/*.md`)

## Acceptance Criteria

- [ ] List shows all discovered agents with status (running, dead, not-spawned)
- [ ] List shows agent metadata (name, role, model, permissions)
- [ ] Relaunch cleanly kills and respawns without stale entries
- [ ] Relaunch picks up updated agent definitions from file
- [ ] Integration test: spawn, modify agent file, relaunch, verify new config applied

## References

- Agent launcher spec: `docs/specs/draft/agent-launcher.md` (once written)
- Architecture MVP priority: `docs/specs/draft/agent-team-architecture.md`
