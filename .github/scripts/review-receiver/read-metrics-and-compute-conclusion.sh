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
    # No metrics = the agent did not complete its job (crash, blocked tool
    # calls, etc.). Fail this step so the job/run itself shows red, not just
    # the PR check — matches spec §Stage-by-stage bullet 6. The `if: failure()`
    # guard in review-receiver.yaml posts the terminal failure check.
    echo "::error::No metrics file at $METRICS_PATH or $alt — review agent did not complete."
    {
      echo "conclusion=failure"
      echo "title=Review agent finished but metrics missing"
    } >> "$GITHUB_OUTPUT"
    exit 1
  fi
fi

verdict=$(grep -E '^verdict:' "$path" | sed 's/^verdict:[[:space:]]*//' | tr -d '"' || echo unknown)
follow_ups=$(grep -E '^follow_ups:' "$path" | sed 's/^follow_ups:[[:space:]]*//' || echo 0)
skipped=$(grep -E '^skipped:' "$path" | sed 's/^skipped:[[:space:]]*//' | tr -d '"' || echo false)

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

# skipped: true means the skill decided (per incremental-review.md) that no
# new review was warranted — same diff content, or a routine-update refresh
# with nothing new to say. The verdict/follow_ups above are carried over
# from prior state unchanged; swap in a title that makes clear nothing new
# ran, so the check doesn't read as if a fresh review just happened.
if [ "$skipped" = "true" ]; then
  title="No changes requiring re-review — previous review still stands (${verdict}, ${follow_ups} follow-ups)."
fi

{
  echo "conclusion=$conclusion"
  echo "title=$title"
} >> "$GITHUB_OUTPUT"
