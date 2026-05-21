#!/usr/bin/env bash
# prewarm.sh — SessionStart pre-warm for the task-utils MCP server build.
#
# Referenced from hooks/hooks.json as a SessionStart hook. It kicks off the
# native-binary build (build.sh) DETACHED in the background and returns
# immediately, so the session is never blocked waiting for a compile.
#
# This is an OPTIMISATION, not a correctness mechanism: the load-bearing
# build-if-missing path is launch.sh (the MCP server's launch command). The
# pre-warm just improves the odds the binary is already built by the time the
# MCP server connects, avoiding a slow first connection. build.sh is
# idempotent and lock-guarded, so the pre-warm racing the launch wrapper is
# safe — whichever wins the lock builds, the other waits.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detach the build so the SessionStart hook returns instantly. Output is
# discarded here; build.sh's own diagnostics still go to its stderr if run
# directly elsewhere (e.g. via launch.sh).
nohup bash "$SCRIPT_DIR/build.sh" >/dev/null 2>&1 &
disown 2>/dev/null || true

exit 0
