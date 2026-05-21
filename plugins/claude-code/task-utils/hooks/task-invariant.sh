#!/usr/bin/env bash
# task-invariant.sh — PreToolUse hook for TaskCreate / TaskUpdate
#
# Responsibilities (per Nate Discord 2026-05-17 02:17Z, 02:32Z, 02:53Z,
# post-compact, and 04:06Z `1505421176590307469`):
#
#   1. Enforce: at most 1 task is in_progress at any time.
#
#   2. Enforce: TaskCreate cannot create a task with status=in_progress —
#      tasks must be born in pending; promotion is a separate step
#      (per rule 6).
#
#   3. Enforce validation-steps mechanism:
#        - pending→in_progress denied unless the effective description
#          contains a <validation-steps> block with ≥1 unchecked `- [ ]`
#          item (rule 2).
#        - in_progress→completed denied unless every step is `- [x]` AND
#          every `- [x]` is followed by a RESULT(...) line (rule 3).
#        - pending→completed skips validation-step checks (rule 4).
#        - Effective description = tool_input.description if provided,
#          else current task JSON's description (rule 5 — same-call set).
#
#   4. Coach on atomicity / breakdown / parallelism / stakeholder ping.
#      Three coach variants (STARTED, COMPLETED, GENERIC) — see below.
#
# Output contract (per claude-code docs hooks.md PreToolUse):
#   - Exit 0 with JSON on STDOUT for policy decisions.
#   - `permissionDecisionReason` carries deny text (clean prose).
#   - `additionalContext` carries advisory text on allow.
#   - Stderr is reserved for hook errors, not policy output.
#
# Sidecar log: every fire appended to .claude/logs/task-invariant.log.
#
# Task storage: this hook gates the BUILT-IN TaskCreate/TaskUpdate tools,
# which write per-session files at ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/
# <session_id>/ (the "legacy" store). The id-addressed task lookup therefore
# reads the legacy store. The 0-or-1 in_progress invariant, however, is scanned
# across BOTH the legacy store AND the flat MCP store (see task-store-lib.sh)
# so a built-in TaskUpdate is correctly denied when an MCP task is already
# in_progress, and vice versa. The MCP server enforces the same invariants
# in-process for its own tools (mcp/src/tasks.ts).

set -euo pipefail

# Resolve this script's directory so the shared lib is found regardless of CWD.
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=task-store-lib.sh
. "$HOOK_DIR/task-store-lib.sh"

INPUT="$(cat)"
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
SESSION_ID="$(jq -r '.session_id // empty' <<<"$INPUT")"

LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/logs"
LOG_FILE="$LOG_DIR/task-invariant.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

log_fire() {
  local decision="$1" detail="$2"
  printf '%s tool=%s session=%s decision=%s %s\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$TOOL_NAME" "${SESSION_ID:0:8}" "$decision" "$detail" \
    >> "$LOG_FILE" 2>/dev/null || true
}

case "$TOOL_NAME" in
  TaskCreate|TaskUpdate) : ;;
  *) exit 0 ;;
esac

# Legacy per-session store — where the built-in Task tools write task files.
# The id-addressed TASK_FILE lookup below uses this store.
TASKS_DIR="$(resolve_legacy_store_dir "$SESSION_ID")"
# Flat MCP store — scanned together with TASKS_DIR for the 0-or-1 invariant.
FLAT_STORE="$(resolve_flat_store_root "${CLAUDE_PROJECT_DIR:-$(pwd)}")"

# ---- Reminder text (verbatim per Nate 2026-05-17 02:53Z + 04:06Z) -----------

GENERIC_REMINDER='Remember, only work on one task at a time. Any task that isn'\''t atomic becomes a "break down" task to make atomic tasks. If the next task is too vague, break it down into new smaller atomic Tasks, complete the breakdown task, and work on a single atomic task.'

# TaskCreate-only coach: behavior-changing work jumps the queue.
# Source: Nate Discord 2026-05-17 05:04Z (msg 1505435823439614103)
# "behavior changing tasks like updates to skills and plugins should be done
#  immediately when they'\''re requested, not ticketed and added to end of list
#  like most other things. Represent this in the blocks/blocked by graph"
BEHAVIOR_CHANGING_COACH='If this task is BEHAVIOR-CHANGING (updates a skill, plugin, hook, coach text, rule, or anything that affects HOW you or another agent behave going forward), do NOT defer it to end-of-backlog. Behavior-changing tasks must be worked IMMEDIATELY because every subsequent action in this session continues to suffer the gap they fix. Reflect that priority in the dependency graph: use addBlocks on the current in_progress task (so this one surfaces NOW), and/or addBlockedBy on routine backlog tasks (e.g. PR work, audits) to push them behind it. Routine bug fixes, content edits, doc-only sweeps, and one-shot operations are NOT behavior-changing and stay queued normally. When in doubt, ask: "does landing this change what I do on the very next task?" — if yes, it'\''s behavior-changing.'

