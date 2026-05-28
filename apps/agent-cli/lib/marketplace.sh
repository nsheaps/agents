#!/usr/bin/env bash
# marketplace.sh — claude plugin marketplace bootstrap + orphan prune.
#
# Both functions are non-fatal: a marketplace that's unreachable on this
# restart, an `add`/`install` that errors, or an old claude that lacks
# `prune` — none of those should keep the agent from coming up.
#
# Caller MUST set REPO_DIR + LOG_FILE and define log() and warn() before
# sourcing.
#
# Implementation: both functions delegate to `claude-plugin-update-all`
# from nsheaps/claude-utils (installed via mise). That single tool does
# marketplace registration, marketplace refresh, install/update of every
# enabled plugin (project + user scope union), and orphan prune in one
# pass with consistent error handling and a tree-grouped summary. Refs:
# https://github.com/nsheaps/claude-utils/pull/46.
#
# Both shims remain in this file so deprecated-agent's call sites do not
# need to change — they will be inlined / deleted in a follow-up once
# the dust has settled.

# Run claude-plugin-update-all once. Output is captured into LOG_FILE and
# also mirrored to the launcher pane via log(). Failure is non-fatal.
_marketplace_run_update_all() {
  if ! command -v claude-plugin-update-all >/dev/null 2>&1; then
    warn "[marketplace] claude-plugin-update-all not on PATH — skipping update flow (install nsheaps/claude-utils via mise)"
    return 0
  fi
  local out rc
  out="$(CLAUDE_PROJECT_DIR="$REPO_DIR" claude-plugin-update-all 2>&1)"
  rc=$?
  printf '%s\n' "$out" >>"$LOG_FILE"
  # Surface the summary line(s) to the pane via log() so the launcher
  # output stays consistent with the old flow.
  printf '%s\n' "$out" | while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    log "[marketplace] $line"
  done
  if (( rc != 0 )); then
    warn "[marketplace] claude-plugin-update-all exited non-zero (rc=$rc, non-fatal)"
  fi
}

# Marker file written next to LOG_FILE to ensure the update flow runs at
# most once per launcher invocation, even when both shims fire. The old
# flow split bootstrap (install/update) from prune (after pre-pass) and
# deprecated-agent still calls them in that order; the new flow does
# everything in one pass, so the second call is a no-op.
_marketplace_run_once() {
  local marker="${LOG_FILE%.log}.marketplace-ran"
  if [[ -f "$marker" ]]; then
    return 0
  fi
  _marketplace_run_update_all
  : >"$marker"
}

# Cross-agent consistency: L14.
marketplace_bootstrap() {
  _marketplace_run_once
}

# Prune orphan plugin deps. Now folded into _marketplace_run_update_all —
# kept as a no-op shim so existing call sites still compile.
marketplace_prune_orphans() {
  _marketplace_run_once
}
