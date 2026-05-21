#!/usr/bin/env bash
# sync-rules.sh — SessionStart hook for agent-utils plugin.
# Symlinks $CLAUDE_PROJECT_DIR/.claude/rules/agent-utils -> $CLAUDE_PLUGIN_ROOT/rules
# so the plugin's rules/ are visible as Claude Code context. Idempotent.
set -euo pipefail

PLUGIN_NAME="agent-utils"
PLUGIN_RULES_DIR="${CLAUDE_PLUGIN_ROOT}/rules"
PROJECT_RULES_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/rules"
LINK_PATH="${PROJECT_RULES_DIR}/${PLUGIN_NAME}"

mkdir -p "$PROJECT_RULES_DIR"

if [ -L "$LINK_PATH" ]; then
  current_target="$(readlink "$LINK_PATH")"
  if [ "$current_target" = "$PLUGIN_RULES_DIR" ]; then
    echo "${PLUGIN_NAME}: rules symlink already current" >&2
    exit 0
  fi
  rm -f "$LINK_PATH"
elif [ -e "$LINK_PATH" ]; then
  echo "${PLUGIN_NAME}: WARNING: ${LINK_PATH} exists as a real path, not replacing — remove manually if unintentional" >&2
  exit 0
fi

if ln -s "$PLUGIN_RULES_DIR" "$LINK_PATH"; then
  echo "${PLUGIN_NAME}: linked ${LINK_PATH} -> ${PLUGIN_RULES_DIR}" >&2
else
  echo "${PLUGIN_NAME}: ERROR: failed to create symlink ${LINK_PATH}" >&2
  exit 0
fi
