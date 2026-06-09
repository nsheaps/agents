#!/usr/bin/env bash
# task-sync-from-legacy.sh — PostToolUse hook for TaskCreate / TaskUpdate
#
# When the built-in Task tools are enabled, they write per-session JSON files
# to ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/<task_id>.json
# (the "legacy" store). This hook copies those files into the flat MCP store
# (.claude/tasks/<id>.yaml) so task state is persisted in git alongside the
# project, matching the MCP-managed task layout.
#
# Replaces task-auto-commit.sh (R3 redesign, 2026-05-24).
#
# Skip conditions:
#   - Built-in tasks disabled (CLAUDE_CODE_ENABLE_TASKS=0/false/off/no).
#   - CLAUDE_PROJECT_DIR not set.
#   - Project dir is not a git working tree.
#   - Legacy task file not found after the tool ran.
#
# Conversion: if the legacy file is JSON, it is converted to YAML using jq +
# printf; if it is already YAML it is copied verbatim. The converted file is
# written to <flat-store>/<id>.yaml, then git add + commit + push (all
# best-effort; this hook always exits 0 so the tool result is never blocked).
#
# Log: .claude/logs/task-sync-from-legacy.log
#
# Output contract (PostToolUse):
#   - Exit 0 always (hook errors must not surface to the user).
#   - Stdout: JSON with optional systemMessage for informational messages.
#   - Stderr: hook infrastructure errors only.

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=task-store-lib.sh
. "$HOOK_DIR/task-store-lib.sh"
# shellcheck source=builtin-tasks-detect.sh
. "$HOOK_DIR/builtin-tasks-detect.sh"

INPUT="$(cat)"
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
SESSION_ID="$(jq -r '.session_id // empty' <<<"$INPUT")"
TOOL_RESULT="$(jq -r '.tool_result // empty' <<<"$INPUT")"

LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/logs"
LOG_FILE="$LOG_DIR/task-sync-from-legacy.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$LOG_FILE" 2>/dev/null || true
}

# Only handle task tools.
case "$TOOL_NAME" in
  TaskCreate|TaskUpdate) : ;;
  *) exit 0 ;;
esac

# Skip if built-in tasks are disabled — there's nothing to sync.
if ! is_builtin_tasks_enabled; then
  log "skip: built-in tasks disabled (CLAUDE_CODE_ENABLE_TASKS)"
  exit 0
fi

# Require project dir and git.
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
TASK_ID=""
if [[ -n "$TOOL_RESULT" ]]; then
  TASK_ID="$(jq -r '.taskId // .id // empty' <<<"$TOOL_RESULT" 2>/dev/null || true)"
fi

if [[ -z "$TASK_ID" ]]; then
  log "skip: could not extract task ID from tool result"
  exit 0
fi

# ---- Locate legacy file -------------------------------------------------------
LEGACY_DIR="$(resolve_legacy_store_dir "$SESSION_ID")"
LEGACY_FILE_JSON="${LEGACY_DIR}/${TASK_ID}.json"
LEGACY_FILE_YAML="${LEGACY_DIR}/${TASK_ID}.yaml"

LEGACY_FILE=""
LEGACY_FORMAT=""
if [[ -f "$LEGACY_FILE_JSON" ]]; then
  LEGACY_FILE="$LEGACY_FILE_JSON"
  LEGACY_FORMAT="json"
elif [[ -f "$LEGACY_FILE_YAML" ]]; then
  LEGACY_FILE="$LEGACY_FILE_YAML"
  LEGACY_FORMAT="yaml"
fi

if [[ -z "$LEGACY_FILE" ]]; then
  log "skip: no legacy file found at ${LEGACY_DIR}/${TASK_ID}.{json,yaml}"
  exit 0
fi

# ---- Convert + write to flat store -------------------------------------------
FLAT_STORE="$(resolve_flat_store_root "$PROJECT_DIR")"
mkdir -p "$FLAT_STORE" 2>/dev/null || true
TARGET_FILE="${FLAT_STORE}/${TASK_ID}.yaml"

case "$LEGACY_FORMAT" in
  json)
    # Convert JSON to YAML using jq to extract fields and printf to format.
    # We mirror the minimal fields the hooks read: id, subject, status, description.
    if ! jq -e . "$LEGACY_FILE" >/dev/null 2>&1; then
      log "skip: legacy JSON file is not valid JSON: $LEGACY_FILE"
      exit 0
    fi
    jq -r '[
      "id: " + (.id // .taskId // ""),
      "subject: " + (.subject // ""),
      "status: " + (.status // "pending"),
      "description: |",
      (.description // "  (synced from native Task tool)")
        | split("\n") | map("  " + .) | join("\n"),
      "source: task-utils-mcp-sync",
      "syncedFrom: " + "legacy"
    ] | join("\n")' "$LEGACY_FILE" > "$TARGET_FILE" 2>/dev/null || {
      log "error: jq conversion failed for $LEGACY_FILE"
      exit 0
    }
    ;;
  yaml)
    cp "$LEGACY_FILE" "$TARGET_FILE" 2>/dev/null || {
      log "error: failed to copy $LEGACY_FILE -> $TARGET_FILE"
      exit 0
    }
    ;;
esac

log "converted: $LEGACY_FILE ($LEGACY_FORMAT) -> $TARGET_FILE"

# ---- Git add + commit + push (best-effort) -----------------------------------
NEW_STATUS="$(jq -r '.status // empty' <<<"$TOOL_RESULT" 2>/dev/null || true)"
if [[ "$TOOL_NAME" == "TaskCreate" ]]; then
  SUBJECT="$(jq -r '.subject // empty' <<<"$TOOL_RESULT" 2>/dev/null || true)"
  COMMIT_MSG="chore(tasks): sync task ${TASK_ID} from native${SUBJECT:+ — ${SUBJECT}}"
elif [[ -n "$NEW_STATUS" ]]; then
  COMMIT_MSG="chore(tasks): sync task ${TASK_ID} from native (${NEW_STATUS})"
else
  COMMIT_MSG="chore(tasks): sync task ${TASK_ID} from native"
fi

if git -C "$PROJECT_DIR" add -- "$TARGET_FILE" 2>/dev/null; then
  if git -C "$PROJECT_DIR" commit -m "$COMMIT_MSG" -- "$TARGET_FILE" 2>/dev/null; then
    git -C "$PROJECT_DIR" push 2>/dev/null || true
    log "ok: committed+pushed $TARGET_FILE msg=$COMMIT_MSG"
  else
    log "skip: nothing new to commit for $TARGET_FILE"
  fi
else
  log "warn: git add failed for $TARGET_FILE"
fi

# Always exit 0 — PostToolUse errors must not surface to the user.
exit 0
