#!/usr/bin/env bash
# build.sh — on-device build-if-missing for the task-utils MCP server.
#
# The task-utils MCP server is shipped as TypeScript SOURCE only. The runnable
# artifact is a native executable produced by `bun build --compile`, which is
# platform-specific — so it cannot be committed and shipped; it must be built
# on the end user's machine. This script does that build, lazily and exactly
# once per (machine, plugin-version).
#
# Idempotent + loop-safe:
#   - Skips the build when an up-to-date binary already exists (the version
#     marker matches the installed plugin version).
#   - A directory lock (atomic `mkdir`) serialises concurrent invocations
#     (multiple Claude Code sessions, the SessionStart pre-warm racing the MCP
#     launch wrapper). One process builds; the others wait then exec.
#   - The binary is built to a temp path and atomically `mv`d into place, so a
#     crashed/killed build never leaves a half-written binary at the real path.
#
# Environment (provided by Claude Code to plugin hooks / MCP servers):
#   CLAUDE_PLUGIN_ROOT  absolute path to the installed plugin dir (ephemeral —
#                       overwritten on plugin update). Holds the mcp/ source.
#   CLAUDE_PLUGIN_DATA  per-plugin persistent state dir (survives updates).
#                       The compiled binary + version marker live here.
#
# Exit status: 0 when an up-to-date binary is present on return; non-zero (with
# a diagnostic on stderr) when the build could not be completed.

set -euo pipefail

log() { printf 'task-utils[build]: %s\n' "$*" >&2; }
die() {
  log "ERROR: $*"
  exit 1
}

# --- Resolve paths -----------------------------------------------------------
# CLAUDE_PLUGIN_ROOT is normally injected; fall back to this script's own dir
# so the script also works when run by hand from a checkout.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# CLAUDE_PLUGIN_ROOT is injected by Claude Code; when running by hand from the
# monorepo the script lives at services/task-mcp-service/ so we go up two
# levels (services/ -> repo root) to reach the plugin root equivalent.
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
MCP_SRC_DIR="$PLUGIN_ROOT/services/task-mcp-service"

# CLAUDE_PLUGIN_DATA persists across plugin updates — the right home for a
# built artifact. Fall back to a per-plugin dir under the user's claude config
# when it is not set (older Claude Code, or hand runs).
if [[ -n "${CLAUDE_PLUGIN_DATA:-}" ]]; then
  DATA_DIR="$CLAUDE_PLUGIN_DATA"
else
  DATA_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugin-data/task-utils"
fi
BIN_DIR="$DATA_DIR/bin"
BINARY="$BIN_DIR/task-mcp"
VERSION_MARKER="$BIN_DIR/task-mcp.version"
LOCK_DIR="$BIN_DIR/.build.lock"

# --- Resolve the installed plugin version ------------------------------------
# The binary is keyed by plugin version: a version bump invalidates a stale
# binary even though CLAUDE_PLUGIN_DATA persists across updates.
PLUGIN_JSON="$PLUGIN_ROOT/.claude-plugin/plugin.json"
read_version() {
  [[ -f "$PLUGIN_JSON" ]] || {
    printf 'unknown'
    return 0
  }
  # `bun` is required for the build anyway, so use it to read JSON robustly
  # (no jq dependency). Falls back to "unknown" if parsing fails.
  bun -e '
    try {
      const v = require(process.argv[1]).version;
      process.stdout.write(typeof v === "string" && v ? v : "unknown");
    } catch { process.stdout.write("unknown"); }
  ' "$PLUGIN_JSON" 2>/dev/null || printf 'unknown'
}

# --- Up-to-date check --------------------------------------------------------
binary_is_current() {
  [[ -x "$BINARY" && -f "$VERSION_MARKER" ]] || return 1
  [[ "$(cat "$VERSION_MARKER" 2>/dev/null || true)" == "$1" ]]
}

# --- The actual build --------------------------------------------------------
do_build() {
  local version="$1"
  command -v bun >/dev/null 2>&1 ||
    die "'bun' is required to build the task-utils MCP server but was not found on PATH. Install bun from https://bun.sh"
  [[ -f "$MCP_SRC_DIR/src/server.ts" ]] ||
    die "MCP server source not found at $MCP_SRC_DIR/src/server.ts"

  mkdir -p "$BIN_DIR"
  log "building native MCP server binary (plugin v$version) — first run on this machine, this can take a moment..."

  # Resolve dependencies from the shipped lockfile (reproducible). node_modules
  # lands in the ephemeral plugin dir — that is fine, it is only build scratch;
  # `bun build --compile` inlines everything into the output binary.
  ( cd "$MCP_SRC_DIR" && bun install --frozen-lockfile ) ||
    ( cd "$MCP_SRC_DIR" && bun install ) ||
    die "bun install failed"

  # Build to a temp path, then atomically move into place — a killed build
  # never leaves a half-written binary where the up-to-date check would
  # accept it.
  local tmp_bin="$BIN_DIR/task-mcp.tmp.$$"
  ( cd "$MCP_SRC_DIR" && bun build --compile --outfile "$tmp_bin" src/server.ts ) ||
    die "bun build --compile failed"
  chmod +x "$tmp_bin"
  mv -f "$tmp_bin" "$BINARY"
  printf '%s' "$version" > "$VERSION_MARKER"
  log "built $BINARY (plugin v$version)"
}

# --- Lock-guarded build ------------------------------------------------------
main() {
  local version
  version="$(read_version)"

  # Fast path: already up to date, nothing to do.
  if binary_is_current "$version"; then
    exit 0
  fi

  mkdir -p "$BIN_DIR"

  # Steal a stale lock (a previous build crashed before cleanup). 600s is far
  # longer than any healthy `bun install` + compile.
  if [[ -d "$LOCK_DIR" ]]; then
    local lock_age=0 lock_mtime
    if lock_mtime="$(stat -c %Y "$LOCK_DIR" 2>/dev/null || stat -f %m "$LOCK_DIR" 2>/dev/null)"; then
      lock_age=$(( $(date +%s) - lock_mtime ))
    fi
    if (( lock_age > 600 )); then
      log "removing stale build lock (${lock_age}s old)"
      rmdir "$LOCK_DIR" 2>/dev/null || true
    fi
  fi

  # `mkdir` is atomic — exactly one racer wins the lock.
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    # We hold the lock — always release it on exit, even on failure.
    trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
    # Re-check under the lock: a racer may have built while we waited.
    if ! binary_is_current "$version"; then
      do_build "$version"
    fi
    exit 0
  fi

  # Another process holds the lock — wait for it to produce the binary.
  log "another process is building the MCP server; waiting..."
  local waited=0
  while (( waited < 600 )); do
    binary_is_current "$version" && exit 0
    [[ -d "$LOCK_DIR" ]] || break   # builder released the lock — re-evaluate
    sleep 1
    waited=$((waited + 1))
  done

  # The builder finished or vanished. Final check, then a last-resort build.
  binary_is_current "$version" && exit 0
  log "build lock cleared without an up-to-date binary; building directly"
  rmdir "$LOCK_DIR" 2>/dev/null || true
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
  fi
  binary_is_current "$version" || do_build "$version"
}

main "$@"
