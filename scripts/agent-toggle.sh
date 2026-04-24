#!/usr/bin/env bash
# agent-toggle.sh — enable/disable an agent in agents.yaml
set -euo pipefail

ACTION="${1:?Usage: agent-toggle.sh <enable|disable> <agent-name>}"
AGENT="${2:?Usage: agent-toggle.sh <enable|disable> <agent-name>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS_FILE="$REPO_ROOT/agents.yaml"

if [[ ! -f "$AGENTS_FILE" ]]; then
  echo "ERROR: $AGENTS_FILE not found" >&2
  exit 1
fi

# Verify agent exists in the file
if ! yq -e ".agents[] | select(.name == \"$AGENT\")" "$AGENTS_FILE" > /dev/null 2>&1; then
  echo "ERROR: Agent '$AGENT' not found in $AGENTS_FILE" >&2
  echo "Available agents:"
  yq '.agents[].name' "$AGENTS_FILE"
  exit 1
fi

case "$ACTION" in
  enable)  yq -i "(.agents[] | select(.name == \"$AGENT\")).enabled = true" "$AGENTS_FILE" ;;
  disable) yq -i "(.agents[] | select(.name == \"$AGENT\")).enabled = false" "$AGENTS_FILE" ;;
  *)       echo "Usage: agent-toggle.sh <enable|disable> <agent-name>" >&2; exit 1 ;;
esac

echo "Agent '$AGENT' ${ACTION}d in $AGENTS_FILE"
