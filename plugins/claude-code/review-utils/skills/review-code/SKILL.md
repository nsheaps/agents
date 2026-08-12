---
name: review-code
description: Review a GitHub pull request and post inline feedback via the GitHub review system. Used by the run-agent composite action; the body below is the prompt that drives claude-code-action.
---

REPO: ${REPO}
PR_NUMBER: ${PR_NUMBER}
CHECK_RUN_ID: ${CHECK_RUN_ID}
WORKFLOW_RUN_URL: ${WORKFLOW_RUN_URL}
REVIEW_METRICS_PATH: ${REVIEW_METRICS_PATH}
REVIEW_STATE_PATH: ${REVIEW_STATE_PATH}

Review this PR providing inline feedback via the GitHub review system.

Evaluate: code quality, bugs, performance, security, maintainability, test coverage, documentation accuracy, PR description accuracy, simplicity, and adherence to repository conventions.

Use MCP tools and `gh` CLI to evaluate changes in context of the PR title/body, commit messages, and existing reviews/comments. Use `mcp__github__github_support_docs_search` for GitHub docs clarification.

Do not duplicate questions from past reviews. Respond to engagement on your previous comments where needed.

## Review Steps

1. **Get diff info**: Use `mcp__github__*` tools and `gh` CLI to understand changes, previous reviews, and line numbers.

2. **Load prior review state and classify the PR, then decide whether to skip**: See `partials/incremental-review.md` for the full procedure — loading `${REVIEW_STATE_PATH}`, classifying the PR (`routine-update` vs `standard`), and the skip / brief-refresh / full-re-review decision tree. **Do this before any further steps.** If the decision is "skip", stop after emitting state + metrics (step 11/12) — do not touch comments, threads, or reviews.

3. **Review previous reviews** including your own. Your new review must be self-contained with all relevant details.

4. **Track findings in a local doc** updated after every piece reviewed. Include summary, inline comments, questions, reference links. Do not trust memory.

5. **Manage previous comments, threads, and prior approvals**: See `partials/review-thread-management.md` for the full procedure on minimizing comments, resolving threads, updating existing comments, and — for `standard`-depth re-reviews only — dismissing a stale prior approval. **Do not dismiss a prior approval for a `routine-update` brief refresh or a skip** (see `partials/incremental-review.md`).

6. **Start a review**: Use `mcp__github__create_pending_pull_request_review`.

7. **Add inline comments**: Use `mcp__github__add_comment_to_pending_review` for each piece of feedback. Use `suggestion` blocks for code changes. Only suggest changes with clear benefit (bug fix, perf, security, correctness, maintainability, simplicity). Never suggest changes to code outside the PR.

8. **Fetch review comments** to get URLs for cross-linking. Update your local doc.

9. **Draft review summary** in your local doc with high-level assessment, strengths, improvements, critical issues, recommendation, and follow-ups. Use full-depth formatting for `standard` classification; use brief formatting for `routine-update` classification — see `partials/review-formatting.md`.

10. **Hide your previous reviews** just before submitting. Only hide YOUR OWN reviews:

   ```bash
   gh pr view <PR_NUMBER> --json reviews --jq '.reviews[] | select(.author.login == "<BOT_USERNAME>") | {id, state}'
   # Minimize each with GraphQL minimizeComment mutation, classifier: OUTDATED
   ```

11. **Submit the review**: Use `mcp__github__submit_pending_pull_request_review`. Skip this step entirely if step 2 decided "skip" or "brief refresh with nothing new to say" — see `partials/incremental-review.md`.
    - **REQUEST_CHANGES**: P0 or P1 follow-ups remain (security, perf, correctness, significant quality issues)
    - **APPROVE**: no outstanding issues, PR is ready to merge (barring CI)
    - **COMMENT**: only P2 follow-ups remain; prefer over APPROVE when improvements are wanted but won't break anything

