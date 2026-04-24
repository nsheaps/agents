# Session Reconnection for Agent Teams

**Author**: Wile E. Coyote (AI Agent Eng)
**Date**: 2026-02-23
**Scope**: How to reconnect an orchestrator to an existing agent team when the session crashes or freezes
**Origin**: Failure during looney-toons-20260223 session

---

## Executive Summary

When an orchestrator session crashes or freezes, the teammates continue running in tmux. The orchestrator can reconnect using `--resume` with the correct session ID, but several parameters must match the team config exactly. A single typo in the team name or agent name silently creates a disconnected session where messaging and task list access fail without error.

---

## The Problem

Agent team sessions have a 1:1 mapping between:

- The **team name** (e.g., `looney-toons-20260223`)
- The **team config** at `~/.claude/teams/{team-name}/config.json`
- The **task list** at `~/.claude/tasks/{team-name}/`
- The **orchestrator's agent name** in the config (e.g., `team-lead`)

If any of these are mismatched during reconnection, the orchestrator starts in a state that _appears_ connected but cannot actually communicate with teammates or access the shared task list.

---

## Full Reconnection Procedure

### Step 1: Verify Teammates Are Alive

Before reconnecting, confirm the tmux session and teammate panes still exist:

```bash
# List all tmux panes (teammates run in panes)
tmux list-panes -a -F "#{pane_id} #{pane_title} #{pane_current_command} #{pane_pid}"

# Or check the specific tmux session
tmux list-windows -t agent-team    # adjust session name as needed
```

Each teammate runs as a separate `claude` process in its own tmux pane. The pane IDs are stored in the team config (`tmuxPaneId` field per member).

### Step 2: Read the Team Config

```bash
cat ~/.claude/teams/{team-name}/config.json
```

Note these critical values:

- `name` — the exact team name (used for `--team-name`)
- `leadAgentId` — the orchestrator's agent ID (format: `{name}@{team-name}`)
- `leadSessionId` — the session ID to resume
- `members[0].name` — the orchestrator's name (used for `--agent-name`)

### Step 3: Reconnect with Exact Parameters

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude \
  --resume {leadSessionId} \
  --team-name {exact-team-name} \
  --agent-name {exact-agent-name} \
  --teammate-mode auto \
  --dangerously-skip-permissions
```

**Every parameter must match the config exactly:**

| Parameter      | Must Match           | Where to Find                     |
| :------------- | :------------------- | :-------------------------------- |
| `--resume`     | `leadSessionId`      | `config.json` → `leadSessionId`   |
| `--team-name`  | `name`               | `config.json` → `name`            |
| `--agent-name` | Lead member's `name` | `config.json` → `members[0].name` |

### Step 4: Verify Reconnection

After reconnecting, immediately test:

1. **Task list access**: Run `TaskList` — you should see existing tasks
2. **Messaging**: Send a test message to a known-alive teammate
3. **Team config**: Read `~/.claude/teams/{team-name}/config.json` — should show current members

If any of these fail silently (no error but no results), the reconnection parameters are wrong.

---

## Common Pitfalls

### Pitfall 1: Team Name Typo (SILENT FAILURE)

**What happened in this session**: The user typed `looney-toons-2026-0223` (extra dash) instead of `looney-toons-20260223`.

**Result**: Claude Code created a _new_ empty team context instead of connecting to the existing one. The orchestrator had:

- No access to the existing task list
- No ability to send messages to existing teammates
- No error message indicating anything was wrong

**Why it's silent**: Claude Code doesn't validate that the team name corresponds to an existing team config. Any string is accepted, and if no config exists, it starts fresh.

**Prevention**: Always copy the team name directly from the config file rather than typing it from memory.

### Pitfall 2: Agent Name Mismatch

**What happened**: The user used `--agent-name main` instead of `--agent-name team-lead`.

**Result**: The orchestrator connected to the team but was not recognized as the lead. Messages sent "from" the orchestrator had the wrong sender identity, and teammates may not recognize or route responses correctly.

**Why it matters**: The `name` field in the team config's member entry is the identity used for all messaging. If the orchestrator reconnects with a different name, it's effectively a different entity.

**Prevention**: Always check `config.json` → `members[0].name` for the lead's exact name.

### Pitfall 3: Resuming Without `--resume`

**What happened**: If you launch without `--resume {sessionId}`, the orchestrator starts a fresh session with no conversation history. It doesn't know what work has been done, what tasks exist, or what teammates have reported.

**Impact**: The orchestrator must re-read all context, re-check task list, and essentially restart coordination from scratch — while teammates retain their full context.

**Prevention**: Always use `--resume` with the `leadSessionId` from the config.

### Pitfall 4: Teammates Died While Orchestrator Was Down

If the tmux session itself crashed (not just the orchestrator), all teammates are gone. Reconnecting the orchestrator won't bring them back.

**Verification**:

```bash
# Check if teammate processes are running
tmux list-panes -a -F "#{pane_id} #{pane_pid} #{pane_current_command}"

