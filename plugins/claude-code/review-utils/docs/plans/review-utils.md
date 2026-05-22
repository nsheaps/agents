# review-utils plugin — design plan

**Created:** 2026-05-22
**Author:** alex
**Mandate:** Nate Discord 14:54Z [msg 1507396232081833996](https://discord.com/channels/1490863845252665415/1497431286661517353/1507396232081833996)

> "Make the review stuff fully contained in a plugin in nsheaps/agents called review-utils, with a skill called review-code. Take a look at agents#157 for some ideas on structuring the plugin and it's skills."

## Why

Today, "the review stuff" is spread across three repos:

- `nsheaps/agents/.github/workflows/review-dispatch.yaml` — the reusable workflow consumers call to forward a `repository_dispatch` event.
- `nsheaps/agents/templates/dispatch-review.yaml` — copy-paste template for consumer repos.
- `nsheaps/.ai-agent-henry/.github/workflows/repo-dispatch.yaml` — the workflow that actually executes the review agent on dispatch.
- `nsheaps/.ai-agent-henry/.github/actions/{agent-setup,run-agent,with-post-step}/` — composite actions called by henry's workflow.
- `nsheaps/.ai-agent-henry/.claude/prompts/pr-review.md` (+ `partials/`) — the prompt template that drives the review.

Problems with the current shape:

1. **Scattered ownership.** Updates to the review methodology require coordinated edits to henry + agents.
2. **Implicit coupling.** Consumer repos point at `nsheaps/.ai-agent-henry` by default; if henry ever stops being the reviewer agent, every consumer breaks.
3. **Active bug.** The `Run agent` step fails on dispatch — `run-agent/action.yaml` references `./agent-repo/.github/actions/agent-setup` but the workflow checks out to `.agents/nsheaps/.ai-agent-henry/`, so the composite action can't be found. Real review runs are failing today.

A plugin gives us:

- One repository (`nsheaps/agents`) as the home of the review pipeline + the review methodology.
- Plugin loading is opt-in per agent — if alex/jack/henry installs `review-utils@agents`, they all gain the `review-code` skill.
- Consumers point at the plugin's actions instead of a specific agent's repo, removing the henry-coupling.

## Plugin layout

```
plugins/claude-code/review-utils/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── docs/
│   ├── build-report-review-utils.md   (rationale + architecture + migration log)
│   ├── plans/
│   │   └── review-utils.md            (this file)
│   └── research/
│       └── (any related research notes)
├── skills/
│   └── review-code/
│       ├── SKILL.md                   (review methodology, ported from henry's pr-review.md)
│       └── partials/
│           └── review-thread-management.md
└── actions/
    ├── agent-setup/action.yaml
    ├── run-agent/action.yaml
    └── with-post-step/action.yaml
```

Workflows (`review-dispatch.yaml`) **stay at canonical `.github/workflows/`** — GitHub requires reusable workflows to live there. The plugin's README and the workflow itself cross-reference each other so the coupling is documented.

## Component decisions

### Skill: `review-code`

Body = current `pr-review.md` content (the methodology — 11-step review process, MCP tool list, check-run handling). Convert the template variables (`${REPO}`, `${PR_NUMBER}`, etc.) into a "Required inputs" section at the top with placeholder syntax that the `run-agent` action interpolates via `envsubst` (same mechanism as today).

The `partials/review-thread-management.md` referenced in step 4 of the methodology gets co-located under `skills/review-code/partials/`.

### Actions

- **`agent-setup`** — port verbatim. Activates mise + installs `gh-pr-review` extension.
- **`run-agent`** — port + **fix the path bug**:
  - Today: `uses: ./agent-repo/.github/actions/agent-setup`
  - After: `uses: ${{ github.action_path }}/../agent-setup` (resolves relative to `run-agent`'s own location, regardless of where the action was checked out)
  - Same fix for the prompt-template path: point at `${{ github.action_path }}/../../skills/review-code/SKILL.md` (with the methodology body extracted as the prompt).
- **`with-post-step`** — port verbatim (third-party Apache-2.0 dep used by the review pipeline; keep upstream attribution intact).

### Reusable workflow

`nsheaps/agents/.github/workflows/review-dispatch.yaml` updates from a **dispatch forwarder** (sends `repository_dispatch` to henry) to a **direct executor** (runs the review itself).

New flow:

1. Consumer repo PR event fires `dispatch-review.yaml` (the consumer's tiny wrapper).
2. Consumer wrapper calls this reusable workflow.
3. The reusable workflow:
   - Checks out `nsheaps/agents@main` (or pinned ref)
   - Runs `./plugins/claude-code/review-utils/actions/run-agent` with the trigger payload
4. `run-agent` does GitHub App auth → checks out the trigger repo → creates check run → runs claude-code-action with the `review-code` skill body as prompt → finalizes check run.

No more `repository_dispatch` round-trip through henry — the review happens in the workflow run on `nsheaps/agents` itself.

### Consumer template

`nsheaps/agents/templates/dispatch-review.yaml` shrinks: it just calls `review-dispatch.yaml` with the agent's secrets (REVIEW_GITHUB_APP_*, REVIEW_ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN). No `target-repo` input anymore — the workflow itself does the work.

## Migration

After the plugin lands + e2e verifies:

1. Update `nsheaps/agents/.github/workflows/review-dispatch.yaml` to the new direct-executor shape.
2. Delete `nsheaps/.ai-agent-henry/.github/workflows/repo-dispatch.yaml`.
3. Delete `nsheaps/.ai-agent-henry/.github/actions/{agent-setup,run-agent,with-post-step}/`.
4. Delete `nsheaps/.ai-agent-henry/.claude/prompts/pr-review.md` (+ partials).
5. Update each consumer repo's `dispatch-review.yaml` to drop the `target-repo` input.

Each step ships as its own PR (or grouped into 2: plugin-add + henry-cleanup).

## Open questions

- **Skill discoverability for the action.** `claude-code-action` runs claude with `plugins: github@nsheaps-ai-mktpl, review-changes@nsheaps-ai-mktpl`. Do we add `review-utils@agents` to that list so the skill is loadable? Currently the prompt is interpolated and passed as a literal string — the skill isn't "invoked", it's the source of the prompt body. So step-1 plugin doesn't need self-loading. We can add a SKILL-mode later (let claude `Skill(review-code, args=…)`) as a follow-up.

- **`with-post-step` necessity.** Today it's referenced but I don't see it used in `run-agent`'s steps. Keep it for now because henry's workflow includes it; flag for removal if confirmed unused.

## Validation

End-to-end verification path before merge:

1. PR opened on a consumer repo with `request-review` label.
2. Consumer `dispatch-review.yaml` fires.
3. `review-dispatch.yaml` (reusable) runs on the agents repo.
4. `run-agent` action completes — check run created on consumer PR, claude-code-action produces a review.
5. Review lands on the consumer PR as a `gh pr review` comment.

If any step fails: roll back the workflow change (keep dispatch-forwarding until fixed).
