# Issue Triage Report

Generated: 2026-02-23

## Executive Summary

### Total Issues by Repository

- `agent-team`: 34 issues
- `ai-mktpl`: 20 issues
- `agent`: 9 issues
- `.github`: 7 issues
- `gs-stack-status`: 7 issues
- `claude-utils`: 2 issues
- `claude-team`: 2 issues
- `git-wt`: 4 issues
- Other repos (dotfiles, pull-from-upstream, claude-code-sessions, .ai-agent-henry, github2, cc-investigation): 1 issue each

**Total: 89 open issues**

### Critical Findings

#### Issues Missing Priority Labels (23 total)

- `nsheaps/ai-mktpl/#177` — Support cross-repo plugin references
- `nsheaps/gs-stack-status/#12` — Worktree detection fails when local branch name differs from remote tracking branch
- `nsheaps/gs-stack-status/#11` — Replace "(needs restack)" and "(needs push)" with status emoji
- `nsheaps/agent-team/#76` — Defect: readBasePrompt path traversal vulnerability
- `nsheaps/agent-team/#75` — Make team name a configurable first-class parameter (end-to-end)
- `nsheaps/agent-team/#74` — Update agent file frontmatter with launcher fields
- `nsheaps/agent-team/#73` — Implement full agent spawning module
- `nsheaps/agent-team/#72` — Implement prompt assembly (extend/replace modes + base prompt selection)
- `nsheaps/agent-team/#71` — Implement agent file discovery + YAML frontmatter parsing
- `nsheaps/agent-team/#70` — Research: does Claude Code support --system-prompt (replace) flag?
- `nsheaps/claude-team/#7` — run-claude uses gum without install guard
- `nsheaps/git-wt/#8` — Add separate delete options: workflow+branch, workflow only, branch only
- `nsheaps/git-wt/#7` — Bring back gum spinner when deleting worktree
- `nsheaps/git-wt/#6` — Switching to other repos exits instead of returning to worktree selector
- `nsheaps/dotfiles/#3` — make iterm profile portable to other platforms besides macos
- `nsheaps/github2/#121` — wishlist
- `nsheaps/cc-investigation/#1` — Create mechanism to auto download special prompts from each new version of claude
- `nsheaps/dotfiles/#5` — Dependency Dashboard (skip, but noted)
- `nsheaps/pull-from-upstream/#3` — Dependency Dashboard (skip, but noted)
- `nsheaps/claude-code-sessions/#3` — Dependency Dashboard (skip, but noted)
- `nsheaps/.ai-agent-henry/#5` — Dependency Dashboard (skip, but noted)

#### Issues Needing "needs-human-attention" Label

These require owner decision/approval/credentials:

**P1 - Critical (requires immediate attention):**

- `nsheaps/agent-team/#4` — Add AUTOMATION_GITHUB_APP_ID and AUTOMATION_GITHUB_APP_PRIVATE_KEY secrets (repo owner needs to create credentials and configure secrets)
- `nsheaps/agent-team/#8` — License mismatch: MIT file vs UNLICENSED vs Proprietary (owner decision on which is correct)
- `nsheaps/.github/#11` — Sync automation secrets across repos using Ansible (requires credential setup and Ansible playbook authorization)
- `nsheaps/agent/#9` — Add AUTOMATION_GITHUB_APP_ID and AUTOMATION_GITHUB_APP_PRIVATE_KEY secrets (requires credential creation)
- `nsheaps/agent/#7` — License mismatch (owner decision)
- `nsheaps/agent/#4` — Add dist/ to .gitignore with 60MB binary in git (decision: rewrite history or keep as-is)
- `nsheaps/ai-mktpl/#166` — sync-settings.py has no file locking (race condition with potential data loss — needs reproduction/validation)

**P2 - High (requires owner decision):**

- `nsheaps/agent-team/#5` — Decision needed: Add Homebrew formula publishing to release pipeline?
- `nsheaps/.github/#8` — Add secret sync workflow using op exec from .ai repo (requires 1Password credentials/approval)
- `nsheaps/.github/#9` — Add settings sync (infrastructure decision)
- `nsheaps/.github/#10` — Add github app sync (infrastructure decision)
- `nsheaps/.github/#12` — Automate syncing priority labels (org-wide policy decision)

