#!/usr/bin/env bash
# sync-shared-config.sh — Setup/SessionStart hook for the shared-config plugin.
#
# Responsibilities (the heavy lifting lives in scripts/shared_config_sync.py):
#   1. Read the github-app token (GH_TOKEN), waiting briefly for the github-app
#      plugin to write it into CLAUDE_ENV_FILE so private source repos can be
#      cloned with the app token rather than whatever ambient creds exist.
#   2. Invoke the Python orchestrator that resolves settings (including the
#      $AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM bootstrap), clones/updates source
#      repos, and symlinks rules/skills/commands/agents into the project.
#   3. Emit SessionStart JSON with reloadSkills so freshly linked skills load
#      in the same session.
#
# Setup/SessionStart hooks must never break the session — the body runs under a
# trap that always exits 0, and the final JSON is emitted no matter what.
set -uo pipefail

PLUGIN_NAME="shared-config"
EVENT="SessionStart"
SUMMARY="shared-config: no work done"

emit_and_exit() {
  # Emit well-formed SessionStart JSON. reloadSkills makes newly linked skills
  # discoverable in the same session (skills are scanned before hooks finish).
  local ctx
  if command -v jq >/dev/null 2>&1; then
    ctx="$(printf '%s' "$SUMMARY" | jq -Rs .)"
  else
    # Minimal manual escape fallback if jq is unavailable.
    ctx="\"$(printf '%s' "$SUMMARY" | tr '\n' ' ' | sed 's/"/\\"/g')\""
  fi
  printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":%s},"reloadSkills":true}\n' \
    "$EVENT" "$ctx"
  exit 0
}
trap emit_and_exit EXIT

# --- Read hook input (best effort) ----------------------------------------
INPUT=""
if [ ! -t 0 ]; then
  INPUT="$(cat 2>/dev/null || true)"
fi
if [ -n "$INPUT" ] && command -v jq >/dev/null 2>&1; then
  parsed_event="$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty' 2>/dev/null || true)"
  [ -n "$parsed_event" ] && EVENT="$parsed_event"
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"

# --- Resolve the token-wait timeout ---------------------------------------
# Precedence: explicit env override > settings file > default (15s).
resolve_timeout() {
  if [ -n "${AGENT_PLUGIN_SHARED_CONFIG_WAIT_TOKEN_TIMEOUT:-}" ]; then
    printf '%s' "$AGENT_PLUGIN_SHARED_CONFIG_WAIT_TOKEN_TIMEOUT"
    return
  fi
  if command -v yq >/dev/null 2>&1; then
    local f v
    for f in \
      "${PROJECT_DIR}/.claude/shared-config.settings.yaml" \
      "${PROJECT_DIR}/.claude/plugins.settings.yaml" \
      "${HOME}/.claude/shared-config.settings.yaml" \
      "${HOME}/.claude/plugins.settings.yaml"; do
      [ -f "$f" ] || continue
      v="$(yq -r '.waitForTokenTimeoutSeconds // .["shared-config"].waitForTokenTimeoutSeconds // ""' "$f" 2>/dev/null || true)"
      if [ -n "$v" ] && [ "$v" != "null" ]; then
        printf '%s' "$v"
        return
      fi
    done
  fi
  printf '15'
}
TOKEN_TIMEOUT="$(resolve_timeout)"
case "$TOKEN_TIMEOUT" in
  ''|*[!0-9]*) TOKEN_TIMEOUT=15 ;;
esac

# --- Wait for the github-app token ----------------------------------------
# The github-app plugin writes GH_TOKEN/GITHUB_TOKEN (and GITHUB_TOKEN_FILE) by
# appending a `source <runtime-env>` line to CLAUDE_ENV_FILE. We re-source that
# file each poll and treat GITHUB_TOKEN_FILE as the "github-app produced a
# token" signal so we prefer it over any ambient GH_TOKEN. If it never appears
# (github-app not installed / no creds), we fall back to whatever GH_TOKEN is in
# the environment, or proceed tokenless (fine for public repos).
wait_for_github_app_token() {
  local timeout="$1" elapsed=0 interval=1
  [ "$timeout" -le 0 ] && return 0
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    while [ "$elapsed" -lt "$timeout" ]; do
      if [ -f "$CLAUDE_ENV_FILE" ]; then
        # shellcheck disable=SC1090
        set +u; . "$CLAUDE_ENV_FILE" >/dev/null 2>&1 || true; set -u
        [ -n "${GITHUB_TOKEN_FILE:-}" ] && [ -n "${GH_TOKEN:-}" ] && return 0
      fi
      sleep "$interval"
      elapsed=$((elapsed + interval))
      interval=$((interval * 2))
      [ "$interval" -gt 4 ] && interval=4
    done
  fi
  return 0
}

if [ -z "${GH_TOKEN:-}" ] || [ -z "${GITHUB_TOKEN_FILE:-}" ]; then
  echo "${PLUGIN_NAME}: waiting up to ${TOKEN_TIMEOUT}s for github-app token..." >&2
  wait_for_github_app_token "$TOKEN_TIMEOUT"
fi
# Keep GH_TOKEN / GITHUB_TOKEN in sync for downstream git/gh usage.
if [ -n "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
  export GITHUB_TOKEN="$GH_TOKEN"
elif [ -n "${GITHUB_TOKEN:-}" ] && [ -z "${GH_TOKEN:-}" ]; then
  export GH_TOKEN="$GITHUB_TOKEN"
fi
if [ -n "${GH_TOKEN:-}" ]; then
  echo "${PLUGIN_NAME}: using token (source: ${GITHUB_TOKEN_FILE:+github-app}${GITHUB_TOKEN_FILE:-ambient})" >&2
else
  echo "${PLUGIN_NAME}: no token available; only public source repos will clone" >&2
fi

# --- Run the orchestrator -------------------------------------------------
PY_BIN=""
for cand in python3 python; do
  if command -v "$cand" >/dev/null 2>&1; then PY_BIN="$cand"; break; fi
done
if [ -z "$PY_BIN" ]; then
  SUMMARY="shared-config: python3 not found; skipped"
  echo "$SUMMARY" >&2
  exit 0
fi

SCRIPT_DIR="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PY_SCRIPT="${SCRIPT_DIR}/scripts/shared_config_sync.py"

# Capture stdout (the one-line summary) for additionalContext; let stderr flow
# through to the hook log.
if out="$("$PY_BIN" "$PY_SCRIPT")"; then
  [ -n "$out" ] && SUMMARY="$out"
else
  SUMMARY="shared-config: sync encountered an error (see stderr); session continues"
fi

exit 0
