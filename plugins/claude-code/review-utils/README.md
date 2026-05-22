# review-utils

Self-contained PR-review pipeline for the nsheaps/agents marketplace.

## What's in here

```
.claude-plugin/plugin.json
skills/
  review-code/
    SKILL.md                 # methodology + prompt template
    partials/
      review-thread-management.md
      review-formatting.md
actions/
  agent-setup/action.yaml    # mise trust + gh-pr-review extension install
  run-agent/action.yaml      # auth, check-run create/finalize, claude-code-action runner
docs/
  build-report-review-utils.md
  plans/review-utils.md
```

The reusable workflow that consumers call (`nsheaps/agents/.github/workflows/review-dispatch.yaml`) lives at the canonical GitHub workflow path — GitHub does not load reusable workflows from arbitrary subdirectories. It checks out `nsheaps/agents` and calls `./plugins/claude-code/review-utils/actions/run-agent`, which is how this plugin gets exercised.

## Consumer setup

Per-repo `.github/workflows/dispatch-review.yaml` template:

```yaml
name: Dispatch PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review, labeled]

jobs:
  dispatch:
    uses: nsheaps/agents/.github/workflows/review-dispatch.yaml@main
    secrets:
      REVIEW_GITHUB_APP_ID: ${{ secrets.REVIEW_GITHUB_APP_ID }}
      REVIEW_GITHUB_APP_PRIVATE_KEY: ${{ secrets.REVIEW_GITHUB_APP_PRIVATE_KEY }}
      REVIEW_ANTHROPIC_API_KEY: ${{ secrets.REVIEW_ANTHROPIC_API_KEY }}
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    permissions:
      contents: read
      pull-requests: write
```

The full template at `nsheaps/agents/templates/dispatch-review.yaml` is kept in sync with this README.

## Skill

`review-code` — the review methodology + prompt template. The `run-agent` action interpolates `${REPO}`, `${PR_NUMBER}`, `${CHECK_RUN_ID}`, `${WORKFLOW_RUN_URL}`, `${JOB_CONTEXT}` into the skill body via envsubst, then passes the result as the prompt to `claude-code-action`.

## Migration

This plugin replaces:

- `nsheaps/.ai-agent-henry/.github/workflows/repo-dispatch.yaml`
- `nsheaps/.ai-agent-henry/.github/actions/{agent-setup,run-agent,with-post-step}/`
- `nsheaps/.ai-agent-henry/.claude/prompts/pr-review.md` (+ partials)

See `docs/plans/review-utils.md` for the migration timeline.