STARTED_COACH='Task just moved to in_progress. Pause and check: does this task concretely capture an ATOMIC portion of completing the user'\''s request — small enough to be completed with no further breakdown? If yes, proceed. If no, this is essentially a PLANNING task: keep it in_progress and use it to spawn smaller sibling tasks (the breakdown task is "done" when the next atomic piece has been identified). Worked example: https://github.com/nsheaps/agents/blob/main/docs/journal/2026/05/16/managing-tasks-example.md. Use sequential-thinking. Preserve history: append a dated event-log line to the task description before each state change. If this work could run in parallel with another task you also want to advance, instead dispatch via Agent(run_in_background: true, name: "<short-name>"), rename this task with prefix "AGENT(<short-name>): " and move it back to pending — when the subagent finishes you can pause whatever you'\''re doing, resume it via SendMessage({to: "<short-name>"}), and continue.'

COMPLETED_COACH='Task just moved to completed. Pull learnings: what did you discover that changes the plan? FIRST capture any follow-up work you uncovered as NEW tasks via TaskCreate — (a) validation steps for what you just shipped, (b) answers to open questions you noted, (c) follow-ups you noticed but did not do — and mark each with addBlockedBy pointing at the downstream task(s) it must complete before. Some of these you can mark completed immediately if a moment of thought confirms "no change needed". For any follow-up that can run in parallel with your next focus, consider dispatching it as a background subagent (Agent(run_in_background: true, name: "<n>")), prefix that task subject with "AGENT(<n>): " and leave it pending — you'\''ll resume the subagent via SendMessage({to: "<n>"}) when it returns. ALSO: if any stakeholder was awaiting this completion, post a 1–3 sentence update on the active channel (Telegram or Discord) with the artifact link; if the task is linked to a ticket-tracking system (GitHub issue, Linear, etc.), update its status there too — keep it terse, no content-dumps. THEN check the NEXT task you'\''ll start. (1) If it is atomic — start it. (2) If it is not atomic AND you know how to break it down — update tasks NOW to add the atomic sub-tasks, then start the first one. (3) If it is not atomic AND you do NOT know how to break it down — create a "plan/break-down X" task, start THAT, and complete it once the next chunk has an identifiable atomic piece. Worked example: https://github.com/nsheaps/agents/blob/main/docs/journal/2026/05/16/managing-tasks-example.md.'

# ---- Emit helper ------------------------------------------------------------

emit_decision() {
  local decision="$1" reason="$2" context="$3"
  jq -n \
    --arg decision "$decision" \
    --arg reason "$reason" \
    --arg context "$context" \
    '{
      hookSpecificOutput: (
        {
          hookEventName: "PreToolUse",
          permissionDecision: $decision
        }
        + (if $reason  == "" then {} else {permissionDecisionReason: $reason}  end)
        + (if $context == "" then {} else {additionalContext:       $context} end)
      )
    }'
}

# ---- Validation-steps parser ------------------------------------------------
#
# Extracts the content of the <validation-steps>...</validation-steps> block
# and emits an audit report to stdout. Output format:
#   UNCHECKED=<N>
#   CHECKED=<N>
#   MISSING_RESULT=<comma-separated 1-based item indices>
# If no block is found, all three are 0/empty.

