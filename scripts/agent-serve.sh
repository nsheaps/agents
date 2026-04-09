#!/usr/bin/env bash
# agent-serve.sh — create-or-attach tmux session for an agent, then tail its
# Claude Code transcript through the local reformatter.
#
# Usage:
#   scripts/agent-serve.sh <session-name> <agent-repo-dir>
#
# Behavior:
#   1. If a tmux session <session-name> does not exist, create it with the
#      agent repo as cwd and run `bin/agent` inside.
#   2. Wait up to 60s for the agent to write its session id to
#      <repo>/.claude/tmp/session-id.
#   3. Compute the expected Claude Code transcript path from the repo dir
#      plus the session id, and exec scripts/tail-transcript.sh on it.
#   4. If the session id does not appear in time, fall back to tailing the
#      newest .jsonl file in the project's transcript directory so Tilt still
#      shows something useful.
#
# This script is invoked by Tilt's serve_cmd — see Tiltfile.

set -euo pipefail

SESSION_NAME="${1:-}"
REPO_DIR="${2:-}"

if [[ -z "$SESSION_NAME" || -z "$REPO_DIR" ]]; then
  echo "usage: $0 <session-name> <agent-repo-dir>" >&2
  exit 2
fi

if [[ ! -d "$REPO_DIR" ]]; then
  echo "agent-serve: repo dir not found: $REPO_DIR" >&2
  exit 1
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "agent-serve: tmux not found on PATH" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAIL_SCRIPT="$SCRIPT_DIR/tail-transcript.sh"

SESSION_ID_FILE="$REPO_DIR/.claude/tmp/session-id"

# Claude Code encodes the project cwd by replacing '/' with '-'.
encode_cwd() {
  printf '%s' "$1" | sed 's|/|-|g'
}

ENCODED_CWD="$(encode_cwd "$REPO_DIR")"
PROJECT_DIR="$HOME/.claude/projects/$ENCODED_CWD"

echo "agent-serve: session=$SESSION_NAME repo=$REPO_DIR"
echo "agent-serve: transcript dir=$PROJECT_DIR"

# Step 1: create tmux session if missing.
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "agent-serve: tmux session '$SESSION_NAME' already exists, reusing it"
else
  echo "agent-serve: creating tmux session '$SESSION_NAME'"
  tmux new-session -d -s "$SESSION_NAME" -c "$REPO_DIR" "bin/agent"
fi

# Step 2: wait for session id file (up to 60s).
echo "agent-serve: waiting for session id at $SESSION_ID_FILE"
SESSION_ID=""
for _ in $(seq 1 60); do
  if [[ -s "$SESSION_ID_FILE" ]]; then
    SESSION_ID="$(tr -d '[:space:]' < "$SESSION_ID_FILE")"
    if [[ -n "$SESSION_ID" ]]; then
      break
    fi
  fi
  sleep 1
done

# Step 3: resolve the transcript path.
TRANSCRIPT_PATH=""
if [[ -n "$SESSION_ID" ]]; then
  TRANSCRIPT_PATH="$PROJECT_DIR/$SESSION_ID.jsonl"
  echo "agent-serve: resolved transcript via session id: $TRANSCRIPT_PATH"
else
  echo "agent-serve: session id not found in time, falling back to newest jsonl"
  if [[ -d "$PROJECT_DIR" ]]; then
    TRANSCRIPT_PATH="$(ls -t "$PROJECT_DIR"/*.jsonl 2>/dev/null | head -1 || true)"
  fi
fi

if [[ -z "$TRANSCRIPT_PATH" ]]; then
  echo "agent-serve: could not locate a transcript jsonl under $PROJECT_DIR" >&2
  echo "agent-serve: tmux session '$SESSION_NAME' is still running; attach with: tmux attach -t $SESSION_NAME" >&2
  exit 1
fi

# Step 4: tail via the reformatter. exec so Tilt sees the live output stream.
echo "agent-serve: tailing $TRANSCRIPT_PATH"
exec "$TAIL_SCRIPT" "$TRANSCRIPT_PATH"
