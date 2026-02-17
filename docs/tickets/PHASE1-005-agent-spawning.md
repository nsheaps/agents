---
id: PHASE1-005
title: "Implement: agent spawning via Claude CLI (Claude Code backend)"
status: open
assignee: Bugs Bunny (Software Eng)
priority: high
phase: 1
blocked_by: [PHASE1-004]
blocks: [PHASE1-006]
created: 2026-02-17
updated: 2026-02-17
task_id: "107"
---

# PHASE1-005: Implement agent spawning via Claude CLI

Phase 1B implementation. Build the spawning module that launches agents using the Claude Code CLI, replacing manual Task tool invocations.

## Scope

1. Construct `claude` CLI command from agent definition (model, permissions, prompt, flags)
2. Launch agent as teammate via `--teammate-mode tmux` (or in-process)
3. Pass assembled prompt via `--append-system-prompt` (or `--system-prompt` if available)
4. Set appropriate permission mode (`--permission-mode delegate`, `--dangerously-skip-permissions`, etc.)
5. Set environment variables (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
6. Track spawned agent PID/tmux pane for lifecycle management

## Acceptance Criteria

- [ ] Constructs valid `claude` CLI command from agent definition
- [ ] Spawns agent in tmux pane successfully
- [ ] Agent receives correct system prompt content
- [ ] Agent has correct permission mode
- [ ] Spawned agent info recorded (PID, tmux pane ID, agent name)
- [ ] Integration test: spawn an agent, verify it's running, verify prompt content

## References

- Agent launcher spec: `docs/specs/draft/agent-launcher.md` (once written)
- Current spawning: `~/src/nsheaps/claude-utils/bin/claude-team` (hardcoded orchestrator)
- Teammate launch research: `.claude/tmp/teammate-launch-research.md`
