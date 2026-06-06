#!/usr/bin/env bash
# sync-shared-config.sh — Setup/SessionStart hook for the shared-config plugin.
#
# Responsibilities (the heavy lifting lives in scripts/shared_config_sync.py):
#   1. Resolve plugin settings via the shared-lib `plugin-config-read.sh`
#      3-tier mechanism (project > user > plugin default), under the
#      `shared-config:` namespace.
#   2. Wait for the github-app plugin to publish GH_TOKEN into CLAUDE_ENV_FILE
#      so private source repos clone with the app token rather than ambient
#      creds.
#   3. Invoke the Python orchestrator, passing the resolved config as JSON. The
#      orchestrator layers in the $AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM bootstrap
#      and the optional standalone shared-config.settings.yaml overlay, then
#      clones sources and symlinks rules/skills/commands/agents into the project.
#   4. Emit SessionStart JSON with reloadSkills so freshly linked skills load in
#      the same session.
#
# Setup/SessionStart hooks must never break the session — the body runs under a
# trap that always exits 0, and the final JSON is emitted no matter what.
set -uo pipefail

PLUGIN_NAME="shared-config"
EVENT="SessionStart"
SUMMARY="shared-config: no work done"

emit_and_exit() {
  # reloadSkills makes newly linked skills discoverable in the same session
  # (skills are scanned before SessionStart hooks finish).
  local ctx
  if command -v jq >/dev/null 2>&1; then
    ctx="$(printf '%s' "$SUMMARY" | jq -Rs .)"
  else
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

# --- Locate + source the shared-lib (ai-mktpl dependency) ------------------
# Deterministic data-dir path per the plugins reference: {plugin}-{marketplace}.
if [ -n "${CLAUDE_PLUGIN_DATA:-}" ]; then
  SHARED_LIB_DIR="${CLAUDE_PLUGIN_DATA%/*}/shared-lib-ai-mktpl/lib"
else
  SHARED_LIB_DIR="${HOME}/.claude/plugins/data/shared-lib-ai-mktpl/lib"
fi

_wait_for_shared_lib() { # SessionStart hooks across plugins run in parallel.
  local lib="$1" i=0
  while [ ! -f "$SHARED_LIB_DIR/$lib" ]; do
    i=$((i + 1))
    [ "$i" -ge 10 ] && return 1   # ~5s, then degrade gracefully
    sleep 0.5
  done
  return 0
}

HAVE_LIB=0
if _wait_for_shared_lib "plugin-config-read.sh"; then
  # shellcheck source=/dev/null
  . "$SHARED_LIB_DIR/log.sh" 2>/dev/null || true
  # shellcheck source=/dev/null
  if . "$SHARED_LIB_DIR/plugin-config-read.sh" 2>/dev/null; then
    HAVE_LIB=1
  fi
fi
if [ "$HAVE_LIB" -ne 1 ]; then
  echo "${PLUGIN_NAME}: shared-lib not available; falling back to upstream/standalone config only" >&2
fi

# --- Resolve config via the shared-lib ------------------------------------
# Empty-string / "[]" sentinels let the Python layer distinguish "unset"
# (so upstream/defaults can apply) from an explicit repo-level value.
CFG_ENABLED=""; CFG_DEFSRC=""; CFG_TARGET=""; CFG_WAIT=""; CFG_MERGE=""
CFG_TYPES="[]"; CFG_SOURCES="[]"
if [ "$HAVE_LIB" -eq 1 ]; then
  CFG_ENABLED="$(plugin_get_config "enabled" "")"
  CFG_DEFSRC="$(plugin_get_config "defaultSourceDir" "")"
  CFG_TARGET="$(plugin_get_config "targetBaseDir" "")"
  CFG_WAIT="$(plugin_get_config "waitForTokenTimeoutSeconds" "")"
  CFG_MERGE="$(plugin_get_config "mergeSettings" "")"
  CFG_TYPES="$(plugin_get_config_json "resourceTypes" "[]")"
  CFG_SOURCES="$(plugin_get_config_json "sources" "[]")"
fi

if command -v jq >/dev/null 2>&1; then
  CONFIG_JSON="$(jq -n \
    --arg enabled "$CFG_ENABLED" \
    --arg defaultSourceDir "$CFG_DEFSRC" \
    --arg targetBaseDir "$CFG_TARGET" \
    --arg waitForTokenTimeoutSeconds "$CFG_WAIT" \
    --arg mergeSettings "$CFG_MERGE" \
    --argjson resourceTypes "${CFG_TYPES:-[]}" \
    --argjson sources "${CFG_SOURCES:-[]}" \
    '{enabled:$enabled, defaultSourceDir:$defaultSourceDir, targetBaseDir:$targetBaseDir,
      waitForTokenTimeoutSeconds:$waitForTokenTimeoutSeconds, mergeSettings:$mergeSettings,
      resourceTypes:$resourceTypes, sources:$sources}' 2>/dev/null || echo '{}')"
else
  CONFIG_JSON="{}"
fi
export SHARED_CONFIG_LIB_JSON="$CONFIG_JSON"

# --- Wait for the github-app token ----------------------------------------
TOKEN_TIMEOUT="${AGENT_PLUGIN_SHARED_CONFIG_WAIT_TOKEN_TIMEOUT:-$CFG_WAIT}"
case "$TOKEN_TIMEOUT" in
  ''|*[!0-9]*) TOKEN_TIMEOUT=15 ;;
esac

# github-app appends `source <runtime-env>` to CLAUDE_ENV_FILE which exports
# GH_TOKEN/GITHUB_TOKEN and GITHUB_TOKEN_FILE. We re-source it each poll and use
# GITHUB_TOKEN_FILE as the "github-app produced a token" signal so we prefer it
# over any ambient GH_TOKEN. Falls back to ambient / tokenless after the wait.
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
if [ -n "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
  export GITHUB_TOKEN="$GH_TOKEN"
elif [ -n "${GITHUB_TOKEN:-}" ] && [ -z "${GH_TOKEN:-}" ]; then
  export GH_TOKEN="$GITHUB_TOKEN"
fi
if [ -n "${GH_TOKEN:-}" ]; then
  echo "${PLUGIN_NAME}: using token (${GITHUB_TOKEN_FILE:+github-app}${GITHUB_TOKEN_FILE:-ambient})" >&2
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

if out="$("$PY_BIN" "$PY_SCRIPT")"; then
  [ -n "$out" ] && SUMMARY="$out"
else
  SUMMARY="shared-config: sync encountered an error (see stderr); session continues"
fi

exit 0
