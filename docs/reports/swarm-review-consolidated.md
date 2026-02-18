# Consolidated Swarm Review: nsheaps/agent-team

**Date**: 2026-02-18
**Branch**: main
**Reviewers**: PM (Elmer Fudd), Ops (Foghorn Leghorn), Coach (Wile E. Coyote), QA (Daffy Duck)

---

## Section 1: Team Can Fix

Items where the team can make code/docs changes directly without user intervention.

### CRITICAL

| ID | Finding | Reviewer | Description |
|----|---------|----------|-------------|
| C1 | AI Agent Eng "monitoring" role is architecturally impossible | Coach | The `ai-agent-eng.md` agent definition claims it "observes team interactions" and "monitors team for process failures," but teammates can only see messages sent directly to them. The role is actually a corrector/recorder (analyzes issues flagged by team lead), not an observer/monitor. Must rewrite responsibilities, edge cases, and standing task descriptions to match actual architecture. |

### HIGH

| ID | Finding | Reviewer | Description |
|----|---------|----------|-------------|
| OPS-2 | Release workflow missing GITHUB_TOKEN env | Ops | `.github/workflows/release.yaml:37` — `bun run release-it --ci` runs without `GITHUB_TOKEN` env var. Same bug previously fixed in claude-team and claude-utils. Add `env: GITHUB_TOKEN: ${{ steps.auth.outputs.token }}` to the release-it step. |
| OPS-3 | Release workflow missing version/tag outputs | Ops | Release job has no `outputs:` block and no `id: release` on the release step. Blocks any future Homebrew update job. Add outputs block following claude-team's pattern. |
| OPS-4 | `actions/checkout@v6` in composite action | Ops | `.github/actions/github-app-auth/action.yml:73` uses `actions/checkout@v6` which likely doesn't exist. Same bug fixed in claude-team and claude-utils. Downgrade to `actions/checkout@v4`. |
| H1 | Rules vs Behaviors — unclear boundary | Coach | `.claude/rules/` (2 files) and `.claude/behaviors/` (13 files) overlap in structure. `teammate-abstraction.md` and `research-before-broadcasting.md` in rules/ read like behaviors. Document the distinction: rules = short declarative constraints (loaded every API call), behaviors = multi-step procedures. |
| H2 | `verify-before-blaming.md` duplicated across repos | Coach | Exists in both `.claude/behaviors/` (71 lines, detailed) and `ai-mktpl/.ai/rules/` (shorter). Maintenance risk — which is authoritative? Decide and cross-reference or deduplicate. |
| H3 | Stale `nsheaps/.ai` reference in AI Agent Eng agent | Coach | `.claude/agents/ai-agent-eng.md:98` references `nsheaps/.ai` and links to `nsheaps/ai`, both renamed to `nsheaps/ai-mktpl`. Agent will try to find a repo that doesn't exist at that URL. |
| QA-1 | `bin/agent-launch.ts` (300 lines) has zero test coverage | QA | All CLI arg parsing, subcommand routing, and output formatting are untested. |

### MEDIUM