**P3 - Medium (owner input may be needed):**

- `nsheaps/agent-team/#9` — Decide authority for verify-before-blaming rule (design decision about rule location)

#### Issues Assigned to @nsheaps

Issues already assigned to owner that may be delegate-able:

- `#4` (agent-team) — Add secrets — BLOCKED on credentials, needs owner action
- `#5` (agent-team) — Homebrew publishing decision — NEEDS OWNER DECISION
- `#7` (agent-team) — Task tracking system — Decision issue, could delegate implementation once decided
- `#8` (agent-team) — License mismatch — NEEDS OWNER DECISION
- `#9` (agent-team) — Rule authority decision — NEEDS OWNER DECISION
- `#1` (claude-team) — GITHUB_JOB_URL env var (bug) — Appears delegable, low complexity
- `#7` (agent) — License mismatch — NEEDS OWNER DECISION
- `#9` (agent) — Add secrets — BLOCKED on credentials
- `#1` (cc-investigation) — Auto download special prompts — Feature request, delegable

**Delegate-able from @nsheaps (non-blocking, clear scope):**

- `nsheaps/claude-team/#1` — GITHUB_JOB_URL env var (REL-6) — P2 bug, clear scope
- `nsheaps/cc-investigation/#1` — Auto download special prompts — P? feature, delegable

#### Dependency Dashboards (6 total, skip implementation)

These are auto-generated and should not be triaged for work:

- `nsheaps/dotfiles/#5`
- `nsheaps/pull-from-upstream/#3`
- `nsheaps/claude-code-sessions/#3`
- `nsheaps/.ai-agent-henry/#5`

#### Potential Duplicates or Related Issues

**License Issues (duplicated across repos):**

- `nsheaps/agent-team/#8` — License mismatch (MIT vs UNLICENSED vs Proprietary)
- `nsheaps/agent/#7` — License mismatch (UNLICENSED vs MIT in LICENSE file)

**GitHub App Secret Sync (multi-repo need):**

- `nsheaps/agent-team/#4` — Add AUTOMATION_GITHUB_APP_ID secrets
- `nsheaps/agent/#9` — Add AUTOMATION_GITHUB_APP_ID secrets
- `nsheaps/.github/#11` — Sync secrets across repos using Ansible
- `nsheaps/agent-team/#8` (related through licensing complexity)

**Release Workflow Issues:**

- `nsheaps/claude-team/#1` — GITHUB_JOB_URL env var (REL-6)
- `nsheaps/gs-stack-status/#4` — GITHUB_JOB_URL env var (same issue pattern)

---

## By Repository

### nsheaps/agent-team (34 issues)

#### P1 (Critical)

- `#76` — Defect: readBasePrompt path traversal vulnerability — **NO PRIORITY LABEL** — unassigned — **needs-human-attention**: Security vulnerability, needs security review/testing
- `#59` — Critical: Add shell argument sanitization in spawn.ts — bug, p1 — unassigned
- `#8` — License mismatch: MIT file vs UNLICENSED in package.json vs Proprietary in README — bug, p1 — **assigned to @nsheaps** — **needs-human-attention**: Owner must decide which is correct license

#### P2 (High)

- `#23` — Triage scratch.md, draft specs, and stale research topics — documentation, p2 — unassigned
- `#20` — README overhaul: add quick start, architecture overview, installation — documentation, p2 — unassigned
- `#19` — writeTeamConfig should create parent directories before writing — bug, p2 — unassigned
- `#18` — Implement launch and relaunch subcommands (currently no-ops) — enhancement, p2 — unassigned
- `#12` — Add TypeScript type checking to CI pipeline — enhancement, p2 — unassigned
- `#11` — Add input validation for tool names in agent frontmatter — bug, enhancement, p2 — unassigned
- `#9` — Decide authority for verify-before-blaming rule — enhancement, p2 — **assigned to @nsheaps** — **needs-human-attention**: Design decision needed
- `#7` — Establish single source of truth for task tracking — enhancement, p2 — **assigned to @nsheaps** — Could delegate implementation once decided
- `#5` — Decision needed: Add Homebrew formula publishing to release pipeline? — enhancement, p2 — **assigned to @nsheaps** — **needs-human-attention**: Owner approval required
- `#4` — Add AUTOMATION_GITHUB_APP_ID and AUTOMATION_GITHUB_APP_PRIVATE_KEY secrets — bug, p1 — **assigned to @nsheaps** — **needs-human-attention**: Requires credentials/GitHub setup