parse_validation_steps() {
  local desc="$1"
  printf '%s\n' "$desc" | awk '
    BEGIN { inside = 0; unchecked = 0; checked = 0; awaiting = 0; idx = 0; missing = "" }
    !inside && tolower($0) ~ /^[ \t]*<validation-steps>[ \t]*$/ { inside = 1; next }
    inside && tolower($0) ~ /^[ \t]*<\/validation-steps>[ \t]*$/ {
      if (awaiting) { missing = (missing == "" ? idx : missing "," idx); awaiting = 0 }
      inside = 0
      next
    }
    inside {
      # Trim leading whitespace
      line = $0
      sub(/^[ \t]+/, "", line)
      if (line ~ /^- \[ \][ \t]+/) {
        if (awaiting) { missing = (missing == "" ? idx : missing "," idx) }
        idx++
        unchecked++
        awaiting = 0
      } else if (line ~ /^- \[[xX]\][ \t]+/) {
        if (awaiting) { missing = (missing == "" ? idx : missing "," idx) }
        idx++
        checked++
        awaiting = 1
      } else if (line ~ /^RESULT\(/) {
        awaiting = 0
      }
    }
    END {
      if (awaiting) { missing = (missing == "" ? idx : missing "," idx) }
      printf "UNCHECKED=%d\nCHECKED=%d\nMISSING_RESULT=%s\n", unchecked, checked, missing
    }
  '
}

# ---- TaskCreate branch ------------------------------------------------------

if [[ "$TOOL_NAME" == "TaskCreate" ]]; then
  NEW_STATUS_ON_CREATE="$(jq -r '.tool_input.status // "pending"' <<<"$INPUT")"
  if [[ "$NEW_STATUS_ON_CREATE" == "in_progress" ]]; then
    REASON='Tasks must be created in pending state — TaskCreate with status=in_progress is not allowed (rule 6). Use TaskCreate (which defaults to pending), then TaskUpdate(status=in_progress) once the task is atomic AND has a <validation-steps> block with ≥1 unchecked "- [ ]" item.'
    log_fire "deny" "tool=TaskCreate reason=create-with-in_progress"
    emit_decision "deny" "$REASON" ""
    exit 0
  fi
  log_fire "allow" "tool=TaskCreate"
  emit_decision "allow" "" "${BEHAVIOR_CHANGING_COACH}"$'\n\n'"${GENERIC_REMINDER}"
  exit 0
fi

# ---- TaskUpdate branch ------------------------------------------------------

NEW_STATUS="$(jq -r '.tool_input.status // empty' <<<"$INPUT")"
TASK_ID="$(jq -r '.tool_input.taskId // empty' <<<"$INPUT")"
NEW_DESC="$(jq -r '.tool_input.description // empty' <<<"$INPUT")"

# Read current task state from disk
TASK_FILE="$TASKS_DIR/${TASK_ID}.json"
CURRENT_STATUS=""
CURRENT_DESC=""
if [[ -f "$TASK_FILE" ]]; then
  CURRENT_STATUS="$(jq -r '.status // empty' "$TASK_FILE" 2>/dev/null || echo '')"
  CURRENT_DESC="$(jq -r '.description // empty' "$TASK_FILE" 2>/dev/null || echo '')"
fi

# Effective description: tool_input.description if provided, else disk
EFFECTIVE_DESC="$CURRENT_DESC"
if [[ -n "$NEW_DESC" ]]; then
  EFFECTIVE_DESC="$NEW_DESC"
fi

# Parse validation-steps from effective description
VS_REPORT="$(parse_validation_steps "$EFFECTIVE_DESC")"
VS_UNCHECKED="$(printf '%s\n' "$VS_REPORT" | awk -F= '/^UNCHECKED=/{print $2}')"
VS_CHECKED="$(printf '%s\n' "$VS_REPORT" | awk -F= '/^CHECKED=/{print $2}')"
VS_MISSING_RESULT="$(printf '%s\n' "$VS_REPORT" | awk -F= '/^MISSING_RESULT=/{print $2}')"
# Defensive defaults
VS_UNCHECKED="${VS_UNCHECKED:-0}"
VS_CHECKED="${VS_CHECKED:-0}"

# Build the lifecycle-specific coach prefix
LIFECYCLE_COACH=""
case "$NEW_STATUS" in
  in_progress)
    LIFECYCLE_COACH="$STARTED_COACH"
    ;;
  completed)
    LIFECYCLE_COACH="$COMPLETED_COACH"
    ;;
esac

# ---- Deny path: pending→in_progress validation-steps required ---------------

