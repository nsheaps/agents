#!/usr/bin/env bash
# require-metrics-file.sh — Stop hook
#
# Blocks the review-code agent from ending its turn until it has actually
# written $REVIEW_METRICS_PATH. Root-causes github.com/nsheaps/agents#336:
# the agent reliably posts its review via MCP, then treats "review posted"
# as task completion and skips SKILL.md step 11 (emit the metrics file) --
# a step-adherence failure, not a permissions/tooling gap (already ruled
# out by plugins/claude-code/review-utils/actions/run-agent/action.yaml's
# `Write(${{ runner.temp }}/**)` allowedTools entry, added in #331).
#
# This is the *prevention* layer. read-metrics-and-compute-conclusion.sh's
# review-API fallback remains as a *fallback* layer for cases where no Stop
# event fires at all (killed/timed-out process) -- the two are
# complementary, not redundant. See plugins/claude-code/review-utils/specs/
# review-dispatch.md.
#
# Required env:
#   REVIEW_METRICS_PATH — path the review-code skill must Write. Empty in
#                          direct-invocation mode (no receiver-owned check
#                          run), in which case this hook is a no-op.
#
# Output contract (per claude-code docs hooks.md Stop):
#   - JSON `{"decision":"block","reason":"..."}` on stdout re-prompts the
#     agent to continue instead of stopping.
#   - Must respect `stop_hook_active` to avoid an infinite block loop if the
#     agent still doesn't write the file after being told to.

set -euo pipefail

INPUT="$(cat)"
STOP_HOOK_ACTIVE="$(jq -r '.stop_hook_active // false' <<<"$INPUT")"

# Already re-prompted once this turn-cycle; don't block again no matter what.
if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then
  exit 0
fi

# Direct-invocation mode (no receiver check_run) — skill self-finalizes and
# isn't required to write a metrics file. Nothing to enforce.
if [[ -z "${REVIEW_METRICS_PATH:-}" ]]; then
  exit 0
fi

path="$REVIEW_METRICS_PATH"
alt="${path%.yaml}.json"

if [[ -f "$path" || -f "$alt" ]]; then
  exit 0
fi

jq -n --arg path "$path" '{
  decision: "block",
  reason: (
    "You have not yet written the required review metrics file at " + $path +
    " (or its .json fallback). Before finishing, use the Write tool to " +
    "emit it per SKILL.md step 11 — a YAML/JSON object with `verdict` " +
    "(APPROVE | REQUEST_CHANGES | COMMENT) and `follow_ups` (integer " +
    "count). Do this now, then finish."
  )
}'
exit 0