# Cross-reference pane IDs with config
jq '.members[] | {name, tmuxPaneId, isActive}' ~/.claude/teams/{team-name}/config.json
```

If panes are gone, teammates must be relaunched. The team config still has their definitions, but their conversation context is lost.

---

## Diagnostic Checklist

When reconnection seems to work but something is off:

| Symptom                                            | Likely Cause                                             | Fix                                                    |
| :------------------------------------------------- | :------------------------------------------------------- | :----------------------------------------------------- |
| `TaskList` returns empty                           | Wrong team name (pointing to empty/nonexistent task dir) | Check `--team-name` matches config exactly             |
| `SendMessage` succeeds but teammate never responds | Wrong team name (messages going to void)                 | Check `--team-name` matches config exactly             |
| Teammates don't recognize you                      | Wrong `--agent-name`                                     | Check `--agent-name` matches config's lead member name |
| No conversation history                            | Missing `--resume`                                       | Add `--resume {leadSessionId}`                         |
| "Team not found" error                             | Team config deleted or moved                             | Check `~/.claude/teams/` for the config file           |
| Teammate panes show "exited"                       | Teammate processes crashed                               | Must relaunch teammates (context lost)                 |

---

## Reconnection Script (Recommended)

Rather than typing parameters manually, create a reconnection helper:

```bash
#!/usr/bin/env bash
# reconnect-team.sh — reconnect orchestrator to existing team
set -euo pipefail

TEAM_NAME="${1:?Usage: reconnect-team.sh <team-name>}"
CONFIG="$HOME/.claude/teams/$TEAM_NAME/config.json"

if [ ! -f "$CONFIG" ]; then
  echo "ERROR: Team config not found at $CONFIG" >&2
  echo "Available teams:" >&2
  ls "$HOME/.claude/teams/" 2>/dev/null || echo "  (none)" >&2
  exit 1
fi

SESSION_ID=$(jq -r '.leadSessionId' "$CONFIG")
AGENT_NAME=$(jq -r '.members[0].name' "$CONFIG")

echo "Reconnecting to team: $TEAM_NAME"
echo "  Session ID: $SESSION_ID"
echo "  Agent name: $AGENT_NAME"
echo "  Config: $CONFIG"
echo ""

# Verify teammates are alive
ALIVE_COUNT=$(jq '[.members[] | select(.tmuxPaneId != null)] | length' "$CONFIG")
echo "  Teammates in config: $ALIVE_COUNT"

# Check tmux panes
if command -v tmux &>/dev/null; then
  PANE_COUNT=$(tmux list-panes -a -F "#{pane_id}" 2>/dev/null | wc -l | tr -d ' ')
  echo "  Active tmux panes: $PANE_COUNT"
fi

echo ""
echo "Launching..."

export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
exec claude \
  --resume "$SESSION_ID" \
  --team-name "$TEAM_NAME" \
  --agent-name "$AGENT_NAME" \
  --teammate-mode auto \
  --dangerously-skip-permissions \
  "${@:2}"
```

Usage:

```bash
./reconnect-team.sh looney-toons-20260223
# Optionally pass additional flags:
./reconnect-team.sh looney-toons-20260223 --append-system-prompt "extra context"
```

This eliminates typo risk by reading all parameters directly from the config.

---

## Architecture Notes

### Why Silent Failures Happen

Claude Code's `--team-name` parameter does not validate against existing configs. It's treated as a namespace identifier:

- If the team config exists → connects to it
- If it doesn't exist → creates a new empty context
- No warning in either case

This is by design (allows creating new teams on the fly) but is a footgun for reconnection.

### What the Config Stores

```
~/.claude/teams/{team-name}/
└── config.json
    ├── name                  # Team name
    ├── leadAgentId           # "{name}@{team-name}"
    ├── leadSessionId         # Session ID for --resume
    └── members[]
        ├── agentId           # "{name}@{team-name}"
        ├── name              # Display name (used for messaging)
        ├── agentType         # Agent definition name
        ├── tmuxPaneId        # Tmux pane where teammate runs
        ├── isActive          # Whether teammate is responsive
        └── ...
```

### Task List Location

```
~/.claude/tasks/{team-name}/
└── *.json                    # Individual task files
```

The task list directory name must match the team name exactly. A typo in `--team-name` points to a different (likely empty) task directory.

---

## Recommendations

1. **Use the reconnection script** instead of manual flag construction
2. **Add the script to `bin/`** in agent-team for easy access
3. **Consider a `claude team reconnect` CLI command** — file upstream as a feature request
4. **Add team name validation** — a pre-session hook could verify the team config exists before starting
5. **Tab-complete team names** — the reconnection script could offer tab completion from `~/.claude/teams/`

---

## Related Failures

- **Failure #22** (this session): Orchestrator reconnected with wrong team name, causing silent disconnection
- **Failure #21**: `settings.json` truncation — another example of silent failure in Claude Code configuration

## Sources

- Team config: `~/.claude/teams/looney-toons-20260223/config.json`
- Launch script: `bin/run-claude-team-persistent`
- [Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
