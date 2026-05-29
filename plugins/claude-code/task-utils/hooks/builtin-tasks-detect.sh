#!/usr/bin/env bash
# builtin-tasks-detect.sh — sourced lib: detect whether native Task tools are enabled.
#
# Claude Code's built-in Task tools (TaskCreate, TaskUpdate, TaskList, TaskGet)
# can be disabled via the CLAUDE_CODE_ENABLE_TASKS environment variable. This
# lib provides is_builtin_tasks_enabled() so hooks can skip logic that only
# applies when the native task system is active.
#
# Usage (source this file, then call the function):
#   . "$HOOK_DIR/builtin-tasks-detect.sh"
#   if is_builtin_tasks_enabled; then ... fi
#
# Semantics match Claude Code's own interpretation of CLAUDE_CODE_ENABLE_TASKS:
#   0 / false / off / no  → native tasks DISABLED → returns 1 (false)
#   1 / true  / on  / yes → native tasks ENABLED  → returns 0 (true)
#   unset + TTY           → default ON  → returns 0 (true)
#   unset + non-TTY       → default OFF → returns 1 (false)
#   any other value       → treated as enabled → returns 0 (true)
#
# Source: Claude Code Tools Reference (CLAUDE_CODE_ENABLE_TASKS env var).
#
# No `set -e` — this file is sourced; callers own their own shell options.

# is_builtin_tasks_enabled
#   Returns 0 (shell true) if native TaskCreate/TaskUpdate/etc. are active,
#   1 (shell false) if they are disabled.
is_builtin_tasks_enabled() {
  local val="${CLAUDE_CODE_ENABLE_TASKS:-}"
  case "$val" in
    0|false|off|no)  return 1 ;;
    1|true|on|yes)   return 0 ;;
    "")
      # Unset: active when stdin is a TTY (interactive session).
      # In non-TTY contexts (Claude Code web, CI, piped) native tasks are off.
      [ -t 0 ] && return 0 || return 1 ;;
    *)
      # Unknown value — treat as enabled (safe default).
      return 0 ;;
  esac
}