| ID | Finding | Reviewer | Description |
|----|---------|----------|-------------|
| OPS-6 | Lint (formatting) failing on main | Ops | `.claude/rules/teammate-abstraction.md` not formatted. Run `mise run fmt` and commit. Main branch should be green. |
| OPS-7 | Both `bun.lock` and `yarn.lock` present | Ops | CI uses `bun install`, `mise.toml` specifies bun. `yarn.lock` appears to be an artifact. Remove `yarn.lock` and add to `.gitignore`. |
| OPS-8 | Missing `--frozen-lockfile` in CI | Ops | Both `release.yaml` and `test.yaml` use bare `bun install`. Add `--frozen-lockfile` for reproducibility. |
| M1 | Plugin has `version` field despite ai-mktpl removing them | Coach | `plugins/agent-team-skills/.claude-plugin/plugin.json:3` still has `"version": "0.1.0"`. Version fields were just removed from ai-mktpl skills (task #165/#169). Remove it here too. |
| M2 | No `.claude/rules/README.md` | Coach | `behaviors/` has a README but `rules/` does not. Since rules are a new addition, document what goes there vs behaviors. |
| M3 | Behaviors don't cross-reference each other consistently | Coach | Several logically chained behaviors don't mention each other (pre-task-checklist/verification, code-review/commit-hygiene, communication-verification/failure-reporting). |
| M4 | team-member-cleanup contradicts lifecycle-management | Coach | `lifecycle-management.md` says "Never manually edit config.json" but `team-member-cleanup.md` Option B provides a `jq` command to do exactly that. Acknowledge the exception explicitly. |
| M5 | `.claude/tmp/` has 40+ files with no cleanup convention | Coach | Research reports, QA outputs, failure logs, test artifacts accumulated with no policy for cleanup, archival, or movement to `docs/research/`. |
| PM-1 | 14 open file-based tickets with no GitHub Issues | PM | `docs/tickets/` has 14 open tickets (8 feature, 5 defect + 1 review). None mirrored to GitHub Issues. Should triage: migrate active ones, archive stale ones. |
| PM-2 | Dual tracking systems (files + issues + session tasks) | PM | Work tracked in three places with no single source of truth. Establish GitHub Issues as authoritative. |
| QA-4/7 | `health` subcommand always shows UNKNOWN | QA | Hardcodes "UNKNOWN" for every member despite `isTmuxPaneAlive()` already existing in lifecycle.ts and being used correctly by `listAgents()`. Should call it. |
| QA-8 | `launch` and `relaunch` subcommands are no-ops | QA | `launch` prints args then says "Direct spawning not yet implemented" despite `spawnAgent()` existing. `relaunch` has the same issue. |
| QA-2 | No integration tests | QA | All 54 tests are unit tests with mocked fs. No test spawns `agent-launch` as a subprocess. |
| QA-3 | `spawnAgent()` function untested | QA | Only `buildSpawnArgs()` is tested. The actual `Bun.spawn` call is never exercised. |

### LOW

| ID | Finding | Reviewer | Description |
|----|---------|----------|-------------|
| OPS-9 | `.release-it.base.json` purpose unclear | Ops | Hooks reference `prettier --write .claude-plugin/plugin.json` but no such file exists at root. May be for `plugins/agent-team-skills/`. Needs clarification comment. |
| OPS-10 | `renovate.json` uses `.json` not `.json5` | Ops | Per user preference, should use `.json5` for comments. Low priority. |
| OPS-11 | Untracked defect ticket files | Ops | 10 `docs/tickets/PHASE1-DEF-*.md` files shown in `git status`. Should be committed or gitignored. |
| OPS-12 | `.vscode/` directory committed | Ops | In `.gitignore` but exists in git history. May contain stale settings. |
| L1 | Orchestrator agent references `claude-utils` repo | Coach | `.claude/agents/orchestrator.md` references `claude-team`/`ct` helper scripts from claude-utils. Creates external dependency that should be documented. |
| L2 | License mismatch (README vs LICENSE vs package.json) | Coach + QA | README says "Proprietary. All rights reserved.", LICENSE file is MIT, package.json says `"UNLICENSED"`. Three contradictory statements. |
| L3 | No behavior for scope creep prevention | Coach | Multiple session failures involved scope expansion without approval. `incremental-design.md` partially covers this but a dedicated section would help. |
| PM-3 | `scratch.md` is unstructured backlog | PM | 100 lines mixing feature ideas, architecture decisions, research topics, operational learnings. Should be triaged into issues, specs, or archive. |
| PM-4 | 11 draft specs with no tracking | PM | `docs/specs/draft/` has 11 specs with no corresponding GitHub Issues. Need triage pass. |
| PM-5 | `research-topics.md` stale | PM | Lists research questions, some already answered by completed research docs. Lists not updated. |
| QA-9 | `relaunch` uses stale discovery result | QA | After killing agent, looks up agent from pre-kill `discoverResult` instead of re-discovering. Should call `discoverAgents()` again. |
| QA-11 | `writeTeamConfig` doesn't create parent directories | QA | `writeFileSync()` without `mkdirSync`. Works for current callers but the function is exported and could fail if called directly. |
| QA-5 | Test fixtures create temp dirs without cleanup | QA | Tests create tmpdir fixtures but never clean them. Relies on OS temp cleanup. |
| QA-6 | `resolveProjectRoot()` non-git path untested | QA | Only tests override and git-root paths, not bare non-git directory. |
| QA-10 | `cleanupStaleEntries` counter readability | QA | `trackedCount` computed from post-cleanup state + removed count. Not a bug, but confusing. |

### INFO

| ID | Finding | Reviewer | Description |
|----|---------|----------|-------------|
| PM-6 | No release tracking needed | PM | Correct for POC — no shipping code. |
| QA-12 | License mismatch (same as L2) | QA | Duplicate of L2 above. |
| QA-13 | Hardcoded "54 passing tests" in README | QA | Will become stale as tests are added/removed. Consider removing or generating. |

---

## Section 2: Needs User Action

Items requiring secrets, decisions, external access, or policy choices.

### CRITICAL

| ID | Finding | Reviewer | Action Required |
|----|---------|----------|-----------------|
| OPS-1 | Missing automation secrets | Ops | `AUTOMATION_GITHUB_APP_ID` and `AUTOMATION_GITHUB_APP_PRIVATE_KEY` are NOT configured on this repo. All Release workflow runs are failing. **User must add both secrets via GitHub repo settings.** |

### HIGH

| ID | Finding | Reviewer | Action Required |
|----|---------|----------|-----------------|
| OPS-5 | No Homebrew formula publishing | Ops | Release workflow has no `update-homebrew` job, no `Formula/` directory. Even if releases work, no path to `brew install`. **User decision needed: Is this intentional for POC, or should Homebrew publishing be added now?** |

### MEDIUM

| ID | Finding | Reviewer | Action Required |
|----|---------|----------|-----------------|
| PM-1 | File-based tickets migration policy | PM | 14 open tickets in `docs/tickets/` need a decision: bulk-migrate to GitHub Issues, archive in place, or close. PM recommends NOT bulk-creating issues for stale POC tickets. **User decision needed.** |
| PM-2 | Single source of truth for task tracking | PM | Work tracked in files, GitHub Issues, and session tasks. **User decision needed: Confirm GitHub Issues as authoritative and archive file-based tickets.** |
| L2 | License decision | Coach + QA | Three contradictory license statements (MIT file, UNLICENSED in package.json, Proprietary in README). **User must decide which license applies and make all three consistent.** |
| H2 | `verify-before-blaming` authority | Coach | Same concept in two repos (agent-team behaviors, ai-mktpl rules). **User decision: Which is authoritative? Should one reference the other?** |

---

## Summary Statistics

| Severity | Team Can Fix | Needs User Action | Total |
|----------|-------------|-------------------|-------|
| CRITICAL | 1 | 1 | 2 |
| HIGH | 7 | 1 | 8 |
| MEDIUM | 14 | 3 | 17 |
| LOW | 15 | 1 | 16 |
| INFO | 3 | 0 | 3 |
| **Total** | **40** | **6** | **46** |

### Reviewers Not Reporting

The following reviewers did not have review files:
- Engineer (swarm-review-eng.md — not found)
- Docs/Technical Writer (swarm-review-docs.md — not found)
- Researcher (swarm-review-researcher.md — not found)

### Cross-Reviewer Duplicates

The following findings were independently discovered by multiple reviewers:
- **License mismatch**: Found by both Coach (L2) and QA (QA-12)
- **health subcommand UNKNOWN status**: Found by QA as both QA-4 and QA-7 (same issue, listed in two places in QA report)