12. **Write review state** (REQUIRED whenever `${REVIEW_STATE_PATH}` is non-empty; skip only for the legacy direct-invocation path with no receiver). This is the cross-run cache the next CI run reads in step 2. Schema v1 — see `partials/incremental-review.md` for the full field list and skip/refresh/full-review examples:

    ```yaml
    version: 1
    diff_fingerprint: <sha256 of gh pr diff> # see partials/incremental-review.md
    pr_classification: routine-update # routine-update | standard
    verdict: APPROVE # carried over unchanged on skip/refresh, updated on full review
    follow_ups: 3
    review_url: https://github.com/${REPO}/pull/${PR_NUMBER}#pullrequestreview-XXXX
    skipped: false # true when this run posted nothing new
    unresolved_thread_ids: [] # thread node IDs still open, for the next run's context
    ```

13. **Emit review metrics** (REQUIRED; receiver gates final check on this file's presence).
    Write a yaml file at `${REVIEW_METRICS_PATH}` (the receiver workflow exports this env var). Schema v1:

    ```yaml
    version: 1
    verdict: APPROVE # one of: APPROVE | REQUEST_CHANGES | COMMENT
    follow_ups: 3 # integer count of P0/P1/P2 follow-ups raised in the review
    review_url: https://github.com/${REPO}/pull/${PR_NUMBER}#pullrequestreview-XXXX
    skipped: false # true when step 2 decided to skip/refresh without posting a new review
    ```

    Use the `Write` tool to create `${REVIEW_METRICS_PATH}` directly (it is permitted under the
    same directory as `${REVIEW_METRICS_PATH}` via a `Write(<runner-temp>/**)` rule in
    `run-agent/action.yaml`). Do NOT use `Bash` — a `cat > ... <<EOF` heredoc does not match the
    `Bash(gh:*)`/`Bash(git:*)` allowlist and will be silently denied, leaving this step incomplete
    even though the rest of the review succeeded. Example content:

    ```yaml
    version: 1
    verdict: COMMENT
    follow_ups: 5
    review_url: ${REVIEW_URL}
    skipped: false
    ```

    If `${REVIEW_METRICS_PATH}` is empty (legacy direct-invocation path with no receiver), skip this step.

14. **Update the check run** (only when NOT invoked via the receiver — i.e. `${REVIEW_METRICS_PATH}` is empty).
    When the receiver workflow owns the check_run lifecycle, it reads the metrics file emitted in step 13 and updates the check itself; don't write to it from here.
    - APPROVE -> `success`, COMMENT -> `neutral`, REQUEST_CHANGES -> `action_required`

    ```bash
    if [ -z "${REVIEW_METRICS_PATH}" ]; then
      gh api "repos/${REPO}/check-runs/${CHECK_RUN_ID}" \
        --method PATCH --input - <<EOF
    {"status":"completed","conclusion":"<conclusion>","output":{"title":"<verdict>","summary":"<one-line>"}}
    EOF
    fi
    ```

15. **Post-review verification**: Verify your latest review is visible (or, on skip/refresh, that nothing new was posted and the prior review/approval is untouched), previous reviews minimized (full-review path only), thread states are correct, other users' threads untouched, the review state written (step 12), the metrics file written (step 13), and the check run updated (either by you in step 14 OR by the receiver workflow that invoked you).

## Design Principles

Design principles (KISS, YAGNI, DRY, incremental development, etc.) are provided by the `common-sense` plugin via the project's enabled plugins in `.claude/settings.json`.

## Incremental review (skip / brief / full)

See `partials/incremental-review.md` for PR classification, the prior-state cache schema, and the skip / brief-refresh / full-re-review decision tree. This is REQUIRED reading before step 2.

## Formatting

See `partials/review-formatting.md` for emoji legend, badge requirements, review structure template (`standard` classification), brief-format template (`routine-update` classification), and footnote formatting.

## Critical Rules

- Never post test/progress comments. Only post your final review.
- Never post "detailed review at <url>". Post the FULL review in the PR.
- A `standard`-classification review MUST use `<details>` / `<summary>` HTML tags for collapsible detail. A `routine-update` brief review does not need them — see `partials/review-formatting.md`.
- Review MUST detail how you arrived at your conclusions and scores.
- Do not base review on CI output. Review the code itself.
- Use repo documentation (AGENTS.md, .claude/rules/, CLAUDE.md, README.md) for style guidance.
- If you need a tool that isn't available, call it out outside the details block.
- Never dismiss a prior approval, and never post anything, on a "skip" or "brief refresh with nothing new" decision — see `partials/incremental-review.md`.

<job-context>
${JOB_CONTEXT}
</job-context>
