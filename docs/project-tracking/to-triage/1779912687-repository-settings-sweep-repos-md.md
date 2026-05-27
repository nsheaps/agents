Set up `repository-settings` on each repo in REPOS.md so branch protection, merge rules, label set, default branch, required checks, etc. are managed-as-code (not click-ops in the GitHub UI).

Scope: every repo in [`docs/REPOS.md`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/REPOS.md) that's `scope=true`. That's roughly the agent repos + `agents` + `ai-mktpl` + `op-exec` + tracked plugins — see REPOS.md for the canonical list.

What "repository-settings" probably means here:

- A central place (likely `nsheaps/repository-settings` or similar — needs research) that owns the desired settings per-repo, applies them via API/Probot/Action, and drifts back to spec on change.
- Reference: previous discussions about merge-without-approval failures (#476) and the need for STRIKE-ONE rule enforcement at the GitHub layer, not just the agent layer.

Open questions for triage:

1. Does the tool exist already (settings.yml-style probot, https://github.com/repository-settings/app, etc.) or do we need to build/fork one?
2. Single org-wide config vs per-repo config files?
3. Apply via push (probot/GitHub App) or via reusable GH Action workflow?
4. Should agents push spec changes via PR (so the spec change itself is reviewed)?
5. Does this subsume the "request-review vs claude-review label per-repo" memory we have? Could be the place to enforce label consistency.

Related:

- [Task #476 (completed)](N/A — alex local task list) — added notes to repository-settings bullet in MASTER.md after merge-without-approval failure
- [#175 (REPOS.md sweep)](https://github.com/nsheaps/agents/issues/175) — Nate's open issue with the per-repo scope/stale/archive/fork/contrib/owner table

Source: Nate Discord 2026-05-27 [20:11Z](https://discord.com/channels/.../1509287920358526986) during standup.
