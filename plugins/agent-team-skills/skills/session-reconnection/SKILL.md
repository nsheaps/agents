# Reconnecting to a Frozen Agent Team Session

How to recover when a Claude Code agent team session crashes, freezes, or disconnects.

## When to Reconnect

Use this procedure when:

- The terminal running the lead session closed unexpectedly
- Claude Code crashed or became unresponsive
- Your SSH or remote connection dropped
- A tmux session was detached (not killed)
- The lead session is running but teammates are not responding

**Key constraint**: Reconnecting a lead session does NOT restore teammate processes. Teammates must be re-spawned after reconnecting. Only the lead's conversation history and team awareness are restored by `--resume`.

## Step-by-Step Reconnection

### Step 1 -- Verify tmux is still running

```bash
tmux list-sessions
```

If you see your session (e.g., `agent-team: 1 windows`), the session is alive. If not, the session was killed and you need a fresh start (see "Full Restart" below).

### Step 2 -- Read the team config to confirm team state

```bash
cat ~/.claude/teams/<team-name>/config.json
```

Check:
- `leadSessionId` -- the session UUID you need for `--resume`
- `members` -- which teammates were registered

If config.json is missing or corrupted, the team state is lost and you need a full restart.

### Step 3 -- Get the lead session ID

The session ID is in `config.json` under `leadSessionId`. It looks like a UUID:

```
"leadSessionId": "053d3c48-84a5-4fe2-a849-b4840e386210"
```

You can also find session IDs by listing project files:

```bash
ls ~/.claude/projects/<encoded-cwd>/
```

The encoded CWD replaces `/` with `-` (e.g., `/Users/name/src/repo` becomes `-Users-name-src-repo`).

### Step 4 -- Reconnect with --resume

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --resume <session-id> --dangerously-skip-permissions
```

Or, if using the `bin/run-claude-team-persistent` helper script:

```bash
bin/run-claude-team-persistent --resume <session-id>
```

The lead session will start with its prior conversation context intact.

### Step 5 -- Re-spawn teammates

After reconnecting, the lead's conversation will show the prior state, but teammates are gone. Re-spawn each teammate using `Task` with the same `team_name` and `name` as the original session:

```
Task(
  description: "Resume your prior work. Read .claude/tmp/ for any reports from the previous session.",
  team_name: "<team-name>",
  name: "<teammate-display-name>",
  agent: "<agent-type>",
  teammate_mode: "auto",
  permission_mode: "bypassPermissions"
)
```

Use the exact same display names as the original session. The team config still has the old member entries -- re-using the same names avoids creating duplicate entries.

## Common Pitfalls

### Team name typo -- silent failure

If you pass the wrong `team_name` to `TeamCreate` or `Task`, it creates a new team with that name instead of joining the existing one. There is no error. Always copy the team name from `config.json` rather than typing it from memory.

### Agent name mismatch

`SendMessage` silently succeeds for non-existent recipients. If re-spawned teammates use different display names than the original session, messages sent to the old names will be silently dropped into orphaned inbox files.

**Check the original names:**

```bash
cat ~/.claude/teams/<team-name>/config.json | grep '"name"'
```

Use those exact names when re-spawning.

### Missing --resume

Launching the lead without `--resume` creates a new session with no team context. The lead will not know it was previously part of a team. Always use `--resume <session-id>` when reconnecting.

### Inbox polling may not reinitialize

Known issue: after session resume, inbox polling for teammates may not restart properly. See [GitHub #23415](https://github.com/anthropics/claude-code/issues/23415). If teammates launch but never receive messages, try restarting the team from scratch.

## Diagnostic Checklist

| Symptom                                  | Likely Cause                                   | Fix                                                        |
| :--------------------------------------- | :--------------------------------------------- | :--------------------------------------------------------- |
| tmux session missing                     | Session was killed                             | Full restart -- create new team and spawn all teammates    |
| Lead starts but has no team context      | Launched without `--resume`                    | Relaunch with `--resume <session-id>`                      |
| Teammates launched but not responding    | Inbox polling issue                            | Check `~/.claude/teams/<name>/inboxes/` for unread messages |
| Messages sent but never received         | Wrong recipient name                           | Check config.json for exact display names                  |
| config.json exists but leadSessionId wrong | Lead was restarted without cleanup           | Use the current session ID or do a full restart            |
| Team tools (SendMessage) not available   | Session not in team context                    | Verify `--resume` was used and team is in session state    |

## Reconnection Script

Save this as a quick reconnect helper:

```bash
#!/usr/bin/env bash
# reconnect-team.sh -- reconnect to an existing agent team session
set -euo pipefail

TEAM_NAME="${1:?Usage: reconnect-team.sh <team-name>}"
CONFIG="$HOME/.claude/teams/$TEAM_NAME/config.json"

if [[ ! -f "$CONFIG" ]]; then
  echo "Error: no team config found at $CONFIG"
  exit 1
fi

SESSION_ID=$(jq -r '.leadSessionId' "$CONFIG")

if [[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]]; then
  echo "Error: no leadSessionId in $CONFIG"
  exit 1
fi

echo "Reconnecting to team '$TEAM_NAME', session $SESSION_ID"
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 \
  claude --resume "$SESSION_ID" --dangerously-skip-permissions
```

Usage:

```bash
chmod +x reconnect-team.sh
./reconnect-team.sh my-team
```

## Full Restart (When Reconnection Is Not Possible)

If the tmux session was killed, config.json is missing, or the session ID is unknown:

1. Clean up stale state (optional but recommended):
   ```bash
   rm -rf ~/.claude/teams/<team-name>
   rm -rf ~/.claude/tasks/<team-name>
   ```

2. Launch a fresh Claude Code session:
   ```bash
   CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions
   ```

3. Create a new team and spawn all teammates from scratch.

Task files from the old session are lost if you remove the tasks directory. If you want to preserve them, copy `~/.claude/tasks/<team-name>/` before deleting.

## References

- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Team Launch Without TeamCreate Research](../../docs/research/claude-code-team-launch-without-teamcreate.md) -- why --resume restores lead but not teammates
- [Team Storage Internals](../../docs/research/team-storage-internals.md) -- config.json schema, inbox file naming
- [GitHub #23415](https://github.com/anthropics/claude-code/issues/23415) -- inbox polling failure after session resume
- [tmux Usage Skill](../tmux-usage/SKILL.md) -- tmux session management
