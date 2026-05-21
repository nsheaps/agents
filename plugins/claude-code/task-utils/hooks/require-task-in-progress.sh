#!/usr/bin/env bash
# require-task-in-progress.sh — PreToolUse hook
#
# Blocks Write / Edit / MultiEdit / NotebookEdit when NO task is
# in_progress. The deny message instructs to start an existing task
# via TaskUpdate, or create one via TaskCreate to encompass the work,
# keeping the description up to date with dated event-log lines as
# work proceeds.
#
# Why: Nate Discord 2026-05-17 02:55Z — every write action should
# correspond to an actively-tracked atomic task so progress is
# observable and validatable.
#
# Output contract (per claude-code docs hooks.md PreToolUse):
#   - Exit 0 with JSON on STDOUT for policy decisions.
#   - `permissionDecisionReason` carries the deny text (clean prose).
#   - Stderr reserved for hook errors, not policy output.
#
# Sidecar log: every fire appended to
# .claude/logs/require-task-in-progress.log so the audit trail
# survives even when the transcript stays clean.
#
# Task storage: the gate is satisfied by an in_progress task in EITHER
#   (a) the flat MCP store — <store-root>/<task-id>.json, where store-root
#       is $TASK_UTILS_TASK_DIR, else the CWD git repo's .claude/tasks, else
#       <CWD>/.claude/tasks (see hooks/task-store-lib.sh); the task-utils MCP
#       server writes here, or
#   (b) the legacy per-session store the built-in Task tools write to,
#       ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/.
# Reading both keeps built-in-Task-tool users working alongside the MCP
# fallback.
#
# Opt-out: set TASK_UTILS_REQUIRE_TASK=0 to disable this gate in
# environments where neither task system is available, so the gate is not
# left permanently unsatisfiable. Unset (the default) enforces the gate.

set -euo pipefail

# Resolve this script's directory so the shared lib is found regardless of CWD.
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=task-store-lib.sh
. "$HOOK_DIR/task-store-lib.sh"

INPUT="$(cat)"
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
SESSION_ID="$(jq -r '.session_id // empty' <<<"$INPUT")"

LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/logs"
LOG_FILE="$LOG_DIR/require-task-in-progress.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

log_fire() {
  local decision="$1" detail="$2"
  printf '%s tool=%s session=%s decision=%s %s\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$TOOL_NAME" "${SESSION_ID:0:8}" "$decision" "$detail" \
    >> "$LOG_FILE" 2>/dev/null || true
}

# Only gate the write-class tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit|NotebookEdit) : ;;
  *) exit 0 ;;
esac

# Environment opt-out. The Task tools (TaskCreate/TaskUpdate) are not enabled in
# every Claude Code context — notably Claude Code on the web — and without them
# no task can ever reach in_progress, making this gate permanently
# unsatisfiable. TASK_UTILS_REQUIRE_TASK=0 disables the gate: the hook exits 0
# with no decision, so normal permission handling still applies. Unset or any
# other value keeps the gate enforced — no behavior change for existing setups.
if [[ "${TASK_UTILS_REQUIRE_TASK:-1}" == "0" ]]; then
  log_fire "allow" "tool=${TOOL_NAME} reason=gate-disabled-via-env"
  exit 0
fi

# Resolve both task stores. The gate is satisfied by an in_progress task in
# either: the flat MCP store, or the legacy per-session built-in-tool store.
BASE_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FLAT_STORE="$(resolve_flat_store_root "$BASE_DIR")"
LEGACY_STORE="$(resolve_legacy_store_dir "$SESSION_ID")"

FLAT_COUNT="$(count_in_progress_flat "$FLAT_STORE")"
LEGACY_COUNT="$(count_in_progress_flat "$LEGACY_STORE")"
IN_PROGRESS_COUNT=$((FLAT_COUNT + LEGACY_COUNT))

emit_decision() {
  local decision="$1" reason="$2"
  jq -n \
    --arg decision "$decision" \
    --arg reason "$reason" \
    '{
      hookSpecificOutput: (
        {
          hookEventName: "PreToolUse",
          permissionDecision: $decision
        }
        + (if $reason == "" then {} else {permissionDecisionReason: $reason} end)
      )
    }'
}

if (( IN_PROGRESS_COUNT == 0 )); then
  REASON='No task in_progress — start the appropriate existing task via TaskUpdate, or create one via TaskCreate to encompass this work. Keep the description up to date as you work (append dated event-log lines).'
  log_fire "deny" "tool=${TOOL_NAME} reason=no-task-in-progress"
  emit_decision "deny" "$REASON"
  exit 0
fi

log_fire "allow" "tool=${TOOL_NAME} in_progress=${IN_PROGRESS_COUNT} flat=${FLAT_COUNT} legacy=${LEGACY_COUNT}"
emit_decision "allow" ""
exit 0
