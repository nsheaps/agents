#!/usr/bin/env bash
# task-native-warning.sh — PreToolUse hook for TaskCreate / TaskUpdate
#
# When the built-in Task tools are used alongside the task-utils MCP server,
# this hook advises (or blocks) the use of native tools in favor of the MCP
# equivalents (mcp__task-utils__task_create, mcp__task-utils__task_update).
#
# Behavior is controlled by the "nativeTaskMode" setting (3-tier config):
#   silent — exit 0 silently; native tools allowed without comment.
#   warn   — allow with additionalContext recommending MCP tools instead.
#   block  — deny with permissionDecisionReason; use MCP tools instead.
#
# Skip conditions:
#   - Built-in tasks are disabled (CLAUDE_CODE_ENABLE_TASKS=0/false/off/no).
#   - Tool name is not TaskCreate or TaskUpdate.
#
# Output contract (PreToolUse):
#   - Exit 0 with JSON on STDOUT for policy decisions.
#   - "warn" mode: additionalContext advisory, permissionDecision omitted (allow).
#   - "block" mode: permissionDecision: deny, permissionDecisionReason set.
#   - "silent" mode: no output (exit 0 only).
#   - Stderr reserved for hook infrastructure errors.
#
# Log: .claude/logs/task-native-warning.log

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_NAME="task-utils"
# shellcheck source=builtin-tasks-detect.sh
. "$HOOK_DIR/builtin-tasks-detect.sh"
# shellcheck source=plugin-settings-lib.sh
. "$HOOK_DIR/plugin-settings-lib.sh"

INPUT="$(cat)"
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"

LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/logs"
LOG_FILE="$LOG_DIR/task-native-warning.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

log_fire() {
  local decision="$1" detail="$2"
  printf '%s tool=%s decision=%s %s\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$TOOL_NAME" "$decision" "$detail" \
    >> "$LOG_FILE" 2>/dev/null || true
}

# Only gate native Task tools.
case "$TOOL_NAME" in
  TaskCreate|TaskUpdate) : ;;
  *) exit 0 ;;
esac

# Skip if built-in tasks are disabled — they wouldn't be callable anyway.
if ! is_builtin_tasks_enabled; then
  log_fire "skip" "reason=builtin-tasks-disabled"
  exit 0
fi

# Read nativeTaskMode from 3-tier config (project > user > plugin default).
MODE="$(plugin_get_config "nativeTaskMode" "warn")"

# Advisory text recommending MCP tools.
MCP_RECOMMENDATION="Consider using the MCP task tools instead of built-in Task tools: mcp__task-utils__task_create and mcp__task-utils__task_update write directly to the project's flat YAML task store (.claude/tasks/) and auto-commit via git. Set CLAUDE_CODE_ENABLE_TASKS=0 in your environment (or add it to $CLAUDE_PROJECT_DIR/.claude/settings.json env block) to disable built-in tasks and use MCP tools exclusively. Or set nativeTaskMode: silent in $CLAUDE_PROJECT_DIR/.claude/plugins.settings.yaml to suppress this advisory."

emit_warn() {
  jq -n \
    --arg context "$MCP_RECOMMENDATION" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $context}}'
}

emit_block() {
  local reason="$1"
  jq -n \
    --arg decision "deny" \
    --arg reason "$reason" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $decision, permissionDecisionReason: $reason}}'
}

case "$MODE" in
  silent)
    log_fire "allow" "mode=silent"
    exit 0
    ;;
  block)
    BLOCK_REASON="Built-in TaskCreate/TaskUpdate blocked (nativeTaskMode=block). Use MCP task tools instead: mcp__task-utils__task_create and mcp__task-utils__task_update write to the project's flat YAML store and auto-commit. Set nativeTaskMode: warn (or silent) in $CLAUDE_PROJECT_DIR/.claude/plugins.settings.yaml to allow native tools."
    log_fire "deny" "mode=block"
    emit_block "$BLOCK_REASON"
    exit 0
    ;;
  warn|*)
    # Default: warn mode (also covers unknown values).
    log_fire "warn" "mode=${MODE}"
    emit_warn
    exit 0
    ;;
esac
