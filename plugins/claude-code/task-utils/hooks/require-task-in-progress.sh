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

set -euo pipefail

INPUT="$(cat)"
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
SESSION_ID="$(jq -r '.session_id // empty' <<<"$INPUT")"
AGENT_ID="$(jq -r '.agent_id // empty' <<<"$INPUT")"
AGENT_TYPE="$(jq -r '.agent_type // empty' <<<"$INPUT")"

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

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
TASKS_DIR="$CLAUDE_DIR/tasks/$SESSION_ID"

# Sub-agent branch — `agent_id` present in stdin means this hook fires for a
# parent-dispatched sub-agent. Look for an in_progress task whose
# metadata.assignee matches the sub-agent's agent_id; allow if found.
# Degrade-mode: if no assigned task exists, ALLOW with an advisory note
# (per assignee-design.md §"Probe findings" → degrade-mode C). The Agent()
# dispatch itself is the parent's authorization; assignment is for accounting,
# not gating.
if [[ -n "$AGENT_ID" ]]; then
  ASSIGNED_TASK=""
  if [[ -d "$TASKS_DIR" ]]; then
    while IFS= read -r -d '' f; do
      f_status="$(jq -r '.status // empty' "$f" 2>/dev/null)"
      f_assignee="$(jq -r '.metadata.assignee // empty' "$f" 2>/dev/null)"
      if [[ "$f_status" == "in_progress" && "$f_assignee" == "$AGENT_ID" ]]; then
        ASSIGNED_TASK="$(jq -r '.id // empty' "$f" 2>/dev/null)"
        break
      fi
    done < <(find "$TASKS_DIR" -maxdepth 1 -name '*.json' -print0 2>/dev/null)
  fi
  if [[ -n "$ASSIGNED_TASK" ]]; then
    log_fire "allow" "tool=${TOOL_NAME} subagent=${AGENT_ID} task=${ASSIGNED_TASK}"
    emit_decision "allow" ""
    exit 0
  fi
  # Degrade-mode: no assigned task, still allow but warn in advisory
  log_fire "allow-degrade" "tool=${TOOL_NAME} subagent=${AGENT_ID} type=${AGENT_TYPE} reason=no-assigned-task"
  emit_decision "allow" ""
  exit 0
fi

# Parent branch (no agent_id) — original logic, but the 0-or-1 invariant
# excludes sub-agent-assigned tasks via the assignee check.
IN_PROGRESS_COUNT=0
if [[ -d "$TASKS_DIR" ]]; then
  while IFS= read -r -d '' f; do
    f_status="$(jq -r '.status // empty' "$f" 2>/dev/null)"
    f_assignee="$(jq -r '.metadata.assignee // empty' "$f" 2>/dev/null)"
    # Skip sub-agent-assigned in_progress tasks — they don't gate parent writes.
    case "$f_assignee" in
      ""|alex) : ;;
      *) continue ;;
    esac
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