if [[ "$NEW_STATUS" == "in_progress" ]]; then
  # 0-or-1 invariant first — scanned across BOTH the legacy per-session store
  # and the flat MCP store so the invariant holds globally.
  OTHERS=""
  for scan_dir in "$TASKS_DIR" "$FLAT_STORE"; do
    [[ -d "$scan_dir" ]] || continue
    while IFS= read -r -d '' f; do
      f_id="$(grep -m1 '^id: ' "$f" 2>/dev/null | sed 's/^id: //; s/^"//; s/"$//')"
      [[ "$f_id" == "$TASK_ID" ]] && continue
      f_status="$(grep -m1 '^status: ' "$f" 2>/dev/null | awk '{print $2}')"
      if [[ "$f_status" == "in_progress" ]]; then
        f_subj="$(grep -m1 '^subject: ' "$f" 2>/dev/null | sed 's/^subject: //; s/^"//; s/"$//')"
        OTHERS+="#${f_id} (${f_subj}); "
      fi
    done < <(find "$scan_dir" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null)
  done
  if [[ -n "$OTHERS" ]]; then
    REASON="Cannot move task #${TASK_ID} to in_progress — already in_progress: ${OTHERS%; }. Project rule: exactly 0 or 1 task may be in_progress. Pick one: (a) complete current via TaskUpdate status=completed, (b) move it back to pending via TaskUpdate status=pending, (c) create a sub-task via TaskCreate to capture the new direction (the in-progress task may itself be a planning/break-down task — see worked example at https://github.com/nsheaps/agents/blob/main/docs/journal/2026/05/16/managing-tasks-example.md). Use sequential-thinking; append a dated event-log line to the in-progress task's description noting the pivot before changing state."
    log_fire "deny" "task=${TASK_ID} reason=in_progress-conflict conflict=${OTHERS%; }"
    emit_decision "deny" "$REASON" ""
    exit 0
  fi

  # Validation-steps required (rule 2)
  if [[ "$VS_UNCHECKED" -lt 1 ]]; then
    REASON="Cannot move task #${TASK_ID} to in_progress — the task description has no <validation-steps> block with at least one unchecked \"- [ ]\" item. Add validation steps that capture the pass/fail criteria for this task, in this format inside the description:

  <validation-steps>
   - [ ] step one
   - [ ] step two
  </validation-steps>

You can set the description AND the status in the SAME TaskUpdate call (rule 5) — the hook merges them before evaluating. If the task truly has no validation work to do, prefer pending→completed (which skips validation checks per rule 4)."
    log_fire "deny" "task=${TASK_ID} reason=no-validation-steps unchecked=${VS_UNCHECKED} checked=${VS_CHECKED}"
    emit_decision "deny" "$REASON" ""
    exit 0
  fi
fi

# ---- Deny path: in_progress→completed validation-steps complete + RESULT ----

if [[ "$NEW_STATUS" == "completed" && "$CURRENT_STATUS" == "in_progress" ]]; then
  # Rule 3: every step must be checked
  if [[ "$VS_UNCHECKED" -gt 0 ]]; then
    REASON="Cannot move task #${TASK_ID} to completed — ${VS_UNCHECKED} validation step(s) remain unchecked in <validation-steps>. Either complete the work (and check each item + add a RESULT(...) line as evidence), or park the task back to pending via TaskUpdate(status=pending) to keep the lifecycle honest. Note: pending→completed (without ever transitioning to in_progress) IS allowed when no validation is intended (cancellation, immediate-no-op tasks, etc.) — rule 4."
    log_fire "deny" "task=${TASK_ID} reason=validation-incomplete unchecked=${VS_UNCHECKED}"
    emit_decision "deny" "$REASON" ""
    exit 0
  fi
  # Rule 3 part 2: each [x] step must have a RESULT line
  if [[ -n "$VS_MISSING_RESULT" ]]; then
    REASON="Cannot move task #${TASK_ID} to completed — the following checked validation step(s) are missing RESULT lines (1-based item indices): ${VS_MISSING_RESULT}. Add a RESULT(<timestamp>[, by (\$agentName|Agent(\$subAgentId))]): <evidence> line directly after each \"- [x]\" item documenting how you verified it. Example: RESULT(2026-05-17 04:06Z, by alex): log line \"X\" in /path/to/log confirms."
    log_fire "deny" "task=${TASK_ID} reason=missing-result indices=${VS_MISSING_RESULT}"
    emit_decision "deny" "$REASON" ""
    exit 0
  fi
fi

# ---- Allow path -------------------------------------------------------------

if [[ -n "$LIFECYCLE_COACH" ]]; then
  ADDITIONAL_CONTEXT="${LIFECYCLE_COACH}"$'\n\n'"${GENERIC_REMINDER}"
else
  ADDITIONAL_CONTEXT="${GENERIC_REMINDER}"
fi

log_fire "allow" "tool=${TOOL_NAME}${NEW_STATUS:+ new_status=$NEW_STATUS} current_status=${CURRENT_STATUS:-none} unchecked=${VS_UNCHECKED} checked=${VS_CHECKED}"
emit_decision "allow" "" "$ADDITIONAL_CONTEXT"
exit 0
