---
type: chore
id: GSD-57
legacy_ids:
  - "1779912687"
created: 2026-05-27T20:11:27Z
state: triage
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20"
    note: "missing — no originating task found; ticket created without ticket-first discipline (bad job — task should be filed retroactively)"
  - id: discord-source
    type: discord-message
    url: "https://discord.com/channels/.../1509287920358526986"
  - id: repos-md-issue
    type: github-issue
    url: "https://github.com/nsheaps/agents/issues/175"
events:
  - {
      ts: 2026-05-28T02:02:21Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-57 (state=triage)",
    }
---

# GSD-57 — Repository-settings sweep (REPOS.md)

## Original ask

Set up `repository-settings` on each repo in REPOS.md so branch protection, merge rules, label set, default branch, required checks, etc. are managed-as-code (not click-ops in the GitHub UI).

## Goal

Scope: every repo in [`docs/REPOS.md`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/REPOS.md) that's `scope=true`. That's roughly the agent repos + `agents` + `ai-mktpl` + `op-exec` + tracked plugins — see REPOS.md for the canonical list.

What "repository-settings" probably means here:

- A central place (likely `nsheaps/repository-settings` or similar — needs research) that owns the desired settings per-repo, applies them via API/Probot/Action, and drifts back to spec on change.
- Reference: previous discussions about merge-without-approval failures (#476) and the need for STRIKE-ONE rule enforcement at the GitHub layer, not just the agent layer.

## Open questions

1. Does the tool exist already (settings.yml-style probot, https://github.com/repository-settings/app, etc.) or do we need to build/fork one?
2. Single org-wide config vs per-repo config files?
3. Apply via push (probot/GitHub App) or via reusable GH Action workflow?
4. Should agents push spec changes via PR (so the spec change itself is reviewed)?
5. Does this subsume the "request-review vs claude-review label per-repo" memory we have? Could be the place to enforce label consistency.

## Acceptance criteria

_To be defined during triage._

## Related

- [#175 (REPOS.md sweep)][repos-md-issue] — Nate's open issue with the per-repo scope/stale/archive/fork/contrib/owner table
- Source: Nate Discord 2026-05-27 [20:11Z][discord-source] during standup

[^discord-source]: https://discord.com/channels/.../1509287920358526986

[^repos-md-issue]: https://github.com/nsheaps/agents/issues/175