#### P3 (Medium)

- `#75` — Make team name a configurable first-class parameter (end-to-end) — **NO PRIORITY LABEL** — unassigned
- `#74` — Update agent file frontmatter with launcher fields — **NO PRIORITY LABEL** — unassigned
- `#73` — Implement full agent spawning module — **NO PRIORITY LABEL** — unassigned
- `#72` — Implement prompt assembly — **NO PRIORITY LABEL** — unassigned
- `#71` — Implement agent file discovery + YAML frontmatter parsing — **NO PRIORITY LABEL** — unassigned
- `#70` — Research: does Claude Code support --system-prompt (replace) flag? — **NO PRIORITY LABEL** — unassigned
- `#67` — Feature: Hook-based security system for bypass permission mode — enhancement, p3 — unassigned
- `#66` — Behavior: Honest fault admission + coach escalation skill — enhancement, p3 — unassigned
- `#64` — Plugin: persist agent team hooks and configs across team deletion — enhancement, p3 — unassigned
- `#63` — Add QA spot-check of completed tasks before session ends — enhancement, p3 — unassigned
- `#47` — Ops swarm review: .release-it.base.json purpose unclear, untracked defects — enhancement, p3 — unassigned
- `#36` — cleanupStaleEntries counter computed from mixed pre/post state (QA-10) — enhancement, p3 — unassigned
- `#34` — Test fixtures create temp dirs without cleanup (QA-5) — enhancement, p3 — unassigned
- `#25` — Create behavior index, standard chain, and formalize rules concept — documentation, enhancement, p3 — unassigned
- `#24` — Add scope creep prevention behavior for agent sessions — enhancement, p3 — unassigned
- `#22` — Standardize spec frontmatter format and add acceptance criteria — documentation, enhancement, p3 — unassigned
- `#21` — Fix broken external repo references in draft specs — bug, documentation, p2 — unassigned
- `#16` — Remove or use unused teamName parameter in buildSpawnArgs — bug, p3 — unassigned
- `#15` — Refactor agent-launch.ts: extract subcommands into separate files — enhancement, p3 — unassigned
- `#14` — Expand test coverage: prompt, lifecycle, CLI entry point, integration tests — enhancement, p3 — unassigned

#### P4 (Eventually)

- `#69` — Feature: Agent isolation from host system authentication — p4 — unassigned
- `#68` — Feature: SSH-in-Docker remote agent execution with tmux panes — p4 — unassigned
- `#65` — Behavior: Creative problem-solving with structured thinking (Opus) — p4 — unassigned
- `#50` — Define tmp file accumulation lifecycle and cleanup policy — p3 — unassigned
- `#49` — Add behavior chaining/composition pattern — p4 — unassigned

### nsheaps/ai-mktpl (20 issues)

#### P1 (Critical)

- `#166` — sync-settings.py has no file locking — can race with statusline mkdir locks — bug, p1 — unassigned — **needs-human-attention**: Race condition causing potential data loss, needs reproduction and validation

#### P2 (High)

- `#139` — feat: GitHub App token refresh plugin — p2 — unassigned
- `#127` — Enforce Skill tool usage instead of Read for loading skills — enhancement, p2 — unassigned
- `#120` — Combine StatusLine and StatusLine iTerm plugins with configurable badge setting — p2 — unassigned

#### P3 (Medium)

