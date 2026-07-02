#!/usr/bin/env bash
# Release the plugins module (@nsheaps/agents-plugins).
#
# Invoked by nx as the project's `release` target (see plugins/package.json), which
# release.yaml drives via `nx affected --target=release`. Self-contained: it bumps the
# changed plugins' versions, regenerates marketplace.json, then commits + pushes its own
# slice. Keeping the git work in the script (rather than the workflow) lets each module
# own its full release, so `nx affected --target=release` can run modules independently.
#
# Base for change-detection / version-comparison: the floating `last-released` tag set by
# release.yaml (overridable via RELEASE_BASE). auto-bump-plugins falls back to HEAD~1 when
# the ref is absent (first release).
#
# This mirrors the resilient sync+retry that previously lived inline in cd.yaml's
# bump-and-update-marketplace job: feature PRs merge to main in rapid succession, so the
# checked-out SHA can be stale by push time. Both the version bumps and marketplace.json
# are fully DERIVED, so on every attempt we resync to origin/main and recompute from
# scratch — self-healing if a concurrent run already advanced main.
set -euo pipefail

BASE="${RELEASE_BASE:-last-released}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MAX_ATTEMPTS="${RELEASE_MAX_ATTEMPTS:-5}"
attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))

  # Resync to the latest main (and tags) and start from a clean tree.
  git fetch origin main --tags --force
  git reset --hard origin/main

  # Recompute bumps against the floating base, then regenerate marketplace.json from the
  # resulting plugin.json set.
  mise run auto-bump-plugins "--change-base=$BASE" "--version-base=$BASE" >/dev/null
  mise run update-marketplace
  mise run format 2>/dev/null || true

  # Stage only the files this release is allowed to touch.
  git add plugins/claude-code/*/.claude-plugin/plugin.json .claude-plugin/marketplace.json 2>/dev/null || true

  if git diff --cached --quiet; then
    echo "plugins release: no version/marketplace changes to push"
    break
  fi

  git commit --no-verify -m 'chore: bump plugin versions and update marketplace [skip ci]'

  if git push origin HEAD:main; then
    echo "plugins release: pushed plugin/marketplace updates on attempt $attempt"
    break
  fi

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "::error::plugins release: push failed after $MAX_ATTEMPTS attempts (main kept advancing)"
    exit 1
  fi
  echo "plugins release: push rejected (attempt $attempt) — main advanced; resyncing and retrying"
  sleep $((attempt * 3))
done
