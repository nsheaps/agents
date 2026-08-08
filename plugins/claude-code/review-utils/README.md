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

Per-repo `.github/workflows/dispatch-review.yaml` is a thin consumer-side file distributed from `nsheaps/.github`'s `ansible/templates/.github/workflows/dispatch-review.yaml` — see `ansible/config/sync-files.yml` there for the exact `managed_repos` membership (currently every managed repo, `nsheaps/.github` included — it onboarded itself as a consumer of its own gate since it takes real PRs too). `nsheaps/agents/templates/dispatch-review.yaml` mirrors the canonical file for convenience, but `nsheaps/.github` is the source of truth. (A separate, unrelated file, `pr-status-dispatch.yaml`, is distributed by the same sync system but pings `nsheaps/.org`'s PR status digest — a different mechanism, not covered here.)

Propagation is automatic (`nsheaps/.github`'s `sync-all.yaml`, weekly plus on template change). See the `sync-dispatch-workflows` skill in `nsheaps/.github/.claude/skills/` for how the mechanism works, how to change the template or add/remove consumer repos, and how to trigger a sync run rather than hand-patching a repo.

## Skill

`review-code` — the review methodology + prompt template. The `run-agent` action interpolates `${REPO}`, `${PR_NUMBER}`, `${CHECK_RUN_ID}`, `${WORKFLOW_RUN_URL}`, `${JOB_CONTEXT}` into the skill body via envsubst, then passes the result as the prompt to `claude-code-action`.

## Migration

This plugin replaces:

- `nsheaps/.ai-agent-henry/.github/workflows/repo-dispatch.yaml`
- `nsheaps/.ai-agent-henry/.github/actions/{agent-setup,run-agent,with-post-step}/`
- `nsheaps/.ai-agent-henry/.claude/prompts/pr-review.md` (+ partials)

See `docs/plans/review-utils.md` for the migration timeline.
