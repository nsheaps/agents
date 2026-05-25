# REPOS.md — repos in scope for project tracking

This file is the canonical list of repositories that are in scope for the work tracked in [`docs/project-tracking/MASTER.md`](./docs/project-tracking/MASTER.md) and its downstream tickets.

> **Status:** v1.1 — Q1/Q2/Q3 resolved per Nate Discord [1508331380239634652](https://discord.com/channels/1490863845252665415/1497431286661517353/1508331380239634652) (2026-05-25 04:50Z). Q1: .openclaw stays as research-only artifact. Q2: yes, aux repos added (op-exec, homebrew-devsetup, .github). Q3: no — only repos tracked, not branches/worktrees. **Pending**: nsheaps-org-audit subagent ([#509](../../docs/project-tracking/task-summary/I32-repos-md.md)) will surface any missing repos comprehensively.

## Conventions

- **In-scope** here means the repo is referenced by a tracked work item (MASTER.md milestone, per-ticket file, audit, sweep, dreaming triage, incident-search, etc.).
- Repos NOT on this list are out of scope for project tracking — touching them requires either (a) adding them to this list first, or (b) treating the touch as throw-away research that doesn't bubble up.
- Forward-references to specific tickets use `<a id>` anchors in MASTER.md so links stay stable.

## Entries

### 1. nsheaps/agents

| field          | value                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub         | https://github.com/nsheaps/agents                                                                                                                                                  |
| Local path     | `/home/nsheaps/src/nsheaps/agents`                                                                                                                                                 |
| Role           | Workspace monorepo — agent binaries, apps, services, claude-code plugins. This doc lives here.                                                                                     |
| Default branch | `main`                                                                                                                                                                             |
| Audit          | [`alex/docs/journal/2026/05/24/repo-audit/repo-audit.md §1`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/24/repo-audit/repo-audit.md#1-nsheapsagents) |

### 2. nsheaps/ai-mktpl

| field          | value                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub         | https://github.com/nsheaps/ai-mktpl                                                                                                                                                  |
| Local path     | `/home/nsheaps/src/nsheaps/ai-mktpl`                                                                                                                                                 |
| Role           | Plugin marketplace — source of truth for all installable Claude Code plugins.                                                                                                        |
| Default branch | `main`                                                                                                                                                                               |
| Audit          | [`alex/docs/journal/2026/05/24/repo-audit/repo-audit.md §2`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/24/repo-audit/repo-audit.md#2-nsheapsai-mktpl) |

### 3. nsheaps/.ai-agent-alex

| field          | value                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub         | https://github.com/nsheaps/.ai-agent-alex                                                                                                                                                 |
| Local path     | `/home/nsheaps/src/nsheaps/.ai-agent-alex`                                                                                                                                                |
| Role           | Alex's personal repo — local skills, hooks, memory, journal, runtime config.                                                                                                              |
| Default branch | `main`                                                                                                                                                                                    |
| Audit          | [`alex/docs/journal/2026/05/24/repo-audit/repo-audit.md §3`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/24/repo-audit/repo-audit.md#3-nsheapsai-agent-alex) |

### 4. nsheaps/.ai-agent-jack

| field          | value                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub         | https://github.com/nsheaps/.ai-agent-jack                                                                                                                                                 |
| Local path     | `/home/nsheaps/src/nsheaps/.ai-agent-jack`                                                                                                                                                |
| Role           | Jack's personal repo.                                                                                                                                                                     |
| Default branch | `main`                                                                                                                                                                                    |
| Audit          | [`alex/docs/journal/2026/05/24/repo-audit/repo-audit.md §4`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/24/repo-audit/repo-audit.md#4-nsheapsai-agent-jack) |

### 5. nsheaps/.ai-agent-henry

| field          | value                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub         | https://github.com/nsheaps/.ai-agent-henry                                                                                                                                                 |
| Local path     | `/home/nsheaps/src/nsheaps/.ai-agent-henry`                                                                                                                                                |
| Role           | Henry's personal repo.                                                                                                                                                                     |
| Default branch | `main`                                                                                                                                                                                     |
| Audit          | [`alex/docs/journal/2026/05/24/repo-audit/repo-audit.md §5`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/24/repo-audit/repo-audit.md#5-nsheapsai-agent-henry) |

### 6. nsheaps/.openclaw (local-only research artifact)

| field          | value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub         | — _(not a git repo; local config/data directory)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Local path     | `/home/nsheaps/.openclaw`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Role           | Nate's local OpenClaw config/data directory. **NOT a git checkout** — looks like agent runtime state (`identity/`, `memory/`, `hooks/`, `flows/`, `extensions/`, `delivery-queue/`, etc.). Included per Nate Discord [`1508325751265431552`](https://discord.com/channels/1490863845252665415/1497431286661517353/1508325751265431552) as research artifact for [`I44`](./docs/project-tracking/MASTER.md#I44) incident-utils archaeology — past incident-\* attempt patterns may live in `hooks/`, `extensions/`, or `memory/`. |
| Default branch | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Audit          | Not yet audited (separate ticket if needed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### 7. nsheaps/aitkit

| field          | value                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub         | https://github.com/nsheaps/aitkit                                                                                                                                |
| Local path     | `/home/nsheaps/src/nsheaps/aitkit`                                                                                                                               |
| Role           | Nate's earlier agentic toolkit. Research input for [`I44`](./docs/project-tracking/MASTER.md#I44) — incident-\* archaeology should scan all branches back ~1.5y. |
| Default branch | `main`                                                                                                                                                           |
| Audit          | Not yet audited (separate ticket if needed; see [`I39`](./docs/project-tracking/MASTER.md#I39) for re-run framing).                                              |

### 8. nsheaps/claude-code-sessions

| field          | value                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub         | https://github.com/nsheaps/claude-code-sessions                                                                                                                   |
| Local path     | `/home/nsheaps/src/nsheaps/claude-code-sessions`                                                                                                                  |
| Role           | Nate's session/research archive. Research input for [`I44`](./docs/project-tracking/MASTER.md#I44) — incident-\* archaeology should scan all branches back ~1.5y. |
| Default branch | `main`                                                                                                                                                            |
| Audit          | Not yet audited (separate ticket if needed).                                                                                                                      |

### 9. nsheaps/op-exec

| field          | value                                                                                                                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub         | https://github.com/nsheaps/op-exec                                                                                                                                                                                                                          |
| Local path     | `/home/nsheaps/src/nsheaps/op-exec`                                                                                                                                                                                                                         |
| Role           | 1Password env-injection wrapper used by `1pass` plugin + bin/agent launcher. Touched recently — bumped to v0.1.0 via [PR #24](https://github.com/nsheaps/op-exec/pull/24) (variable-shadowing fix). Aux repo per Nate Q2 (touched-but-not-owned in scope). |
| Default branch | `main`                                                                                                                                                                                                                                                      |
| Audit          | Not yet audited (separate ticket if needed).                                                                                                                                                                                                                |

### 10. nsheaps/homebrew-devsetup

| field          | value                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub         | https://github.com/nsheaps/homebrew-devsetup                                                                                                                                         |
| Local path     | `/home/nsheaps/src/nsheaps/homebrew-devsetup`                                                                                                                                        |
| Role           | Homebrew tap for nsheaps dev-setup formulae. Forward-referenced in [`E11.1`](./docs/project-tracking/MASTER.md) (monorepo task standardization). Aux repo per Nate Q2. |
| Default branch | `main`                                                                                                                                                                               |
| Audit          | Not yet audited (separate ticket if needed).                                                                                                                                         |

### 11. nsheaps/.github

| field          | value                                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub         | https://github.com/nsheaps/.github                                                                                                                                                                                                                   |
| Local path     | `/home/nsheaps/src/nsheaps/nsheaps-dotgithub` (cloned under different name locally)                                                                                                                                                                  |
| Role           | nsheaps GitHub org-level config: org README, secret-sync workflows, default templates. Touched recently — task #242 PR'd to add agent repos to AUTOMATION_GITHUB_APP_\* secret-sync targets. Aux repo per Nate Q2. Slated for E3 deprecation eventually. |
| Default branch | `main`                                                                                                                                                                                                                                               |
| Audit          | Not yet audited.                                                                                                                                                                                                                                     |

## How to add a repo

1. Append a new `### N. <org>/<name>` block with the same fields as above.
2. Link the audit if one exists; otherwise note "Not yet audited" and consider opening an audit ticket.
3. Reference the source (Discord message link or per-task doc) that added it to scope.
4. Update any downstream consumers (`I44` incident-utils archaeology scope, `I9` ticket-utils repo lookup, etc.) to include the new repo.

## Open questions (v1 draft)

See [`docs/project-tracking/task-summary/I32-repos-md.md`](./docs/project-tracking/task-summary/I32-repos-md.md) §"Scope review" for Q1–Q3 awaiting handler review.
