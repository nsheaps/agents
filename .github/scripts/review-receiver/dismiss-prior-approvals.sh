#!/usr/bin/env bash
# Dismiss prior APPROVED reviews by this bot on the given PR so the PR
# can't be merged on a stale approval. Keeps REQUEST_CHANGES + COMMENT
# reviews intact (audit trail).
#
# Required env:
#   GH_TOKEN     — auth token for the gh CLI (reviewer App's token)
#   SOURCE_REPO  — owner/name of the consumer repo holding the PR
#   PR_NUMBER    — PR number on the consumer repo

set -euo pipefail

bot_login=$(gh api user --jq '.login')
reviews_json=$(gh api "repos/${SOURCE_REPO}/pulls/${PR_NUMBER}/reviews?per_page=100")
approval_ids=$(echo "$reviews_json" | jq -r --arg login "$bot_login" \
  '.[] | select(.user.login == $login and .state == "APPROVED") | .id')

for rid in $approval_ids; do
  echo "Dismissing approval review $rid"
  gh api -X PUT "repos/${SOURCE_REPO}/pulls/${PR_NUMBER}/reviews/${rid}/dismissals" \
    -f message='Dismissed: new commits since last approval require re-review.' \
    -f event='DISMISS' || true
done
