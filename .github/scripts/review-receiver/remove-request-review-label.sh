#!/usr/bin/env bash
# Remove the request-review label from the consumer PR now that the review
# has actually started. This lets a draft PR's label be freely re-applied
# later to request another review round after feedback is addressed —
# without it, the label would just sit there having already "fired" and
# give no visible signal that a fresh review is being requested.
#
# Only meaningful for still-draft PRs (the label is what forces a review
# there — see dispatch-review.yaml's gate). For non-draft PRs the label
# isn't required to re-trigger a review, so removing it here is harmless
# and keeps the mechanism symmetric.
#
# Idempotent: a 404 (label absent) is not an error.
#
# Required env:
#   GH_TOKEN     — auth token for the gh CLI (automation App's token; the
#                  same identity that edits labels in the decider — see
#                  dispatch-review.yaml's "Why automation creds" comment)
#   SOURCE_REPO  — owner/name of the consumer repo holding the PR
#   PR_NUMBER    — PR number on the consumer repo
#   LABEL_NAME   — label to remove (default: request-review)

set -euo pipefail

label_name="${LABEL_NAME:-request-review}"

echo "Removing label '${label_name}' from ${SOURCE_REPO}#${PR_NUMBER} (if present)"
gh api -X DELETE "repos/${SOURCE_REPO}/issues/${PR_NUMBER}/labels/${label_name}" \
  >/dev/null || true
