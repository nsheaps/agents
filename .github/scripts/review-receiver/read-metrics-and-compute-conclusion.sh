#!/usr/bin/env bash
# Read the review-agent metrics file emitted by the review-code skill and
# compute the check_run conclusion + title to display.
#
# Required env:
#   METRICS_PATH   — path to the yaml metrics file (json fallback tried too)
#   GITHUB_OUTPUT  — provided by GitHub Actions; outputs `conclusion` + `title`
#
# Spec: plugins/claude-code/review-utils/specs/review-dispatch.md
#       §Stage-by-stage bullet 6 (metrics gate) + bullet 7 (final check update).

set -euo pipefail

path="$METRICS_PATH"
if [ ! -f "$path" ]; then
  alt="${path%.yaml}.json"
  if [ -f "$alt" ]; then
    path="$alt"
  else
    echo "::warning::No metrics file at $METRICS_PATH or $alt"
    {
      echo "conclusion=failure"
      echo "title=Review agent finished but metrics missing"
    } >> "$GITHUB_OUTPUT"
    exit 0
  fi
fi

verdict=$(grep -E '^verdict:' "$path" | sed 's/^verdict:[[:space:]]*//' | tr -d '"' || echo unknown)
follow_ups=$(grep -E '^follow_ups:' "$path" | sed 's/^follow_ups:[[:space:]]*//' || echo 0)

case "$verdict" in
  APPROVE|approve)
    conclusion=success
    title="The agent approved this PR. ${follow_ups} follow-ups found."
    ;;
  REQUEST_CHANGES|request_changes|reject)
    conclusion=failure
    title="The agent rejected this PR. ${follow_ups} follow-ups found."
    ;;
  COMMENT|comment|*)
    conclusion=neutral
    title="The agent finished. ${follow_ups} follow-ups found."
    ;;
esac

{
  echo "conclusion=$conclusion"
  echo "title=$title"
} >> "$GITHUB_OUTPUT"
