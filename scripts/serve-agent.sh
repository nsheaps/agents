#!/usr/bin/env bash
# scripts/serve-agent.sh — Tiltfile serve_cmd wrapper for agent tmux sessions
#
# Usage:
#   scripts/serve-agent.sh <agent-name> <agent-repo-path>
#
# Examples:
#   scripts/serve-agent.sh alex /home/nsheaps/src/nsheaps/.ai-agent-alex
#   scripts/serve-agent.sh jack /home/nsheaps/src/nsheaps/.ai-agent-jack
#
# This script is NOT bin/agent. It manages the tmux session lifecycle around
# bin/agent, which runs INSIDE the tmux session with --no-tmux.
#
# Lifecycle:
#   1. If the tmux session doesn't exist → create it and launch bin/agent --no-tmux
#   2. If the session exists but the agent isn't running → kill the dead pane,
#      open a new one, and relaunch bin/agent --no-tmux
#   3. If the session exists and is running → stream its output to stdout (for Tilt)
#
# The script streams tmux pane output to stdout so Tilt captures it in the dashboard.
# It blocks until the tmux session exits (agent stops), at which point Tilt's
# serve_cmd restart logic takes over.
#
# Environment variables unset before launching cross-agent sessions (per agent-management
# skill) to prevent credential leakage between agents:
#   AGENT_LAUNCHER_PID, AGENT_NAME, OP_SERVICE_ACCOUNT_TOKEN,
#   DISCORD_BOT_TOKEN, TELEGRAM_BOT_TOKEN, DISCORD_ALLOW_BOTS,
#   GH_TOKEN, GITHUB_TOKEN, BRAINTRUST_API_KEY,
#   GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_PRIVATE_KEY_PATH,
#   GITHUB_INSTALLATION_ID, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET

set -euo pipefail

AGENT_NAME="${1:?Usage: serve-agent.sh <agent-name> <agent-repo-path>}"
AGENT_REPO="${2:?Usage: serve-agent.sh <agent-name> <agent-repo-path>}"
SESSION="$AGENT_NAME"
BIN_AGENT="$AGENT_REPO/bin/agent"

log() {
  echo "[serve-agent:$AGENT_NAME] $*"
}

die() {
  echo "[serve-agent:$AGENT_NAME] ERROR: $*" >&2
  exit 1
}

# Validate the agent repo and binary exist.
[[ -d "$AGENT_REPO" ]] || die "Agent repo not found: $AGENT_REPO"
[[ -f "$BIN_AGENT" ]] || die "bin/agent not found: $BIN_AGENT"

# Build the env -u flags to strip cross-agent credentials.
UNSET_VARS=(
  AGENT_LAUNCHER_PID
  AGENT_NAME
  OP_SERVICE_ACCOUNT_TOKEN
  DISCORD_BOT_TOKEN
  TELEGRAM_BOT_TOKEN
  DISCORD_ALLOW_BOTS
  GH_TOKEN
  GITHUB_TOKEN
  BRAINTRUST_API_KEY
  GITHUB_APP_ID
  GITHUB_APP_PRIVATE_KEY
  GITHUB_APP_PRIVATE_KEY_PATH
  GITHUB_INSTALLATION_ID
  GITHUB_APP_CLIENT_ID
  GITHUB_APP_CLIENT_SECRET
)

build_env_unset_args() {
  local args=()
  for var in "${UNSET_VARS[@]}"; do
    args+=(-u "$var")
  done
  printf '%s\n' "${args[@]}"
}

# Assemble the launch command that runs inside the tmux pane.
# env strips cross-agent credentials; bin/agent re-injects its own via 1Password.
build_launch_cmd() {
  local env_args
  env_args="$(build_env_unset_args | tr '\n' ' ')"
  echo "env $env_args bash '$BIN_AGENT' --no-tmux"
}

agent_running_in_session() {
  # Returns 0 if the tmux session has an active process in its pane.
  # We check by looking for a running child process (not just the shell).
  local pane_pid
  pane_pid="$(tmux list-panes -t "$SESSION" -F '#{pane_pid}' 2>/dev/null | head -1)" || return 1
  [[ -z "$pane_pid" ]] && return 1
  # If pstree shows 'claude' or 'bin/agent' under the pane PID, agent is running.
  pstree -p "$pane_pid" 2>/dev/null | grep -qE 'claude|agent' || return 1
}

launch_agent_in_new_pane() {
  local launch_cmd
  launch_cmd="$(build_launch_cmd)"
  log "Launching bin/agent --no-tmux in tmux session '$SESSION'"
  tmux send-keys -t "$SESSION" "$launch_cmd" Enter
}

# --- Main lifecycle ---

if tmux has-session -t "$SESSION" 2>/dev/null; then
  log "Session '$SESSION' already exists"
  if agent_running_in_session; then
    log "Agent is running — streaming output"
  else
    log "Session exists but agent is not running — relaunching"
    # Kill the dead pane and open a fresh one.
    tmux respawn-pane -t "$SESSION" -k 2>/dev/null || true
    launch_agent_in_new_pane
  fi
else
  log "Creating new tmux session '$SESSION'"
  tmux new-session -d -s "$SESSION" -c "$AGENT_REPO"
  launch_agent_in_new_pane
fi

# Stream the tmux pane output to stdout so Tilt captures it.
# -F polls the pane every 250ms; we loop until the session disappears.
log "Streaming tmux output (Ctrl+C or 'tilt down $AGENT_NAME' to stop)"
while tmux has-session -t "$SESSION" 2>/dev/null; do
  tmux capture-pane -t "$SESSION" -p -e 2>/dev/null || true
  sleep 0.25
done

log "Session '$SESSION' ended — serve-agent exiting"
