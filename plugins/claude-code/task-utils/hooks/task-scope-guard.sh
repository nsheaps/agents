#!/usr/bin/env bash
# task-scope-guard.sh — UserPromptSubmit hook
#
# Advisory scope-creep guard. When the user submits a prompt that appears to
# request new work while a task is already in_progress, inject a systemMessage
# advisory reminding the agent to create a new task rather than expanding the
# current one.
#
# This is ADVISORY ONLY (not blocking). The prompt is never denied. The
# systemMessage is injected into Claude's context as a reminder. Per handler
# direction (OQ6): RC4 enforcement is advisory via systemMessage; a hard deny
# would be too disruptive for scope-change prompts.
#
# Heuristic: the user prompt contains scope-expansion phrases such as:
#   "also add", "while you're at it", "additionally", "and also fix",
#   "also make", "also update", "and also", "while we're at it",
#   "one more thing", "quick addition"
#
# Only fires when there IS an in_progress task (no-op if no task in flight).
#
# Opt-out: none needed — advisory hooks that emit only systemMessage cannot
# block the user and are always safe to leave enabled.
#
# Sidecar log: .claude/logs/task-scope-guard.log
#
# Output contract (UserPromptSubmit):
#   - Exit 0 always
#   - JSON with optional systemMessage (advisory text)
#   - Never sets permissionDecision (advisory only)

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=task-store-lib.sh
. "$HOOK_DIR/task-store-lib.sh"

INPUT="$(cat)"
SESSION_ID="$(jq -r '.session_id // empty' <<<"$INPUT")"
USER_PROMPT="$(jq -r '.user_prompt // empty' <<<"$INPUT")"

LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/logs"
LOG_FILE="$LOG_DIR/task-scope-guard.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$LOG_FILE" 2>/dev/null || true
}

emit_advisory() {
  local msg="$1"
  jq -n --arg msg "$msg" '{ systemMessage: $msg }'
}

# Skip if no prompt
if [[ -z "$USER_PROMPT" ]]; then
  exit 0
fi

# ---- Check for scope-expansion phrases in the user prompt -------------------
PROMPT_LOWER="$(printf '%s\n' "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')"
SCOPE_MATCH=0
for phrase in \
  "also add" \
  "while you're at it" \
  "while you are at it" \
  "additionally" \
  "and also fix" \
  "and also add" \
  "and also update" \
  "and also" \
  "while we're at it" \
  "while we are at it" \
  "one more thing" \
  "quick addition" \
  "also make" \
  "also update" \
  "also fix"; do
  if [[ "$PROMPT_LOWER" == *"${phrase}"* ]]; then
    SCOPE_MATCH=1
    break
  fi
done

if [[ "$SCOPE_MATCH" -eq 0 ]]; then
  exit 0
fi

# ---- Find the current in_progress task (if any) ----------------------------
BASE_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FLAT_STORE="$(resolve_flat_store_root "$BASE_DIR")"
LEGACY_STORE="$(resolve_legacy_store_dir "$SESSION_ID")"

IN_PROGRESS_ID=""
IN_PROGRESS_SUBJ=""

# Scan flat store (*.yaml)
if [[ -d "$FLAT_STORE" ]]; then
  while IFS= read -r -d '' f; do
    f_status="$(grep -m1 '^status: ' "$f" 2>/dev/null | awk '{print $2}')"
    if [[ "$f_status" == "in_progress" ]]; then
      IN_PROGRESS_ID="$(grep -m1 '^id: ' "$f" 2>/dev/null | sed 's/^id: //; s/^"//; s/"$//')"
      IN_PROGRESS_SUBJ="$(grep -m1 '^subject: ' "$f" 2>/dev/null | sed 's/^subject: //; s/^"//; s/"$//')"
      break
    fi
  done < <(find "$FLAT_STORE" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null)
fi

# Scan legacy store (*.json) if flat store had nothing
if [[ -z "$IN_PROGRESS_ID" && -d "$LEGACY_STORE" ]]; then
  while IFS= read -r -d '' f; do
    f_status="$(jq -r '.status // empty' "$f" 2>/dev/null || true)"
    if [[ "$f_status" == "in_progress" ]]; then
      IN_PROGRESS_ID="$(jq -r '.id // empty' "$f" 2>/dev/null || true)"
      IN_PROGRESS_SUBJ="$(jq -r '.subject // empty' "$f" 2>/dev/null || true)"
      break
    fi
  done < <(find "$LEGACY_STORE" -maxdepth 1 -name '*.json' -print0 2>/dev/null)
fi

# No in_progress task — nothing to advise
if [[ -z "$IN_PROGRESS_ID" ]]; then
  exit 0
fi

# ---- Emit advisory systemMessage -------------------------------------------
MSG="Scope-creep advisory: you have a task in_progress (#${IN_PROGRESS_ID}: ${IN_PROGRESS_SUBJ}). This new request may be out-of-scope for the current task. If the new work is unrelated or can be done separately, create a new task for it via TaskCreate rather than expanding the current task's description. Keeping tasks atomic ensures each one remains completable and validatable on its own."

log "advisory: in_progress=#${IN_PROGRESS_ID} prompt_match=scope-expansion-phrase"
emit_advisory "$MSG"
exit 0
