#!/usr/bin/env bash
# Process every file in docs/project-tracking/task-summary/ by
# prepending the triage-prompt (verbatim from intake/project-setup.md
# step 6) and moving it to docs/project-tracking/to-triage/.
#
# Commits one file per commit to keep git history linear (per the
# intake-doc rule: "I want to see it flow between each folder in the
# git history").
#
# Skips README/CLAUDE.md if present. Idempotent — files already in
# to-triage are not re-processed.
#
# Usage: ./bin/process-task-summaries.sh [--dry-run]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/docs/project-tracking/task-summary"
DST_DIR="$REPO_ROOT/docs/project-tracking/to-triage"

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

[[ -d "$SRC_DIR" ]] || { echo "ERROR: $SRC_DIR not found" >&2; exit 1; }
mkdir -p "$DST_DIR"

PROMPT='> The following is the contents of the file as previously lived in docs/project-tracking/task-summary/xxxx.md. To triage this ticket, we '"'"'ll need to appropriately file this as an actual ticket within the appropriate project.
> Review the summary, and MASTER.md, and build out the ticket to triage.
> Then, get the triage request to the actual ticket(s) in triage state and in the correct project(s). This will likely be one ticket per file for now, but you may choose to make more than one if you deem appropriate.
> The ticket should capture this original summary, and the original messaging as it appears in MASTER.md. It MUST also be linked to the appropriate milestone.
> When the ticket is ready, in the triage state, and is confirmed to have the needed information, update master.md appropriately to link to the ticket instead of keeping info in master.md. The link should be: `[$emojiState | $ticketShortDescription](relative/link/to/file/that/works/on/github/and/local/instead/of/link/to/github/directly.md)` the ticket short description.
'

cd "$REPO_ROOT"

processed=0
for src in "$SRC_DIR"/*.md; do
  [[ -e "$src" ]] || continue
  base="$(basename "$src")"

  case "$base" in
    README.md|CLAUDE.md|PROJECT.md) echo "skip (meta): $base"; continue ;;
  esac

  dst="$DST_DIR/$base"

  if [[ -e "$dst" ]]; then
    echo "skip (already in to-triage): $base"
    continue
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "would process: $base"
    continue
  fi

  tmp="$(mktemp)"
  {
    printf '%s\n\n---\n\n' "$PROMPT"
    cat "$src"
  } > "$tmp"

  mv "$tmp" "$src"
  git add "$src"
  git mv "$src" "$dst"

  git commit --quiet -m "docs(project-tracking): triage-prep $base → to-triage/

Prefix triage-prompt per intake/project-setup.md step 6.

Co-Authored-By: Agent Alex Picard <alex-nsheaps[bot]@users.noreply.github.com>"
  echo "processed: $base"
  processed=$((processed + 1))
done

echo "---"
echo "done. processed=$processed"
