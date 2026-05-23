#!/usr/bin/env bash
# task-store-lib.sh — shared task-store resolution for the task-utils hooks.
#
# Sourced by require-task-in-progress.sh and task-invariant.sh. Defines two
# helpers so both hooks resolve task storage identically and agree with the
# MCP task server (mcp/src/store.ts).
#
# Storage model (matches mcp/src/store.ts):
#   - MCP / flat store: tasks live FLAT at `<store-root>/<task-id>.yaml`.
#       store-root = $TASK_UTILS_TASK_DIR            (if set, used verbatim)
#                  | <git-repo-root>/.claude/tasks   (repo root of CWD)
#                  | <CWD>/.claude/tasks             (fallback, not in a repo)
#   - Legacy store: the BUILT-IN Task tools write per-session task files at
#       ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/<task-id>.json
#     The hooks still read this location so built-in-Task-tool users are not
#     broken by the addition of the MCP fallback.
#
# No `set -e` here — this file is sourced; callers own their own shell options.

# resolve_flat_store_root <base_dir>
#   Echoes the flat task-store root (the location the MCP server writes to).
resolve_flat_store_root() {
  local base_dir="${1:-$(pwd)}"
  if [[ -n "${TASK_UTILS_TASK_DIR:-}" ]]; then
    printf '%s\n' "$TASK_UTILS_TASK_DIR"
    return 0
  fi
  local repo_root
  repo_root="$(git -C "$base_dir" rev-parse --show-toplevel 2>/dev/null)"
  if [[ -n "$repo_root" ]]; then
    printf '%s/.claude/tasks\n' "$repo_root"
    return 0
  fi
  printf '%s/.claude/tasks\n' "$base_dir"
}

# resolve_legacy_store_dir <session_id>
#   Echoes the per-session directory the built-in Task tools write to.
resolve_legacy_store_dir() {
  local session_id="$1"
  local claude_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
  printf '%s/tasks/%s\n' "$claude_dir" "$session_id"
}

# count_in_progress_flat <store_root>
#   Echoes the number of *.yaml files directly under <store_root> whose
#   status is "in_progress" (flat layout, maxdepth 1).
#
#   DEPRECATED: use count_in_progress_store instead, which scans BOTH
#   *.yaml (MCP-managed) and *.json (built-in Task tool legacy) files.
#   Kept for backwards compatibility; callers that already pass the flat
#   MCP store root can use either function.
count_in_progress_flat() {
  count_in_progress_store "$1"
}

# count_in_progress_store <store_root>
#   Echoes the number of task files directly under <store_root> whose
#   status is "in_progress". Scans BOTH *.yaml (MCP-managed flat store,
#   new format) and *.json (built-in Task tools legacy format, backward
#   compat). Maxdepth 1 — no recursive descent.
#
#   YAML status is read with grep (fast, no extra deps).
#   JSON status is read with jq (required for JSON parsing).
count_in_progress_store() {
  local store_root="$1"
  local count=0 f f_status
  [[ -d "$store_root" ]] || { printf '0\n'; return 0; }
  # Scan YAML files (MCP-managed tasks, v0.1.4+ format)
  while IFS= read -r -d '' f; do
    f_status="$(grep -m1 '^status: ' "$f" 2>/dev/null | awk '{print $2}')"
    [[ "$f_status" == "in_progress" ]] && count=$((count + 1))
  done < <(find "$store_root" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null)
  # Scan JSON files (built-in TaskCreate/TaskUpdate legacy store, backward compat)
  while IFS= read -r -d '' f; do
    f_status="$(jq -r '.status // empty' "$f" 2>/dev/null || true)"
    [[ "$f_status" == "in_progress" ]] && count=$((count + 1))
  done < <(find "$store_root" -maxdepth 1 -name '*.json' -print0 2>/dev/null)
  printf '%s\n' "$count"
}
