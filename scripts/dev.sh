#!/usr/bin/env bash
# dev.sh — tilt lifecycle wrapper
set -euo pipefail

ACTION="${1:?Usage: dev.sh <up|start|stop>}"
TILT_PORT=10351
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$ACTION" in
  up)
    cd "$REPO_ROOT"
    tilt up --port "$TILT_PORT" &
    echo "Tilt started in background on port $TILT_PORT"
    echo "Dashboard: http://localhost:$TILT_PORT"
    ;;
  start)
    cd "$REPO_ROOT"
    tilt up --port "$TILT_PORT" --stream
    ;;
  stop)
    tilt down
    ;;
  *)
    echo "Usage: dev.sh <up|start|stop>" >&2
    exit 1
    ;;
esac
