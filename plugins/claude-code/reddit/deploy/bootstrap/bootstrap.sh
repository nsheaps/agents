#!/usr/bin/env bash
# bootstrap.sh — Idempotent APISIX provisioning for the Reddit proxy stack.
#
# Creates (or updates) the following objects via the APISIX Admin API:
#   - Upstream: oauth.reddit.com (HTTPS, port 443)
#   - Route:    /* → upstream, with key-auth, proxy-rewrite, prometheus, limit-count
#   - Consumers: one per entry in AGENT_KEYS (name:key pairs)
#
# Usage:
#   export APISIX_ADMIN_URL="http://apisix:9180"   # or http://localhost:9180
#   export APISIX_ADMIN_KEY="your-admin-key"
#   export APISIX_ROUTE_ID="reddit-route"          # optional; default: reddit-route
#   export APISIX_UPSTREAM_ID="reddit-upstream"    # optional; default: reddit-upstream
#   # AGENT_KEYS: space or comma-separated name:key pairs
#   export AGENT_KEYS="agent-01:sk-agent-01-abc123 agent-02:sk-agent-02-def456"
#   bash bootstrap.sh
#
# All operations are idempotent (HTTP PUT). Safe to re-run on config changes.

set -euo pipefail

# --- Configuration ---
APISIX_ADMIN_URL="${APISIX_ADMIN_URL:-http://apisix:9180}"
APISIX_ADMIN_KEY="${APISIX_ADMIN_KEY:?APISIX_ADMIN_KEY must be set}"
APISIX_ROUTE_ID="${APISIX_ROUTE_ID:-reddit-route}"
APISIX_UPSTREAM_ID="${APISIX_UPSTREAM_ID:-reddit-upstream}"
# AGENT_KEYS: space or comma-separated list of name:key pairs
AGENT_KEYS="${AGENT_KEYS:-}"

# Per-consumer rate limit (protect shared 100 QPM Reddit OAuth budget).
# Each consumer is capped at 60 requests per minute by default.
RATE_LIMIT_COUNT="${RATE_LIMIT_COUNT:-60}"
RATE_LIMIT_WINDOW="${RATE_LIMIT_WINDOW:-60}"  # seconds

# --- Helpers ---

die() {
  echo "ERROR: $*" >&2
  exit 1
}

info() {
  echo "[bootstrap] $*"
}

# Wrapper: PUT a JSON body to the Admin API. Prints result status.
admin_put() {
  local path="$1"
  local body="$2"
  local url="${APISIX_ADMIN_URL}/apisix/admin${path}"
  local http_code
  http_code=$(curl -s -o /dev/null -w '%{http_code}' \
    -X PUT "${url}" \
    -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "${body}")
  if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
    die "Admin API PUT ${path} returned HTTP ${http_code}"
  fi
  echo "  PUT ${path} → ${http_code}"
}

# --- Provision upstream ---

provision_upstream() {
  info "Provisioning upstream: ${APISIX_UPSTREAM_ID}"
  admin_put "/upstreams/${APISIX_UPSTREAM_ID}" "$(cat <<JSON
{
  "id": "${APISIX_UPSTREAM_ID}",
  "type": "roundrobin",
  "scheme": "https",
  "pass_host": "rewrite",
  "upstream_host": "oauth.reddit.com",
  "nodes": {
    "oauth.reddit.com:443": 1
  },
  "keepalive_pool": {
    "size": 5,
    "idle_timeout": 60,
    "requests": 1000
  }
}
JSON
)"
}

# --- Provision route ---
# proxy-rewrite sets a placeholder Authorization header (updated by token-refresher).
# key-auth validates per-agent consumer keys.
# prometheus tags all metrics with the consumer name.
# limit-count enforces per-consumer rate limit.

provision_route() {
  info "Provisioning route: ${APISIX_ROUTE_ID}"
  admin_put "/routes/${APISIX_ROUTE_ID}" "$(cat <<JSON
{
  "id": "${APISIX_ROUTE_ID}",
  "name": "reddit-proxy",
  "uri": "/*",
  "upstream_id": "${APISIX_UPSTREAM_ID}",
  "plugins": {
    "key-auth": {},
    "proxy-rewrite": {
      "headers": {
        "set": {
          "Authorization": "Bearer PLACEHOLDER_UPDATED_BY_TOKEN_REFRESHER",
          "User-Agent": "reddit-proxy/1.0 (nsheaps/agents)"
        }
      }
    },
    "prometheus": {
      "prefer_name": true
    },
    "limit-count": {
      "count": ${RATE_LIMIT_COUNT},
      "time_window": ${RATE_LIMIT_WINDOW},
      "key": "consumer_name",
      "policy": "local",
      "rejected_code": 429
    }
  }
}
JSON
)"
}

# --- Provision consumers ---

provision_consumers() {
  if [[ -z "$AGENT_KEYS" ]]; then
    info "No AGENT_KEYS set; skipping consumer creation."
    info "  To create consumers, set: AGENT_KEYS=\"agent-01:sk-xxx agent-02:sk-yyy\""
    return
  fi

  info "Provisioning consumers from AGENT_KEYS..."
  # Accept space or comma separation
  local normalized
  normalized=$(echo "$AGENT_KEYS" | tr ',' ' ')

  for pair in $normalized; do
    local name key
    name="${pair%%:*}"
    key="${pair#*:}"
    [[ -z "$name" || -z "$key" || "$name" == "$key" ]] && {
      die "Invalid AGENT_KEYS entry '${pair}'. Expected format: name:key"
    }
    info "  Creating consumer: ${name}"
    admin_put "/consumers" "$(cat <<JSON
{
  "username": "${name}",
  "plugins": {
    "key-auth": {
      "key": "${key}"
    }
  }
}
JSON
)"
  done
}

# --- Main ---

main() {
  info "Starting APISIX bootstrap"
  info "  Admin URL: ${APISIX_ADMIN_URL}"
  info "  Route ID:  ${APISIX_ROUTE_ID}"
  info "  Upstream:  ${APISIX_UPSTREAM_ID}"

  # Wait briefly for APISIX to be ready
  local max_wait=30
  local waited=0
  until curl -sf "${APISIX_ADMIN_URL}/apisix/admin/routes" \
        -H "X-API-KEY: ${APISIX_ADMIN_KEY}" -o /dev/null 2>&1; do
    waited=$(( waited + 2 ))
    if (( waited >= max_wait )); then
      die "APISIX Admin API not reachable after ${max_wait}s at ${APISIX_ADMIN_URL}"
    fi
    info "  Waiting for APISIX... (${waited}s)"
    sleep 2
  done

  provision_upstream
  provision_route
  provision_consumers

  info "Bootstrap complete."
}

main "$@"
