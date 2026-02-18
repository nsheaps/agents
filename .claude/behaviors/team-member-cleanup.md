---
name: team-member-cleanup
description: Procedure for detecting and removing stale team members from the team config when agents crash, get killed, or fail to shut down cleanly. Use when team config shows members whose tmux panes no longer exist.
---

# Team Member Cleanup

Procedure for detecting and removing stale teammates from `~/.claude/teams/{team-name}/config.json`. Stale entries occur when an agent's tmux pane is killed externally or the agent crashes without processing a shutdown request.

## When to Use

- A teammate's tmux pane was killed by the user or crashed
- A `shutdown_request` was sent but the agent didn't respond (pane already gone)
- The team config shows `isActive: true` for an agent whose pane no longer exists
- Spawning a new agent with the same name results in a `-2`, `-3`, etc. suffix

## Why This Happens

Claude Code's agent teams system tracks members in `config.json`. When a teammate shuts down cleanly (via `shutdown_request` → `shutdown_response`), the system removes or deactivates the entry. But when a pane is killed externally (`tmux kill-pane`, user closes it, or crash), the system has no way to detect the agent is gone. The config entry becomes stale.

## Detection

### Step 1: List active tmux panes

```bash
tmux list-panes -a -F '#{pane_id} #{pane_title}'
```

### Step 2: Compare against team config

```bash
jq '.members | map({name, tmuxPaneId, isActive}) | map(select(.isActive == true))' \
  ~/.claude/teams/{team-name}/config.json
```

### Step 3: Identify stale entries

Any member with `isActive: true` whose `tmuxPaneId` does NOT appear in the tmux pane list is stale.

## Cleanup Procedure

### Option A: Shutdown request (preferred)

If the agent might still be alive (pane exists but agent is unresponsive):

```
SendMessage type: shutdown_request, recipient: "{agent-name}"
```

Wait 10-15 seconds. If the agent responds, the system cleans up automatically.

### Option B: Manual config edit (when pane is gone)

When the pane no longer exists and shutdown_request cannot be processed:

```bash
# Remove specific stale member by name
jq '.members = [.members[] | select(.name == "STALE_AGENT_NAME" | not)]' \
  ~/.claude/teams/{team-name}/config.json > /tmp/team-config-clean.json

# Verify the right entry was removed
jq '.members | map(.name)' /tmp/team-config-clean.json

# Apply
cp /tmp/team-config-clean.json ~/.claude/teams/{team-name}/config.json
```

### Option C: Bulk cleanup of all dead entries

```bash
# Get list of active pane IDs
ACTIVE_PANES=$(tmux list-panes -a -F '#{pane_id}' | tr '\n' '|' | sed 's/|$//')

# Remove members whose panes are gone (keep non-tmux members like team-lead)
jq --arg panes "$ACTIVE_PANES" '
  .members = [.members[] | select(
    .backendType != "tmux" or
    .tmuxPaneId == "" or
    (.tmuxPaneId | test($panes))
  )]' ~/.claude/teams/{team-name}/config.json > /tmp/team-config-clean.json
```

## After Cleanup

After removing stale entries, you can spawn a fresh agent with the same name without getting numeric suffixes (`-2`, `-3`).

## Tool Status

The following capabilities have been implemented in `src/lifecycle.ts`:

| Capability | Function | Status |
|:--|:--|:--|
| Remove member by name | `removeMember()` / `killAgent()` | Implemented (`f2fe867`) |
| List with live/dead status | `listAgents()` — reports RUNNING/DEAD/UNKNOWN | Implemented (`f2fe867`) |
| Auto-cleanup stale entries | `cleanupStaleEntries()` — checks pane liveness, removes dead | Implemented (`f2fe867`) |
| File/config name correlation | `listAgents()` via `agentName` field on `TeamMember` | Implemented (`9a7354b`) |
| Graceful crash handling | Not yet — system does not auto-detect pane exits | Still needed |

**Note**: The manual cleanup procedures above (Options A/B/C) remain valid as fallbacks when the programmatic tools are unavailable (e.g., CLI not built yet, or running outside the launcher context).

## References

- [Claude Code Agent Teams docs](https://code.claude.com/docs/en/agent-teams)
- [GitHub Issue #23615: tmux send-keys garbling](https://github.com/anthropics/claude-code/issues/23615) — related tmux backend issues
- [GitHub Issue #24771: panes open but teammates disconnected](https://github.com/anthropics/claude-code/issues/24771) — teammate lifecycle bugs
