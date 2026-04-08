---
name: agent-harness-lifecycle
status: draft
description: Reusable launcher template for AI agents with restart loop, secret injection, and tmux integration
parent:
related:
  - plugin-system-design
  - auth-credentials
owner: jack
created: 2026-04-07
updated: 2026-04-07
tags:
  - infrastructure
  - agent-lifecycle
  - launcher
---
# Agent Harness Lifecycle

## Problem Statement

Each AI agent (Jack, Henry, Pamela) needs a reliable launcher that handles session
restarts, secret injection, prompt continuity across restarts, and tmux integration.
Currently this logic lives only in Jack's `bin/agent` script and must be extracted
into a reusable template before new agents can be set up reliably.

## Design Decisions

1. **Restart loop pattern**: The launcher runs `claude` inside a `while true` loop so
   sessions restart automatically on exit. A configurable delay (0–20 s) between restarts
   prevents tight crash loops. Source: direct analysis of
   `nsheaps/.ai-agent-jack/bin/agent`.

2. **Self-re-exec after each restart**: The launcher re-execs itself (`exec "$0" "$@"`)
   after each `claude` exit so that changes the agent made to `bin/agent` during the
   session take effect on the next start. Source: `bin/agent` source analysis.

3. **Continuation prompt**: Before a session ends the agent writes a continuation note
   to `.claude/prompts/CONTINUATION.md`. The launcher passes this file as the initial
   prompt on the next restart, preserving task state across session boundaries.
   Source: `bin/agent` source analysis.

4. **Fast-restart flag**: `.claude/tmp/fast-restart` (contains 0–20, default applied)
   lets the agent request a short delay for intentional restarts vs the longer default
   for crash recovery. Source: `bin/agent` source analysis.

5. **One-time restart flags**: `.claude/tmp/restart-flags` carries extra CLI flags for
   the next restart only (e.g., `--dangerously-skip-permissions`). Cleared after use.
   Source: `bin/agent` source analysis.

6. **Permission mode persistence**: `.claude/tmp/permission-mode` preserves the
   current `--permission-mode` across restarts so the agent does not forget its mode.
   Source: `bin/agent` source analysis.

7. **Crash detection**: If `claude` exits in under 10 s the launcher logs a warning and
   rolls back `bin/agent` to the last committed version to prevent a modified launcher
   from causing repeated instant crashes. Source: `bin/agent` source analysis.

8. **Signal trapping**: The launcher traps all common signals and logs them for
   debugging. Source: `bin/agent` source analysis.

9. **Restart history log**: Each restart is logged with timestamp, HEAD commit hash, and
   reason to `.claude/tmp/restart-history.log`. Source: `bin/agent` source analysis.

10. **Self-launch guard**: A sentinel prevents the agent from accidentally recursively
    launching itself from inside a session (e.g., via a hook or tool call).
    Source: `bin/agent` source analysis.

11. **Scheduled task restore on startup**: On each session start the agent reads
    `.claude/scheduled-tasks.yaml` and recreates enabled crons via CronCreate, with a
    catch-up check for missed fires during the restart gap.
    Source: `.claude/rules/scheduled-tasks.md` in ai-agent-jack.

12. **Reusable agent template tracked as jack#27**: Extracting the above patterns from
    Jack's `bin/agent` into a shared template is the prerequisite for setting up Henry
    and Pamela reliably. Source: nsheaps/.ai-agent-jack issue #27.

## Open Questions

- Should the reusable launcher live in `nsheaps/agents` (the orchestration repo) or in
  each agent's own repo? The agents monorepo vision (agents#111) implies the former,
  but Jack's launcher is currently repo-local.
- What is the canonical template format? A shell script? A TypeScript CLI? The agents
  binary is currently non-functional (agents#18).
- Should `bin/agent` be absorbed into the `agents` binary, or remain a standalone
  reference implementation?

## References

- `nsheaps/.ai-agent-jack/bin/agent` — current reference implementation
- nsheaps/.ai-agent-jack issues: #27 (reusable template), #50 (delegate mode),
  #53 (self-healing hooks), #54 (pre-load plugins before execution)
- nsheaps/agents issues: #18 (launch/relaunch are no-ops), #111 (monorepo vision)
- `docs/research/agent-teams-infrastructure.md` in ai-agent-jack
- `.claude/rules/scheduled-tasks.md` in ai-agent-jack
