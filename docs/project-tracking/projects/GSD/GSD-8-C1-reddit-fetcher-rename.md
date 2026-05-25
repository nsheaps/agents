---
type: feature
id: GSD-8
state: done
created: 2026-05-25T19:39:00Z
completed: 2026-05-25T20:30:00Z
project: GSD
assignee: contacts://heaps-group/byGithubUsername/nsheaps
requester: contacts://heaps-group/byGithubUsername/nsheaps
milestone: ../../milestones/M5.md
references:
  - id: pr-166
    type: github-pr
    url: https://github.com/nsheaps/agents/pull/166
  - id: master-c1
    type: doc
    url: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md
events:
  - {
      ts: 2026-05-25T23:18:00Z,
      by: alex,
      change: "promoted from to-triage/C1-reddit-fetcher-rename to GSD-8 (state=done)",
    }
---

# [old C1] rename reddit-fetcher plugin to reddit + merge + install on all agents

## Original message

From [MASTER.md `## defining scope and cleaning git state` bullet `C1`][^master-c1]:

> `C1`: rename this plugin to `reddit` from reddit-fetcher [PR #166][^pr-166] (OPEN) — get it merged, and added to all agents. This is the current checkout branch and there's pending changes to commit, but they should go to main

## PR state (snapshot 2026-05-25 04:55Z)

- PR: [#166][^pr-166] — `feat: add reddit-fetcher plugin`
- Author: Jack ([`jack-nsheaps[bot]`](https://github.com/jack-nsheaps))
- Branch: `feat/reddit-fetcher-plugin`
- 2 commits ahead of `main` from 958a47a:
  - `5bb4f71` feat(reddit-fetcher): add reddit-fetcher Claude Code plugin
  - `2609ea0` chore: auto-bump plugin versions and update marketplace
- CI: all green (validate, auto-version-bump, lint, test)
- Review decision: none yet
- Mergeable: UNKNOWN (likely needs rebase or simple)
- Files (6): `.claude-plugin/marketplace.json` (MOD), and 5 ADDED under `plugins/claude-code/reddit-fetcher/`

The "pending changes to commit" phrase in C1 may refer to local changes that no longer exist (no worktree on the branch, no local mods on `main`) — interpreting as "the PR has pending changes (not-yet-merged)" rather than "local uncommitted changes."

## Scope

In:

- Rename `plugins/claude-code/reddit-fetcher/` → `plugins/claude-code/reddit/`
- Update `plugin.json` `name` field: `reddit-fetcher` → `reddit`
- Update `.claude-plugin/marketplace.json` entries that reference path/name
- Update internal references in `README.md`, `SKILL.md`, and any script-internal strings if the binary/skill name should change
- Get PR #166 merged
- Add the plugin to all 3 agents (alex, jack, henry) via their `plugins.settings.yaml`
- Verify install works (one agent at least — alex is self, can verify immediately)

Out:

- Adding new features to reddit plugin (just rename + ship)
- Changing the script API or subcommand names (`subreddit`, `post`, `search`, `user` stay as-is unless rename mandates a `reddit-*` prefix)
- Authoring new tests (existing CI green, not breaking)

## Scope review (3 approach options — handler decision needed)

PR is by Jack. I shouldn't unilaterally force-push to a peer's branch. Three approaches:

### Approach A: ask Jack to rename pre-merge (slowest, cleanest)

- Comment on PR #166 asking Jack to do the rename in a new commit
- Jack pushes update; CI re-runs; review; merge
- Pro: respects PR ownership; minimal coordination overhead beyond the ask
- Con: Jack is currently spun down per `I7` — would need to bring him up briefly

### Approach B: take over the PR (push to Jack's branch as additive commit)

- Jack's PR branch lives on origin; I can push to it as alex with the github-app token
- Add a rename commit on top of `2609ea0`; CI re-runs; merge after Nate approval
- Pro: doesn't require Jack to be up; faster
- Con: stepping on a peer's PR — unusual; needs explicit handler ack first

### Approach C: merge as-is, rename in follow-up PR

- Merge PR #166 as `reddit-fetcher` (preserves Jack's authorship cleanly)
- Open a follow-up rename PR authored by alex
- Pro: clear authorship lineage; no stepping on peer's PR
- Con: creates a brief window where the plugin is named `reddit-fetcher` in main; needs 2 PR cycles

**Recommendation: Approach B with explicit Nate ack** — Jack-is-down avoids his coordination burden, and the rename is intent-aligned with the original PR. Approach C is the safe fallback if Nate prefers cleaner authorship.

## Deliverables

1. Approach chosen + handler ack recorded in this doc.
2. PR #166 merged with the plugin path/name as `reddit`.
3. `alex` `plugins.settings.yaml` updated to install the `reddit` plugin (+ commit + push).
4. Jack/henry install (deferred to peer-coord — separate ticket if needed).

## Plan (assuming Approach B post-ack)

1. Get Nate ack on Approach B (or alternative).
2. `cd` into agents worktree on `feat/reddit-fetcher-plugin` (create if not exists).
3. `git mv plugins/claude-code/reddit-fetcher plugins/claude-code/reddit`.
4. Update `plugin.json` name field.
5. Update `marketplace.json` paths/names.
6. Grep for `reddit-fetcher` in remaining files; update where appropriate (likely just docs).
7. Commit as additive (don't force-push); push to the PR branch.
8. Wait for CI green; request review from Nate; merge after approval.
9. Install in alex; commit + push.
10. Open follow-up ticket for jack/henry install when they're up.

## Scope guardrails

- Do NOT force-push Jack's branch — only additive commits.
- Do NOT merge without explicit Nate approval (per STRIKE ONE rule).
- Do NOT touch the script API or subcommand surface — rename is dir + name only.
- Do NOT install on jack/henry while they're spun down — defer per peer-coord ticket.

## Open Questions

- (Q1) Which approach (A/B/C)? Recommend B.
- (Q2) Should the SKILL `fetch-reddit` also rename (e.g. → `reddit-fetch` or stay)? Recommend stay — the skill name is independent of plugin name and `fetch-reddit` is descriptive.
- (Q3) Plugin **command** alias (if any) — does Nate want `/reddit:...` to replace `/reddit-fetcher:...`? Slash-command namespacing follows plugin name, so yes by default — but flag in case Nate has a different preference.

## Log

- 2026-05-25 04:55Z: doc created. Awaiting Nate's pick on Q1 (approach) before executing.

[^pr-166]: https://github.com/nsheaps/agents/pull/166

[^master-c1]: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md