- `#177` — Support cross-repo plugin references — **NO PRIORITY LABEL** — unassigned
- `#167` — Plugin: Agent secrets management (1Password / vault integration) — p3 — unassigned
- `#138` — Consolidate todo plugins — merge todo-plus-plus, obsidian ramblings, TaskCreate improvements — enhancement, p3 — unassigned
- `#137` — Auth token refresh MCP server plugin — GitHub App token rotation for Claude sessions — enhancement, p3 — unassigned
- `#125` — statusline-iterm: Add automatic iTerm2 Dynamic Profile setup — enhancement, p3 — unassigned
- `#122` — use github app with user oauth in plugin session start hook — enhancement, p3 — unassigned
- `#106` — Add GitHub comment formatting skill for consistent markdown output — enhancement, p3 — unassigned
- `#105` — Add chain-of-reasoning investigation skill for post-mortem analysis — enhancement, p3 — unassigned
- `#103` — Homebrew tap distribution for plugin binaries — enhancement, p3 — unassigned
- `#100` — Plug in with hook for writing to markdown file should validate referenced local files exist — p3 — unassigned
- `#95` — feat(plugin): skill-reminder hooks — p3 — unassigned
- `#94` — Swap Claude agent to jack app creds — p3 — unassigned

#### P4 (Eventually)

- `#136` — Structured Docs as MCP Tools — dual-channel rules + resources — enhancement, p4 — unassigned
- `#135` — Shell Scripts as MCP Tools — auto-discover scripts, typed schemas — enhancement, p4 — unassigned
- `#111` — claude agents via repo dispatch should have pretooluse hook — p4 — unassigned
- `#108` — datadog-otel-setup via session start — p4 — unassigned
- `#99` — Self-terminate plugin should have a wrapper — p4 — unassigned
- `#98` — Tmux sub agent plugin wrapper around Claude one shot mode — p4 — unassigned
- `#97` — Plugin: dynamic mCP use — p4 — unassigned
- `#96` — Plugin: desktop automation — p4 — unassigned

### nsheaps/agent (9 issues)

#### P1 (Critical)

- `#9` — Add AUTOMATION_GITHUB_APP_ID and AUTOMATION_GITHUB_APP_PRIVATE_KEY secrets — bug, p1 — **assigned to @nsheaps** — **needs-human-attention**: Requires credentials
- `#7` — package.json says UNLICENSED but LICENSE file says MIT — bug, p1 — **assigned to @nsheaps** — **needs-human-attention**: Owner must decide correct license
- `#4` — Add dist/ to .gitignore — 60MB binary committed to git — bug, p1 — unassigned — **needs-human-attention**: Requires decision on git history rewrite

#### P2 (High)

- `#3` — Version detection via import.meta.dir won't work in compiled binary — bug, p2 — unassigned
- `#2` — Config composition order differs from spec — bug, p2 — unassigned

#### P3 (Medium)

- `#8` — Add unit tests for config loading and deepMerge — enhancement, p3 — unassigned
- `#6` — Document array replacement behavior in deepMerge — enhancement, p3 — unassigned
- `#5` — Support configurable claude binary name (CLAUDE_PREFERRED_BIN) — enhancement, p3 — unassigned

### nsheaps/.github (7 issues)

#### P1 (Critical)

- `#11` — Sync AUTOMATION_GITHUB_APP_ID and AUTOMATION_GITHUB_APP_PRIVATE_KEY secrets across repos using Ansible — p1 — unassigned — **needs-human-attention**: Requires Ansible setup, credential configuration, and approval

#### P2 (High)

- `#12` — Automate syncing priority labels (p1-p4) across all org repos — p3 — unassigned — **needs-human-attention**: Organization-wide policy decision
- `#10` — Add github app sync — p2 — unassigned — **needs-human-attention**: Infrastructure decision
- `#9` — Add settings sync — p2 — unassigned — **needs-human-attention**: Infrastructure decision
- `#8` — Add secret sync workflow using op exec from .ai repo — p2 — unassigned — **needs-human-attention**: Requires 1Password credentials and approval

#### P3 (Medium)

- `#5` — Add organization-wide issue and PR templates — enhancement, p3 — unassigned
- `#4` — Add reusable workflow templates for organization-wide CI — enhancement, p3 — unassigned

