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
# Opt-out: set TASK_UTILS_REQUIRE_TASK=0 to disable this gate in
# environments where the Task tools (TaskCreate/TaskUpdate) are not
# enabled — notably Claude Code on the web — so the gate is not left
# permanently unsatisfiable. Unset (the default) enforces the gate.

set -euo pipefail

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

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
TASKS_DIR="$CLAUDE_DIR/tasks/$SESSION_ID"

# Count in_progress tasks
IN_PROGRESS_COUNT=0
if [[ -d "$TASKS_DIR" ]]; then
  while IFS= read -r -d '' f; do
    f_status="$(jq -r '.status // empty' "$f" 2>/dev/null)"
    if [[ "$f_status" == "in_progress" ]]; then
      IN_PROGRESS_COUNT=$((IN_PROGRESS_COUNT + 1))
    fi
  done < <(find "$TASKS_DIR" -maxdepth 1 -name '*.json' -print0 2>/dev/null)
fi

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

log_fire "allow" "tool=${TOOL_NAME} in_progress=${IN_PROGRESS_COUNT}"
emit_decision "allow" ""
exit 0
