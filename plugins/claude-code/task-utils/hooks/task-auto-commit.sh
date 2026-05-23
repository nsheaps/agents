#!/usr/bin/env bash
# task-auto-commit.sh — PostToolUse hook for TaskCreate / TaskUpdate
#
# After the built-in TaskCreate or TaskUpdate tool runs, attempt to commit
# and push the resulting task file so task state is persisted in git.
#
# Built-in Task tools write per-session JSON files to:
#   ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/<task_id>.json
# These files live OUTSIDE the project repo, so git add from $CLAUDE_PROJECT_DIR
# will not stage them. This hook is therefore best-effort: it logs what it can,
# and exits 0 regardless so the write is never blocked by a git failure.
#
# When the flat MCP store is also in use ($CLAUDE_PROJECT_DIR/.claude/tasks/),
# this hook tries to commit any *.yaml files staged there too, providing a
# secondary commit opportunity after MCP-path writes.
#
# Opt-out: not currently env-gated (PostToolUse hooks can't block the tool;
# they run after completion, so no opt-out is needed for safety).
#
# Sidecar log: .claude/logs/task-auto-commit.log
#
# Output contract (PostToolUse):
#   - Exit 0 always (hook errors must not surface to the user)
#   - Stdout JSON with optional systemMessage for informational messages
#   - Stderr reserved for hook infrastructure errors

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=task-store-lib.sh
. "$HOOK_DIR/task-store-lib.sh"

INPUT="$(cat)"
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
SESSION_ID="$(jq -r '.session_id // empty' <<<"$INPUT")"
TOOL_RESULT="$(jq -r '.tool_result // empty' <<<"$INPUT")"

LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/logs"
LOG_FILE="$LOG_DIR/task-auto-commit.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$LOG_FILE" 2>/dev/null || true
}

# Only handle task tools
case "$TOOL_NAME" in
  TaskCreate|TaskUpdate) : ;;
  *) exit 0 ;;
esac

# Require project dir and git
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$PROJECT_DIR" ]]; then
  log "skip: CLAUDE_PROJECT_DIR not set"
  exit 0
fi

if ! git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  log "skip: $PROJECT_DIR is not inside a git working tree"
  exit 0
fi

# ---- Extract task ID from tool result ----------------------------------------
# The built-in TaskCreate/TaskUpdate returns structured JSON in tool_result.
# The task ID is typically in .taskId or .id field.
TASK_ID=""
if [[ -n "$TOOL_RESULT" ]]; then
  TASK_ID="$(jq -r '.taskId // .id // empty' <<<"$TOOL_RESULT" 2>/dev/null || true)"
fi

# ---- Attempt 1: commit the legacy store file (best-effort) -------------------
LEGACY_DIR="$(resolve_legacy_store_dir "$SESSION_ID")"
LEGACY_FILE=""
if [[ -n "$TASK_ID" && -f "${LEGACY_DIR}/${TASK_ID}.json" ]]; then
  LEGACY_FILE="${LEGACY_DIR}/${TASK_ID}.json"
fi

if [[ -n "$LEGACY_FILE" ]]; then
  # Determine commit message
  NEW_STATUS="$(jq -r '.status // empty' <<<"$TOOL_RESULT" 2>/dev/null || true)"
  if [[ "$TOOL_NAME" == "TaskCreate" ]]; then
    SUBJECT="$(jq -r '.subject // empty' <<<"$TOOL_RESULT" 2>/dev/null || true)"
    COMMIT_MSG="chore(tasks): add task ${TASK_ID}${SUBJECT:+ ${SUBJECT}}"
  elif [[ -n "$NEW_STATUS" ]]; then
    COMMIT_MSG="chore(tasks): update task ${TASK_ID} (${NEW_STATUS})"
  else
    COMMIT_MSG="chore(tasks): update task ${TASK_ID}"
  fi

  # The legacy file is outside the project repo; git add will fail if so.
  # We attempt it anyway — if it's somehow in the repo (e.g. a symlinked store),
  # this will work. If not, we log the skip and move on.
  if git -C "$PROJECT_DIR" add -- "$LEGACY_FILE" 2>/dev/null; then
    if git -C "$PROJECT_DIR" commit -m "$COMMIT_MSG" -- "$LEGACY_FILE" 2>/dev/null; then
      git -C "$PROJECT_DIR" push 2>/dev/null || true
      log "ok: committed+pushed legacy file ${LEGACY_FILE} msg=${COMMIT_MSG}"
    else
      log "skip: nothing to commit for legacy file ${LEGACY_FILE}"
    fi
  else
    log "skip: legacy file ${LEGACY_FILE} not in project repo (outside git tree — expected)"
  fi
fi

# ---- Attempt 2: commit any unstaged flat store changes -----------------------
# After a task write (MCP or direct), there may be staged/unstaged .yaml task
# files in the flat store. Commit them if so.
FLAT_STORE="$(resolve_flat_store_root "$PROJECT_DIR")"
if [[ -d "$FLAT_STORE" ]]; then
  # Stage any new or modified .yaml files
  git -C "$PROJECT_DIR" add -- "${FLAT_STORE}/"*.yaml 2>/dev/null || true

  # Only commit if something is actually staged
  STAGED="$(git -C "$PROJECT_DIR" diff --cached --name-only -- "${FLAT_STORE}/" 2>/dev/null || true)"
  if [[ -n "$STAGED" ]]; then
    if [[ -n "$TASK_ID" ]]; then
      NEW_STATUS_FLAT="$(jq -r '.status // empty' <<<"$TOOL_RESULT" 2>/dev/null || true)"
      if [[ "$TOOL_NAME" == "TaskCreate" ]]; then
        FLAT_MSG="chore(tasks): add task ${TASK_ID}"
      elif [[ -n "$NEW_STATUS_FLAT" ]]; then
        FLAT_MSG="chore(tasks): update task ${TASK_ID} (${NEW_STATUS_FLAT})"
      else
        FLAT_MSG="chore(tasks): update task ${TASK_ID}"
      fi
    else
      FLAT_MSG="chore(tasks): sync task files after ${TOOL_NAME}"
    fi
    if git -C "$PROJECT_DIR" commit -m "$FLAT_MSG" 2>/dev/null; then
      git -C "$PROJECT_DIR" push 2>/dev/null || true
      log "ok: committed+pushed flat store changes msg=${FLAT_MSG}"
    else
      log "warn: staged flat store changes but commit failed"
    fi
  fi
fi

# Always exit 0 — PostToolUse errors should not surface to the user
exit 0