#### P4 (Eventually)

- `#6` — Implement workflow observability and metrics collection — enhancement, p4 — unassigned

### nsheaps/gs-stack-status (7 issues)

#### P2 (High)

- `#7` — Add missing gh and jq dependencies to Homebrew formula — enhancement, p2 — unassigned
- `#6` — Help text references gs-stack-status.sh instead of gs-stack-status — bug, p2 — unassigned
- `#5` — Remove .pnp.cjs and .pnp.loader.mjs committed despite .gitignore — bug, p2 — unassigned
- `#4` — GITHUB_JOB_URL env var may not resolve in release workflow — bug, p2 — unassigned
- `#3` — Remove false gum dependency from Homebrew formula — bug, p2 — unassigned
- `#2` — QA: repo setup and release pipeline validation — p2 — unassigned

#### No Priority Label

- `#12` — Worktree detection fails when local branch name differs from remote tracking branch — unassigned
- `#11` — Replace "(needs restack)" and "(needs push)" with status emoji — unassigned

### nsheaps/claude-team (2 issues)

#### P1 (Critical)

- `#1` — GITHUB_JOB_URL env var may not resolve in release workflow (REL-6) — bug — **assigned to @nsheaps** — Clear scope, likely delegable

#### No Priority Label

- `#7` — run-claude uses gum without install guard — unassigned

### nsheaps/claude-utils (2 issues)

#### P2 (High)

- `#4` — Document agent-team dependency and migration path — p2 — unassigned
- `#1` — Update Homebrew formula to depend on claude-team — enhancement, p2 — unassigned

### nsheaps/git-wt (4 issues)

#### No Priority Label

- `#8` — Add separate delete options: workflow+branch, workflow only, branch only — unassigned
- `#7` — Bring back gum spinner when deleting worktree — unassigned
- `#6` — Switching to other repos exits instead of returning to worktree selector — unassigned

### nsheaps/dotfiles (3 issues)

#### No Priority Label

- `#3` — make iterm profile portable to other platforms besides macos — unassigned
- `#5` — Dependency Dashboard — unassigned (skip, auto-generated)

### nsheaps/pull-from-upstream (1 issue)

- `#3` — Dependency Dashboard — unassigned (skip, auto-generated)

### nsheaps/claude-code-sessions (1 issue)

- `#3` — Dependency Dashboard — stale label — unassigned (skip, auto-generated)

### nsheaps/.ai-agent-henry (1 issue)

- `#5` — Dependency Dashboard — unassigned (skip, auto-generated)

### nsheaps/github2 (1 issue)

- `#121` — wishlist — **NO PRIORITY LABEL** — unassigned

### nsheaps/cc-investigation (1 issue)

- `#1` — Create mechanism to auto download special prompts from each new version of claude — **assigned to @nsheaps** — Delegable feature request

---

## Recommendations

### Immediate Actions (Before Next Session)

1. **Add missing priority labels** to 23 unlabeled issues — use standardized p1-p4 system
2. **Add "needs-human-attention" label** to 15 issues that require owner decision/credentials:
   - All issues requiring credentials (GitHub App secrets)
   - All decision-point issues (Homebrew publishing, license corrections, task tracking system)
   - Issues with potential data loss (sync-settings.py race condition)
3. **Consider unassigning from @nsheaps**:
   - `#1` (claude-team) — Clear bug, low complexity, safe to delegate
   - `#1` (cc-investigation) — Feature request, no blocking dependencies

### Consolidation Opportunities

1. **License issues** across agent-team, agent repos — could be handled in a single org-wide sweep
2. **GitHub App secret sync** — consolidate setup across agent-team, agent, and .github repos
3. **Release workflow issues** (GITHUB_JOB_URL) — appears in both claude-team and gs-stack-status, likely same root cause

### Issues Blocked on Owner Input

These cannot progress without @nsheaps decision:

- `agent-team/#4, #5, #8, #9` — Policy/credential/decision issues
- `agent/#7, #9` — License and credentials
- `.github/#8, #9, #10, #11, #12` — Infrastructure/org-wide decisions
