#!/usr/bin/env bash
# launch.sh — the MCP server's launch command (referenced from .mcp.json).
#
# This wrapper is the LOAD-BEARING build-if-missing mechanism. Because it is
# the `command` Claude Code runs to start the MCP server, it is impossible for
# the server to be launched without the native binary existing: the wrapper
# builds it first (synchronously, via build.sh) and only then `exec`s it.
#
# - First run on a machine (binary absent): build.sh compiles the binary, then
#   this script execs it.
# - Subsequent runs (binary present + version current): build.sh returns
#   immediately and this script execs the binary with no rebuild.
#
# `exec` replaces this shell with the binary, so the binary owns stdin/stdout
# directly — the MCP stdio transport is unaffected by the wrapper.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure the native binary exists and is current (no-op when already built).
# build.sh resolves the same BIN path this script execs below.
bash "$SCRIPT_DIR/build.sh"

# Resolve the binary path identically to build.sh.
if [[ -n "${CLAUDE_PLUGIN_DATA:-}" ]]; then
  DATA_DIR="$CLAUDE_PLUGIN_DATA"
else
  DATA_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugin-data/task-utils"
fi
BINARY="$DATA_DIR/bin/task-mcp"

if [[ ! -x "$BINARY" ]]; then
  printf 'task-utils[launch]: ERROR: MCP server binary not found at %s after build\n' "$BINARY" >&2
  exit 1
fi

# Hand stdin/stdout to the binary — it speaks the MCP stdio protocol directly.
exec "$BINARY" "$@"
