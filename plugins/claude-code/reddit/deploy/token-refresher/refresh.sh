#!/usr/bin/env bash
# refresh.sh — Reddit OAuth2 token refresher sidecar.
#
# Runs in an Alpine container alongside APISIX. On startup and every 55 minutes:
#   1. POSTs to https://www.reddit.com/api/v1/access_token (client_credentials grant)
#   2. PATCHes the APISIX route's proxy-rewrite Authorization header via Admin API
#
# Environment variables (all required unless noted):
#   REDDIT_CLIENT_ID      — Reddit OAuth app client ID
#   REDDIT_CLIENT_SECRET  — Reddit OAuth app client secret
#   REDDIT_USER_AGENT     — User-Agent string (Reddit requires: platform:appid/version by u/username)
#   APISIX_ADMIN_URL      — APISIX Admin API base URL (default: http://apisix:9180)
#   APISIX_ADMIN_KEY      — APISIX Admin API key
#   APISIX_ROUTE_ID       — Route ID to patch (default: reddit-route)
#   REFRESH_INTERVAL      — Seconds between refreshes (default: 3300 = 55 minutes)
#   MAX_RETRIES           — Retry attempts per refresh cycle (default: 3)

set -euo pipefail

# --- Configuration ---
REDDIT_CLIENT_ID="${REDDIT_CLIENT_ID:?REDDIT_CLIENT_ID must be set}"
REDDIT_CLIENT_SECRET="${REDDIT_CLIENT_SECRET:?REDDIT_CLIENT_SECRET must be set}"
REDDIT_USER_AGENT="${REDDIT_USER_AGENT:?REDDIT_USER_AGENT must be set}"
APISIX_ADMIN_URL="${APISIX_ADMIN_URL:-http://apisix:9180}"
APISIX_ADMIN_KEY="${APISIX_ADMIN_KEY:?APISIX_ADMIN_KEY must be set}"
APISIX_ROUTE_ID="${APISIX_ROUTE_ID:-reddit-route}"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-3300}"
MAX_RETRIES="${MAX_RETRIES:-3}"

# --- Helpers ---

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [token-refresher] $*"
}

die() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [token-refresher] ERROR: $*" >&2
  exit 1
}

# Fetch a Reddit access token using client_credentials grant.
# Prints only the token value to stdout; never logs it.
fetch_reddit_token() {
  local tmp_response
  tmp_response=$(mktemp)
  local http_code

  http_code=$(curl -s \
    -o "$tmp_response" \
    -w '%{http_code}' \
    -X POST "https://www.reddit.com/api/v1/access_token" \
    -H "User-Agent: ${REDDIT_USER_AGENT}" \
    --user "${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}" \
    --data-urlencode "grant_type=client_credentials")

  if [[ "$http_code" != "200" ]]; then
    local err
    err=$(cat "$tmp_response" 2>/dev/null || true)
    rm -f "$tmp_response"
    # Log the error without the credentials
    log "Reddit token endpoint returned HTTP ${http_code}: ${err}"
    return 1
  fi

  local token
  token=$(jq -r '.access_token // empty' "$tmp_response")
  rm -f "$tmp_response"

  if [[ -z "$token" ]]; then
    log "Reddit token response missing access_token field"
    return 1
  fi

  printf '%s' "$token"
}

# Patch the APISIX route's proxy-rewrite Authorization header with the new token.
# Token value is passed as an argument; never logged.
patch_apisix_route() {
  local token="$1"
  local url="${APISIX_ADMIN_URL}/apisix/admin/routes/${APISIX_ROUTE_ID}"
  local tmp_response
  tmp_response=$(mktemp)
  local http_code

  http_code=$(curl -s \
    -o "$tmp_response" \
    -w '%{http_code}' \
    -X PATCH "${url}" \
    -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg tok "Bearer ${token}" \
           '{plugins: {"proxy-rewrite": {headers: {set: {Authorization: $tok}}}}}')")

  rm -f "$tmp_response"

  if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
    log "APISIX Admin API PATCH returned HTTP ${http_code}"
    return 1
  fi
}

# One full refresh cycle with retry/backoff.
refresh_cycle() {
  local attempt=0
  local backoff=5

  while (( attempt < MAX_RETRIES )); do
    attempt=$(( attempt + 1 ))
    log "Fetching Reddit OAuth token (attempt ${attempt}/${MAX_RETRIES})..."

    local token
    if token=$(fetch_reddit_token); then
      log "Token fetched successfully. Patching APISIX route '${APISIX_ROUTE_ID}'..."
      if patch_apisix_route "$token"; then
        log "APISIX route patched. Next refresh in ${REFRESH_INTERVAL}s."
        return 0
      else
        log "Failed to patch APISIX route (attempt ${attempt}/${MAX_RETRIES})"
      fi
    else
      log "Failed to fetch Reddit token (attempt ${attempt}/${MAX_RETRIES})"
    fi

    if (( attempt < MAX_RETRIES )); then
      log "Retrying in ${backoff}s..."
      sleep "$backoff"
      backoff=$(( backoff * 2 ))
    fi
  done

  log "All ${MAX_RETRIES} attempts failed. Agents will continue using existing token until next cycle."
  return 1
}

# --- Main loop ---

main() {
  log "Starting token refresher"
  log "  APISIX route: ${APISIX_ROUTE_ID}"
  log "  Refresh interval: ${REFRESH_INTERVAL}s"

  # Wait for APISIX to be ready before first attempt
  local waited=0
  until curl -sf "${APISIX_ADMIN_URL}/apisix/admin/routes" \
        -H "X-API-KEY: ${APISIX_ADMIN_KEY}" -o /dev/null 2>&1; do
    waited=$(( waited + 3 ))
    if (( waited >= 60 )); then
      die "APISIX Admin API not reachable after 60s"
    fi
    log "Waiting for APISIX Admin API..."
    sleep 3
  done

  # First refresh immediately on startup, then loop
  while true; do
    refresh_cycle || true   # failures are logged; loop continues
    sleep "${REFRESH_INTERVAL}"
  done
}

main "$@"
