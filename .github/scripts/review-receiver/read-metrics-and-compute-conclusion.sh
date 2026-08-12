#!/usr/bin/env bash
# Read the review-agent metrics file emitted by the review-code skill and
# compute the check_run conclusion + title to display.
#
# Required env:
#   METRICS_PATH   — path to the yaml metrics file (json fallback tried too)
#   GITHUB_OUTPUT  — provided by GitHub Actions; outputs `conclusion` + `title`
#
# Optional env (review-API fallback; see below):
#   GH_TOKEN, SOURCE_REPO, SOURCE_PR_NUMBER, SOURCE_HEAD_SHA, APP_SLUG
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
    # Metrics file missing. This has been observed to happen even when the
    # agent successfully posts its review (github.com/nsheaps/agents/issues/336) --
    # the agent treats "submit the review" as task completion and doesn't
    # reliably continue on to the metrics-emission step. Before failing
    # closed, fall back to the real GitHub review the agent should have just
    # posted: it's a more reliable source of truth than an LLM-authored side
    # file, since it's the actual outcome we're gating on.
    review_state=""
    review_html_url=""
    if [ -n "${GH_TOKEN:-}" ] && [ -n "${SOURCE_REPO:-}" ] && [ -n "${SOURCE_PR_NUMBER:-}" ] && [ -n "${SOURCE_HEAD_SHA:-}" ]; then
      gh_stderr=$(mktemp)
      reviews_json=$(gh api "repos/${SOURCE_REPO}/pulls/${SOURCE_PR_NUMBER}/reviews" --paginate 2>"$gh_stderr" || echo '[]')
      if [ -s "$gh_stderr" ]; then
        echo "::warning::gh api reviews call emitted errors while attempting review-API fallback: $(tr '\n' ' ' <"$gh_stderr")"
      fi
      rm -f "$gh_stderr"
      # Filter to the reviewing bot's own reviews (by App slug) so a human
      # reviewer's comment landing on the same SHA in this narrow window
      # can't hijack the conclusion -- the fallback exists to recover the
      # *agent's own* review, not any review on the SHA.
      latest_review=$(echo "$reviews_json" | jq -c --arg sha "$SOURCE_HEAD_SHA" --arg login "${APP_SLUG:+${APP_SLUG}[bot]}" \
        '[.[] | select(.commit_id == $sha and ($login == "" or .user.login == $login))] | sort_by(.submitted_at) | last // empty')
      review_state=$(echo "$latest_review" | jq -r '.state // empty')
      review_html_url=$(echo "$latest_review" | jq -r '.html_url // empty')
    fi

    if [ -n "$review_state" ]; then
      echo "::warning::No metrics file at $METRICS_PATH or $alt, but found a review (state=$review_state, $review_html_url) on $SOURCE_HEAD_SHA. Deriving conclusion from the review API instead of failing closed. See https://github.com/nsheaps/agents/issues/336."
      case "$review_state" in
        APPROVED)
          conclusion=success
          title="The agent approved this PR (recovered via review API — metrics file missing)."
          ;;
        CHANGES_REQUESTED)
          conclusion=failure
          title="The agent rejected this PR (recovered via review API — metrics file missing)."
          ;;
        COMMENTED)
          conclusion=failure
          title="The agent left comments, no approval (recovered via review API — metrics file missing)."
          ;;
        *)
          conclusion=failure
          title="Unrecognized review state '${review_state}' (recovered via review API — metrics file missing)."
          ;;
      esac
      {
        echo "conclusion=$conclusion"
        echo "title=$title"
      } >> "$GITHUB_OUTPUT"
      exit 0
    fi

    # No metrics file AND no matching review found = the agent genuinely did
    # not complete its job (crash, blocked tool calls, etc.). Fail this step
    # so the job/run itself shows red, not just the PR check — matches spec
    # §Stage-by-stage bullet 6. The `if: failure()` guard in
    # review-receiver.yaml posts the terminal failure check.
    echo "::error::No metrics file at $METRICS_PATH or $alt, and no matching review found on $SOURCE_HEAD_SHA — review agent did not complete."
    {
      echo "conclusion=failure"
      echo "title=Review agent finished but metrics missing"
    } >> "$GITHUB_OUTPUT"
    exit 1
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
  COMMENT|comment)
    # Intentionally `failure`, not `neutral`. GitHub treats `neutral` as a
    # passing state for required status checks (same as `success`/`skipped`),
    # so it would NOT block merging -- silently defeating a branch-protection
    # rule that requires this check to pass. Only a strict APPROVE verdict may
    # pass; COMMENT (P2-only follow-ups) still blocks, same as REQUEST_CHANGES.
    conclusion=failure
    title="The agent left comments (no approval). ${follow_ups} follow-ups found."
    ;;
  *)
    # Unparseable/unknown verdict. Fail closed (same as COMMENT/REQUEST_CHANGES)
    # but with a distinct title so this doesn't get misread as "the agent
    # reviewed and left comments" during on-call debugging.
    conclusion=failure
    title="Unknown verdict '${verdict}'. Treating as failure. ${follow_ups} follow-ups found."
    ;;
esac

{
  echo "conclusion=$conclusion"
  echo "title=$title"
} >> "$GITHUB_OUTPUT"
