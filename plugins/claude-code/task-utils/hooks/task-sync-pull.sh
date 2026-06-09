#!/usr/bin/env bash
# task-sync-pull.sh — PreToolUse hook for Write / Edit / MultiEdit / NotebookEdit
#
# Before a file-write tool executes, pull upstream task-file changes so the
# agent is working with the latest committed state.
#
# Throttle: at most one pull per TASK_UTILS_PULL_INTERVAL_SECS (default 60s)
# per store root. A sentinel file (.last-sync-pull) tracks the last pull time.
#
# After pull, scans for duplicate task IDs across the flat store and the legacy
# per-session store. If duplicates are found, denies the write with a clear
# conflict message. This prevents agents from writing stale state over fresher
# remote state.
#
# Opt-out: set TASK_UTILS_SYNC_PULL=0 to disable this hook (mirrors the
# TASK_UTILS_REQUIRE_TASK opt-out pattern).
#
# Sidecar log: .claude/logs/task-sync-pull.log
#
# Output contract (PreToolUse):
#   - Exit 0 with JSON { hookSpecificOutput: { hookEventName, permissionDecision } }
#   - deny only on detected duplicate task IDs (conflict detected after pull)
#   - allow on all other cases (pull errors are logged, not blocking)

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=task-store-lib.sh
. "$HOOK_DIR/task-store-lib.sh"

INPUT="$(cat)"
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
SESSION_ID="$(jq -r '.session_id // empty' <<<"$INPUT")"

LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/logs"
LOG_FILE="$LOG_DIR/task-sync-pull.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

log() {
  printf '%s tool=%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$TOOL_NAME" "$*" \
    >> "$LOG_FILE" 2>/dev/null || true
}

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

# Only gate the write-class tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit|NotebookEdit) : ;;
  *) exit 0 ;;
esac

# Environment opt-out (mirrors TASK_UTILS_REQUIRE_TASK pattern)
if [[ "${TASK_UTILS_SYNC_PULL:-1}" == "0" ]]; then
  log "skip: disabled via TASK_UTILS_SYNC_PULL=0"
  exit 0
fi

# Require CLAUDE_PROJECT_DIR and git
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$PROJECT_DIR" ]]; then
  log "skip: CLAUDE_PROJECT_DIR not set"
  exit 0
fi

if ! git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  log "skip: not a git repo"
  exit 0
fi

FLAT_STORE="$(resolve_flat_store_root "$PROJECT_DIR")"
LEGACY_STORE="$(resolve_legacy_store_dir "$SESSION_ID")"

# ---- Throttle: only pull at most once per INTERVAL --------------------------
INTERVAL="${TASK_UTILS_PULL_INTERVAL_SECS:-60}"
SENTINEL="${FLAT_STORE}/.last-sync-pull"

NOW="$(date +%s 2>/dev/null || printf '0')"
LAST="0"
if [[ -f "$SENTINEL" ]]; then
  LAST="$(stat -c %Y "$SENTINEL" 2>/dev/null || stat -f %m "$SENTINEL" 2>/dev/null || printf '0')"
fi
DELTA=$(( NOW - LAST ))

if (( DELTA < INTERVAL )); then
  log "throttled: last pull ${DELTA}s ago (interval=${INTERVAL}s)"
  # Skip pull, but still check for duplicate IDs from the current on-disk state
else
  # ---- Pull upstream changes (best-effort, fast-forward only) ----------------
  PULL_OUT="$(git -C "$PROJECT_DIR" pull --ff-only 2>&1 || true)"
  log "pull: ${PULL_OUT:-ok}"
  # Update sentinel file
  mkdir -p "$FLAT_STORE" 2>/dev/null || true
  touch "$SENTINEL" 2>/dev/null || true
fi

# ---- Conflict detection: duplicate task IDs across stores -------------------
declare -A SEEN_IDS
DUPLICATES=""

# Scan flat store (*.yaml)
if [[ -d "$FLAT_STORE" ]]; then
  while IFS= read -r -d '' f; do
    task_id="$(grep -m1 '^id: ' "$f" 2>/dev/null | sed 's/^id: //; s/^"//; s/"$//')"
    [[ -z "$task_id" ]] && continue
    if [[ -n "${SEEN_IDS[$task_id]+_}" ]]; then
      DUPLICATES+="${task_id} "
    else
      SEEN_IDS["$task_id"]="flat:$f"
    fi
  done < <(find "$FLAT_STORE" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null)
fi

# Scan legacy store (*.json)
if [[ -d "$LEGACY_STORE" ]]; then
  while IFS= read -r -d '' f; do
    task_id="$(jq -r '.id // empty' "$f" 2>/dev/null || true)"
    [[ -z "$task_id" ]] && continue
    if [[ -n "${SEEN_IDS[$task_id]+_}" ]]; then
      DUPLICATES+="${task_id} "
    else
      SEEN_IDS["$task_id"]="legacy:$f"
    fi
  done < <(find "$LEGACY_STORE" -maxdepth 1 -name '*.json' -print0 2>/dev/null)
fi

DUPLICATES="${DUPLICATES% }"  # trim trailing space
if [[ -n "$DUPLICATES" ]]; then
  REASON="Duplicate task IDs detected across the flat store and the legacy store after sync pull: IDs [${DUPLICATES}]. This indicates a conflict between the MCP task server's committed store and the built-in Task tool's per-session store. Resolve the conflict manually: rename or remove the duplicate entries in one store, then try again. Flat store: ${FLAT_STORE}, Legacy store: ${LEGACY_STORE}."
  log "deny: duplicate IDs=${DUPLICATES}"
  emit_decision "deny" "$REASON"
  exit 0
fi

log "allow: no conflicts"
emit_decision "allow" ""
exit 0
