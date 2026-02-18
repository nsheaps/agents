---
name: lifecycle-management
description: |
  Correct procedures for spawning, shutting down, and cleaning up agents in a team session. Use this behavior whenever managing agent lifecycle — spawning new teammates, shutting down agents, cleaning up after crashes, or tearing down a team. Prevents orphan processes, stale config entries, name collisions, and config corruption.
---

# Lifecycle Management

Procedures for correctly managing agent lifecycle in team sessions. Every teammate who spawns, shuts down, or cleans up agents must follow these procedures.

## Why This Exists

Failure #11 (session 3) documented four interconnected lifecycle failures:

- Manual config edits created state inconsistencies
- Dead agents left `isActive: true`, blocking team cleanup
- Overloaded spawn prompts mixed identity with task assignments
- Stale config members caused `-2` name suffixes on re-spawn

Daffy's Phase 1 code review (DEF-5, DEF-6, DEF-7, DEF-10) identified gaps in cleanup, health-check, kill, and name-matching operations. These have since been fixed (`f2fe867`, `9a7354b`). The procedures below remain the team's standard operating procedures for lifecycle management.

## Procedures

### Spawning an Agent

1. **Check for stale members first.** Before spawning, verify the name isn't already in the team config as a stale entry. If it is, clean it up before spawning.
2. **Spawn prompt = role only.** The Task tool prompt should contain only:
   - The agent's identity and role
   - Where to find project docs (`.claude/docs/`)
   - Standing instructions (e.g., "message team lead when ready")
3. **Send tasks separately.** After the agent reports ready, send task assignments via `SendMessage`. This keeps identity persistent and tasks transient.
4. **Verify the spawn succeeded.** Check that the agent appears in team config with the expected name (no `-2` suffix).

**Anti-patterns:**

- Putting task details in the spawn prompt (mixes concerns, wastes context)
- Spawning without checking for name collisions (causes `-2` suffix)
- Spawning many agents at once (causes context bloat on the lead — limit to 3-4 concurrent)

### Shutting Down an Agent

1. **Always use `SendMessage` with `type: "shutdown_request"`.** This gives the agent a chance to save state, complete in-progress work, and acknowledge.
2. **Wait for the shutdown response.** The agent should respond with `type: "shutdown_response"` and `approve: true`.
3. **Verify removal from config.** After shutdown, confirm the agent's `isActive` is set to `false` or the member is removed from config.

**Anti-patterns:**

- Killing tmux panes directly without shutdown request (leaves `isActive: true` in config)
- Assuming shutdown succeeded without verifying config state
- Manually editing `config.json` to remove members

### Handling Crashed/Dead Agents

When an agent dies without proper shutdown (crash, disconnect, tmux pane killed externally):

1. **Detect the failure.** Signs include: agent stops responding to messages, tmux pane is gone, idle notification never arrives.
2. **If the agent is stuck mid-turn (pane exists but agent is unresponsive):** Send the ESC key via tmux to interrupt its current turn and allow pending messages to propagate: `tmux send-keys -t <pane-id> Escape`
3. **Report to AI Agent Eng and team lead.** This is a process failure worth recording.
4. **Do NOT manually edit config.json.** Instead:
   - Try sending a `shutdown_request` — if the agent is truly dead, this will fail silently but won't corrupt config.
   - If the agent can't be reached and config shows `isActive: true`, ask the team lead to coordinate cleanup.
4. **Team lead cleanup procedure:**
   - Verify the agent is actually dead (check tmux panes, check for recent messages)
   - Use the launcher's cleanup command (`cleanupStaleEntries`) — it checks tmux pane liveness and removes dead entries automatically

**Resolved (DEF-10, `f2fe867`):** `killAgent` now kills the tmux pane via `tmuxPaneId` before removing the config entry. Orphan process cleanup is automatic when the pane ID is tracked.

### Tearing Down a Team

1. **Shut down all agents first.** Send `shutdown_request` to each active member and wait for responses.
2. **Verify all members are inactive.** `TeamDelete` will fail if any member has `isActive: true`.
3. **Then call `TeamDelete`.** Only after all members are confirmed shut down.

**Anti-patterns:**

- Calling `TeamDelete` before shutting down agents (will fail)
- Manually editing config to set `isActive: false` to force `TeamDelete` (hides real state)

### Re-spawning an Agent (Kill + Relaunch)

1. **Shut down the existing agent** using the shutdown request flow above.
2. **Verify the old entry is gone** from config.
3. **Spawn the new agent** with a fresh spawn prompt.
4. **Known issue (DEF-9):** The launcher's `relaunch` command does NOT re-discover agent files after kill. If you've edited the agent file, use separate kill + launch commands instead of relaunch.

## Config.json Is Managed State

**Never manually edit** `~/.claude/teams/{team-name}/config.json`.

This file is managed by Claude Code's team primitives (`TeamCreate`, `SendMessage`, Task tool spawn). Manual edits bypass validation, can create states the primitives don't expect, and make it impossible to reason about config consistency.

If you find yourself wanting to edit config.json, something has gone wrong in the lifecycle. Report it to the AI Agent Eng and team lead.

## Resolved Code Limitations

These defects were found in Daffy's Phase 1 code review and have been fixed:

| Defect                                      | Fix                                                                   | Commit    |
| :------------------------------------------ | :-------------------------------------------------------------------- | :-------- |
| DEF-5: `cleanupStaleEntries` was a no-op    | Now checks `isTmuxPaneAlive` and removes dead entries                 | `f2fe867` |
| DEF-6: Health check always reported UNKNOWN | `listAgents` now reports RUNNING/DEAD based on `tmuxPaneId` liveness  | `f2fe867` |
| DEF-7: Name mismatch in `listAgents`        | New `agentName` field on `TeamMember` enables file/config correlation | `9a7354b` |
| DEF-10: `killAgent` didn't kill tmux pane   | `killAgent` now calls `killTmuxPane` when pane ID is present          | `f2fe867` |

## Quality Standards

- Every spawn should result in exactly one config entry with the expected name
- Every shutdown should result in `isActive: false` or member removal
- No orphan tmux panes should exist after team teardown
- Config.json should never be touched by hand

## References

- Failure #11 analysis: `.claude/tmp/ai-agent-eng-failure-log.md`
- QA code review: `.claude/tmp/qa-phase1-code-review.md` (DEF-5, DEF-6, DEF-7, DEF-9, DEF-10)
- Agent launcher spec: `docs/specs/draft/agent-launcher.md` (§6 lifecycle management)
- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
