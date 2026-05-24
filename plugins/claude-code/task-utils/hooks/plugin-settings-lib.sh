#!/usr/bin/env bash
# plugin-settings-lib.sh — 3-tier config reader for task-utils hooks.
#
# Implements the plugins.settings.yaml pattern:
#   Tier 1 (highest): $CLAUDE_PROJECT_DIR/.claude/plugins.settings.yaml
#                     under a "task-utils:" block.
#   Tier 2:           ~/.claude/plugins.settings.yaml
#                     under a "task-utils:" block.
#   Tier 3 (lowest):  ${CLAUDE_PLUGIN_ROOT}/task-utils.settings.yaml
#                     (plugin defaults, flat YAML — no namespace block).
#
# Usage (source this file, then call plugin_get_config):
#   PLUGIN_NAME="task-utils"   # required before sourcing
#   HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   . "$HOOK_DIR/plugin-settings-lib.sh"
#   mode="$(plugin_get_config "nativeTaskMode" "warn")"
#
# All settings keys are camelCase per settings-key-naming.md.
# No `set -e` — this file is sourced; callers own their own shell options.

# ---- Internal: YAML key extraction ------------------------------------------
#
# _settings_get_flat <file> <key>
#   Reads a top-level key from a flat YAML file (plugin defaults file).
#   Returns the value, or empty string if not found.
_settings_get_flat() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  if command -v yq >/dev/null 2>&1; then
    # -r: raw output (strips surrounding quotes from string scalars).
    yq -er ".${key} // empty" "$file" 2>/dev/null | grep -v '^null$' || true
  else
    # Fallback: grep + sed for simple scalar values (no nested YAML).
    grep -m1 "^${key}:" "$file" 2>/dev/null \
      | sed "s/^${key}:[[:space:]]*//" \
      | sed "s/^['\"]//; s/['\"]$//" \
      | tr -d '\r' \
      || true
  fi
}

# _settings_get_namespaced <file> <namespace> <key>
#   Reads a key nested under <namespace>: in a plugins.settings.yaml file.
#   Returns the value, or empty string if not found.
_settings_get_namespaced() {
  local file="$1" ns="$2" key="$3"
  [[ -f "$file" ]] || return 0
  if command -v yq >/dev/null 2>&1; then
    # Quote the namespace key to handle hyphens (e.g. "task-utils").
    # -r: raw output (strips surrounding quotes from string scalars).
    yq -er ".\"${ns}\".${key} // empty" "$file" 2>/dev/null | grep -v '^null$' || true
  else
    # Fallback: awk to extract block under <ns>: then find the key.
    awk -v ns="$ns" -v key="$key" '
      /^[[:space:]]/ { if (in_ns) { sub(/^[[:space:]]+/, ""); if ($0 ~ "^" key ":") { sub("^" key ":[[:space:]]*", ""); gsub(/^['"'"'"]|['"'"'"]$/, ""); print; exit } } next }
      { in_ns = ($0 == ns ":") }
    ' "$file" 2>/dev/null | tr -d '\r' || true
  fi
}

# ---- Public API --------------------------------------------------------------

# plugin_get_config <key> [default]
#   Returns the value of <key> from the 3-tier config, or <default> if unset.
#   Precedence: project settings > user settings > plugin defaults.
plugin_get_config() {
  local key="$1"
  local default_val="${2:-}"
  local ns="${PLUGIN_NAME:-task-utils}"

  # Resolve settings file locations.
  local plugin_default_file=""
  if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
    plugin_default_file="${CLAUDE_PLUGIN_ROOT}/${ns}.settings.yaml"
  else
    # Fallback: locate the defaults file relative to this script.
    local _lib_dir
    _lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    plugin_default_file="${_lib_dir}/../${ns}.settings.yaml"
  fi

  local user_settings_file="${HOME}/.claude/plugins.settings.yaml"
  local project_settings_file="${CLAUDE_PROJECT_DIR:-}/.claude/plugins.settings.yaml"

  local value=""

  # Tier 1: project-level override (highest priority).
  if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
    value="$(_settings_get_namespaced "$project_settings_file" "$ns" "$key")"
    [[ -n "$value" ]] && { printf '%s\n' "$value"; return 0; }
  fi

  # Tier 2: user-level override.
  value="$(_settings_get_namespaced "$user_settings_file" "$ns" "$key")"
  [[ -n "$value" ]] && { printf '%s\n' "$value"; return 0; }

  # Tier 3: plugin defaults.
  value="$(_settings_get_flat "$plugin_default_file" "$key")"
  [[ -n "$value" ]] && { printf '%s\n' "$value"; return 0; }

  # Fallback to caller-supplied default.
  printf '%s\n' "$default_val"
}
