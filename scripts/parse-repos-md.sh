#!/usr/bin/env bash
# parse-repos-md.sh — emit one `owner/repo` slug per line from REPOS.md.
#
# Reads REPOS.md (path arg, default: REPOS.md alongside this script's repo root)
# and prints every github.com slug found in BOTH the numbered "## Entries" blocks
# (`| GitHub | https://github.com/<o>/<r> |` rows) AND the "## Tier 2" markdown
# table (first column with `[\`<o>/<r>\`](https://github.com/<o>/<r>)`).
#
# Skips entries without a github.com URL (e.g. nsheaps/.openclaw — local only).
# De-duplicates preserving first-seen order.
#
# Usage:
#   scripts/parse-repos-md.sh [PATH_TO_REPOS_MD]
#
# Example:
#   scripts/parse-repos-md.sh REPOS.md
#   scripts/parse-repos-md.sh | xargs -I{} echo --repo {}

set -euo pipefail

REPOS_MD="${1:-REPOS.md}"
if [[ ! -f "$REPOS_MD" ]]; then
  echo "error: REPOS.md not found at $REPOS_MD" >&2
  exit 2
fi

# Grep all github.com/<owner>/<repo> occurrences, normalize, de-dupe in-order.
# Accept URLs with optional trailing whitespace/punctuation; strip .git suffix.
grep -oE 'https?://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' "$REPOS_MD" \
  | sed -E 's#^https?://github\.com/##; s#\.git$##' \
  | awk '!seen[$0]++ { print }'
