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
  sync-dispatch-workflows/
    SKILL.md                 # verify/repair the consumer-side dispatch-review.yaml + pr-status-dispatch.yaml pair
actions/
  agent-setup/action.yaml    # mise trust + gh-pr-review extension install
  run-agent/action.yaml      # auth, check-run create/finalize, claude-code-action runner
docs/
  build-report-review-utils.md
  plans/review-utils.md
```

The reusable workflow that consumers call (`nsheaps/agents/.github/workflows/review-dispatch.yaml`) lives at the canonical GitHub workflow path — GitHub does not load reusable workflows from arbitrary subdirectories. It checks out `nsheaps/agents` and calls `./plugins/claude-code/review-utils/actions/run-agent`, which is how this plugin gets exercised.

## Consumer setup

Per-repo `.github/workflows/dispatch-review.yaml` (gate) and
`.github/workflows/pr-status-dispatch.yaml` (org digest ping) are thin
consumer-side files distributed from `nsheaps/.github`'s
`ansible/templates/.github/workflows/` — see
`ansible/config/sync-files.yml` there for the exact `managed_repos`
membership and per-file exclusions (the sync source itself, and — for
`pr-status-dispatch.yaml` only — `nsheaps/.org`, which listens to its own
`pull_request` events directly instead). `nsheaps/agents/templates/
dispatch-review.yaml` mirrors the canonical `dispatch-review.yaml` for
convenience but `nsheaps/.github` is the source of truth for both files.

Normal propagation is automatic (`nsheaps/.github`'s `sync-all.yaml`, weekly

- on template change). To onboard a new consumer early, or repair a repo
  whose copies have drifted, use the `sync-dispatch-workflows` skill in this
  plugin rather than hand-copying — it encodes the exclusion rules and
  verifies byte-for-byte convergence with the canonical templates.

## Skill

`review-code` — the review methodology + prompt template. The `run-agent` action interpolates `${REPO}`, `${PR_NUMBER}`, `${CHECK_RUN_ID}`, `${WORKFLOW_RUN_URL}`, `${JOB_CONTEXT}` into the skill body via envsubst, then passes the result as the prompt to `claude-code-action`.

## Migration

This plugin replaces:

- `nsheaps/.ai-agent-henry/.github/workflows/repo-dispatch.yaml`
- `nsheaps/.ai-agent-henry/.github/actions/{agent-setup,run-agent,with-post-step}/`
- `nsheaps/.ai-agent-henry/.claude/prompts/pr-review.md` (+ partials)

See `docs/plans/review-utils.md` for the migration timeline.
