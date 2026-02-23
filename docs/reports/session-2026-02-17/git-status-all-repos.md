# Git Status Report — All 5 Repos

Generated: 2026-02-18 by Bugs Bunny (Software Engineer)

## agent-team (`/Users/nathan.heaps/src/nsheaps/agent-team`)

**Branch**: `main` — 1 commit behind origin (needs `git pull`)

### Untracked files (14)

- `docs/research/agent-teams-messaging-external.md`
- `docs/research/agent-teams-messaging-source.md`
- `docs/research/agent-teams-messaging.md`
- `docs/research/room-based-messaging-patterns.md`
- `docs/tickets/PHASE1-DEF-04-no-test-suite.md`
- `docs/tickets/PHASE1-DEF-05-cleanup-stale-entries-noop.md`
- `docs/tickets/PHASE1-DEF-06-health-always-unknown.md`
- `docs/tickets/PHASE1-DEF-07-list-agents-name-mismatch.md`
- `docs/tickets/PHASE1-DEF-08-launch-doesnt-spawn.md`
- `docs/tickets/PHASE1-DEF-09-relaunch-stale-discovery.md`
- `docs/tickets/PHASE1-DEF-10-kill-doesnt-kill-pane.md`
- `docs/tickets/PHASE1-DEF-11-path-traversal.md`
- `docs/tickets/PHASE1-DEF-12-silent-validation-failures.md`
- `docs/tickets/PHASE1-DEF-13-shell-escaping.md`

### Worktrees

| Worktree              | Branch                   | Status                                                                   |
| --------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `fix-health-relaunch` | `fix/health-relaunch`    | Clean except modified `bun.lock` (artifact). PR #13 merged — can delete. |
| `fix-ops-swarm`       | `fix/ops-swarm-findings` | Clean. PR #10 merged — can delete.                                       |

---

## agent (`/Users/nathan.heaps/src/nsheaps/agent`)

**Branch**: `main` — up to date with origin

### Modified files (1)

- `mise.toml`

### Untracked files (2)

- `src/` (directory)
- `tsconfig.json`

---

## claude-utils (`/Users/nathan.heaps/src/nsheaps/claude-utils`)

**Branch**: `main` — up to date with origin

### Untracked files (12)

- `.claude/tmp/all-corrections-tonight.md`
- `.claude/tmp/correct-behavior-artifact-links.md`
- `.claude/tmp/correct-behavior-teammate-abstraction.md`
- `.claude/tmp/github-auth-research.md`
- `.claude/tmp/plugin-install-research-external.md`
- `.claude/tmp/plugin-install-research-source.md`
- `.claude/tmp/pr-review-10-13.md`
- `.claude/tmp/prd-vs-spec-research.md`
- `.claude/tmp/rule-separation-plan.md`
- `docs/specs/draft/agent-github-auth.md`
- `docs/specs/draft/shell-scripts-mcp-server.md`
- `docs/specs/draft/structured-docs-mcp-server.md`

---

## ai-mktpl (`/Users/nathan.heaps/src/nsheaps/ai-mktpl`)

**Branch**: `fix/statusline-direct-write` (was on `main`, switched for PR #164)

### Modified files (1)

- `docs/specs/draft/transcript-monitor-plugin.md`

### Untracked files/dirs (5)

- `docs/specs/draft/agent-representation.md`
- `docs/specs/draft/github-token-refresh-plugin.md`
- `plugins/agent-tab-titles/` (directory — new plugin scaffold)
- `plugins/context-bloat-prevention/` (directory — new plugin scaffold)
- `plugins/fix-pr/` (directory — new plugin scaffold)

### Worktrees

| Worktree                      | Branch                          | Status                            |
| ----------------------------- | ------------------------------- | --------------------------------- |
| `consolidate-todo`            | `feat/consolidate-todo-plugins` | Clean, 1 behind origin            |
| `claude-mention-agent`        | `nate/claude-mention-agent`     | **BROKEN** (dangling .git ref)    |
| `fix-statusline-iterm`        | `nate/fix-statusline-iterm`     | Old branch, superseded by PR #164 |
| `feat-statusline-iterm-badge` | `feat/statusline-iterm-badge`   | Old branch                        |
| Others                        | Various                         | Not checked in detail             |

---

## gs-stack-status (`/Users/nathan.heaps/src/nsheaps/gs-stack-status`)

**Branch**: `main` — up to date with origin

**Clean** — nothing to commit, working tree clean.

---

## Summary

| Repo            | Modified | Untracked | Clean?  |
| --------------- | -------- | --------- | ------- |
| agent-team      | 0        | 14        | No      |
| agent           | 1        | 2         | No      |
| claude-utils    | 0        | 12        | No      |
| ai-mktpl        | 1        | 5         | No      |
| gs-stack-status | 0        | 0         | **Yes** |

**Total**: 2 modified tracked files, 33 untracked files/dirs across 4 repos.

No critical uncommitted code changes — all items are research artifacts, scratch files, draft specs, ticket docs, or WIP plugin scaffolds.
