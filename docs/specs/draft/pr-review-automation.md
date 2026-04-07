---
status: draft
---
# PR Review Automation

## Problem Statement

The `nsheaps/ai-mktpl` repo has a `claude-agent-trigger.yaml` workflow that triggers
Claude Code on `@claude` mentions in PR comments. Two bugs were identified in production
that need to be fixed: (1) the trigger pattern matches substrings, causing false
positives, and (2) automation comments lack workflow run links, making them
untraceable.

## Design Decisions

1. **Trigger pattern is substring-based, not word-boundary**: The workflow uses
   `contains(github.event.comment.body, '@claude')` which matches any occurrence of
   `@claude` as a substring, including `plugin-dev@claude-plugins-official` and
   `foo@claude.ai`. A false positive was confirmed in production when
   `henry-nsheaps[bot]` posted a review containing `plugin-dev@claude-plugins-official`.
   Source: `docs/research/pr390-critical-investigation.md`.

2. **Fix: word-boundary regex check before trigger**: Add a preliminary step using bash
   regex with negative lookbehind/lookahead to match `@claude` only when surrounded by
   non-alphanumeric, non-dot, non-dash characters:
   ```
   (?<![a-zA-Z0-9._-])@claude(?![a-zA-Z0-9._-])
   ```
   This prevents matching `plugin-dev@claude-plugins-official` and `@claudette`.
   Source: `docs/research/pr390-critical-investigation.md`, Issue 3.

3. **Automation comments must include workflow run URL**: Comments posted by the
   `automation-nsheaps` bot do not currently include the workflow run URL
   (`GITHUB_SERVER_URL + GITHUB_REPOSITORY + /actions/runs/ + GITHUB_RUN_ID`) or the
   triggering event body. This makes it impossible to trace which run produced a
   comment. Source: `docs/research/pr390-critical-investigation.md`, Issue 4.

4. **Fix: inject workflow URL into prompt context**: In `claude-agent.yaml`, the
   "Build prompt from dispatch payload" step must add:
   ```bash
   WORKFLOW_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
   CONTEXT+="- Workflow run: ${WORKFLOW_URL}\n"
   ```
   Claude should also be instructed (via system prompt) to cite the workflow run URL in
   its PR/issue comments. Source: `docs/research/pr390-critical-investigation.md`, Issue 4.

5. **PR auth identity must be verified before `gh pr create`**: PR #390 was opened as
   `nsheaps` (handler) instead of `jack-nsheaps[bot]` because the GitHub App token
   had expired and `gh` fell back silently to the handler's keyring credential. The fix
   is to call `gh api /user --jq .login` before `gh pr create` and abort if the
   identity does not match the expected bot account.
   Source: `docs/research/pr390-critical-investigation.md`, Issue 1.

6. **Dispatch-review workflow should be reusable** (tracked as agents#117): Henry has
   a dispatch-review workflow that is repo-specific and not reusable. The goal is to
   extract it into a shared workflow that any agent repo can reference. This is related
   to the PR review automation topic but is a separate work item.
   Source: `docs/research/agent-teams-infrastructure.md`, nsheaps/agents issue #117.

7. **Claude Utils as reference**: `nsheaps/claude-utils` contains a "more thorough
   workflow" for code review that the handler has referenced as a pattern Jack should
   follow. The exact contents have not been examined locally.
   Source: `docs/research/agent-teams-infrastructure.md`, section 2.

8. **False positive triggered legitimate work**: In the PR #390 incident, the automation
   that fired due to the false positive actually performed valid code review (removed a
   phantom row, fixed inconsistent link syntax in commit `6d64bdf`). The problem is the
   trigger mechanism, not the quality of the automation output.
   Source: `docs/research/pr390-critical-investigation.md`, Issue 2.

## Open Questions

- Should the `@claude` trigger pattern be case-sensitive? (Currently yes, since
  `@Claude` would not match.)
- Should the reusable dispatch-review workflow (agents#117) be the same workflow as
  the PR comment trigger, or a separate workflow triggered by a different event?
- What review workflow patterns exist in `nsheaps/claude-utils`? These need to be
  examined before designing a canonical PR review workflow.

## References

- `docs/research/pr390-critical-investigation.md` in ai-agent-jack — full root cause analysis
- `docs/research/agent-teams-infrastructure.md` in ai-agent-jack — agents#117 context
- nsheaps/agents issue #117 (reusable review dispatch workflow)
- [nsheaps/ai-mktpl PR #390](https://github.com/nsheaps/ai-mktpl/pull/390) — incident PR
- [CI run 24096284487](https://github.com/nsheaps/ai-mktpl/actions/runs/24096284487) — false positive run
- `.github/workflows/claude-agent-trigger.yaml` in ai-mktpl — trigger pattern (line 19–22)
- `.github/workflows/claude-agent.yaml` in ai-mktpl — prompt build (lines 54–84)
