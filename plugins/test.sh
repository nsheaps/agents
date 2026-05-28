#!/usr/bin/env bash
# Validate every Claude Code plugin manifest under plugins/claude-code/*.
# Self-contained — does NOT require mise to be on PATH (P2-2 from Henry's
# review of PR #182). When mise IS available, defers to `mise run validate`
# (which has the battle-tested fix-up steps like the claude-code postinstall
# repair). When mise is missing, falls back to a direct `claude plugin
# validate` sweep, so `bunx nx run @nsheaps/agents-plugins:test` works in any
# environment that has `claude` on PATH (npm install -g @anthropic-ai/claude-code)
# OR mise.
set -euo pipefail

# Resolve repo root from this script's location so the script can be invoked
# from any CWD (nx runs it from plugins/, dev runs it from anywhere).
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if command -v mise >/dev/null 2>&1; then
  exec mise run validate
fi

# No mise — try direct claude binary.
if ! command -v claude >/dev/null 2>&1; then
  cat >&2 <<'MSG'
ERROR: plugin validation requires either 'mise' or 'claude' on PATH.
  - In CI: jdx/mise-action installs both.
  - Locally: install mise (https://mise.jdx.dev) and run 'mise install',
    or 'npm install -g @anthropic-ai/claude-code' to get the claude binary.
MSG
  exit 1
fi

FAILED=()
shopt -s nullglob
for plugin_json in plugins/claude-code/*/.claude-plugin/plugin.json; do
  if OUTPUT=$(claude plugin validate "$plugin_json" 2>&1); then
    echo "✅ $plugin_json"
  else
    echo "❌ $plugin_json"
    echo "$OUTPUT" | sed 's/^/   /'
    FAILED+=("$plugin_json")
  fi
done
shopt -u nullglob

if [ ${#FAILED[@]} -gt 0 ]; then
  {
    echo ""
    echo "Failed to validate ${#FAILED[@]} plugin(s):"
    printf '  - %s\n' "${FAILED[@]}"
  } >&2
  exit 1
fi
echo "All plugins validated."
