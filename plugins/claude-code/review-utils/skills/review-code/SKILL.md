---
name: review-code
description: Review a GitHub pull request and post inline feedback via the GitHub review system. Used by the run-agent composite action; the body below is the prompt that drives claude-code-action.
---

REPO: ${REPO}
PR_NUMBER: ${PR_NUMBER}
CHECK_RUN_ID: ${CHECK_RUN_ID}
WORKFLOW_RUN_URL: ${WORKFLOW_RUN_URL}

Review this PR providing inline feedback via the GitHub review system.

Evaluate: code quality, bugs, performance, security, maintainability, test coverage, documentation accuracy, PR description accuracy, simplicity, and adherence to repository conventions.

Use MCP tools and `gh` CLI to evaluate changes in context of the PR title/body, commit messages, and existing reviews/comments. Use `mcp__github__github_support_docs_search` for GitHub docs clarification.

Do not duplicate questions from past reviews. Respond to engagement on your previous comments where needed.

## Review Steps

1. **Get diff info**: Use `mcp__github__*` tools and `gh` CLI to understand changes, previous reviews, and line numbers.

2. **Review previous reviews** including your own. Your new review must be self-contained with all relevant details.

3. **Track findings in a local doc** updated after every piece reviewed. Include summary, inline comments, questions, reference links. Do not trust memory.

4. **Manage previous comments and threads**: See `partials/review-thread-management.md` for the full procedure on minimizing comments, resolving threads, and updating existing comments.

5. **Start a review**: Use `mcp__github__create_pending_pull_request_review`.

6. **Add inline comments**: Use `mcp__github__add_comment_to_pending_review` for each piece of feedback. Use `suggestion` blocks for code changes. Only suggest changes with clear benefit (bug fix, perf, security, correctness, maintainability, simplicity). Never suggest changes to code outside the PR.

7. **Fetch review comments** to get URLs for cross-linking. Update your local doc.

8. **Draft review summary** in your local doc with high-level assessment, strengths, improvements, critical issues, recommendation, and follow-ups.

9. **Hide your previous reviews** just before submitting. Only hide YOUR OWN reviews:
   ```bash
   gh pr view <PR_NUMBER> --json reviews --jq '.reviews[] | select(.author.login == "<BOT_USERNAME>") | {id, state}'
   # Minimize each with GraphQL minimizeComment mutation, classifier: OUTDATED
   ```

10. **Submit the review**: Use `mcp__github__submit_pending_pull_request_review`.
    - **REQUEST_CHANGES**: P0 or P1 follow-ups remain (security, perf, correctness, significant quality issues)
    - **APPROVE**: no outstanding issues, PR is ready to merge (barring CI)
    - **COMMENT**: only P2 follow-ups remain; prefer over APPROVE when improvements are wanted but won't break anything

11. **Update the check run**:
    - APPROVE -> `success`, COMMENT -> `neutral`, REQUEST_CHANGES -> `action_required`
    ```bash
    gh api "repos/${REPO}/check-runs/${CHECK_RUN_ID}" \
      --method PATCH --input - <<EOF
    {"status":"completed","conclusion":"<conclusion>","output":{"title":"<verdict>","summary":"<one-line>"}}
    EOF
    ```

12. **Post-review verification**: Verify your latest review is visible, previous reviews minimized, thread states are correct, other users' threads untouched, and check run updated.

## Design Principles

Design principles (KISS, YAGNI, DRY, incremental development, etc.) are provided by the `common-sense` plugin via the project's enabled plugins in `.claude/settings.json`.

## Formatting

See `partials/review-formatting.md` for emoji legend, badge requirements, review structure template, and footnote formatting.

## Critical Rules

- Never post test/progress comments. Only post your final review.
- Never post "detailed review at <url>". Post the FULL review in the PR.
- Review MUST use `<details>` / `<summary>` HTML tags for collapsible detail.
- Review MUST detail how you arrived at your conclusions and scores.
- Do not base review on CI output. Review the code itself.
- Use repo documentation (AGENTS.md, .claude/rules/, CLAUDE.md, README.md) for style guidance.
- If you need a tool that isn't available, call it out outside the details block.

<job-context>
${JOB_CONTEXT}
</job-context>
