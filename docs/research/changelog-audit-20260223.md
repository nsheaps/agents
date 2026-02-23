# Changelog & ai-mktpl Audit — 2026-02-23

**Author**: Wile E. Coyote (AI Agent Eng)
**Date**: 2026-02-23
**Scope**: Claude Code v2.1.38–v2.1.50 changelog + nsheaps/ai-mktpl recent changes
**Detailed research**: `.claude/tmp/changelog-research.md`, `.claude/tmp/ai-mktpl-review.md`

---

## Executive Summary

Claude Code has shipped significant agent-related features in February 2026 that our agent definitions don't yet leverage. Meanwhile, ai-mktpl has added rules and plugins that agent-team should adopt to avoid duplication and stay in sync.

**Critical findings**: 3 new agent frontmatter fields, 2 missing rules from ai-mktpl, 2 relevant new plugins, and several bug fixes that explain past issues.

---

## Part 1: Claude Code Changelog (v2.1.38–v2.1.50)

### New Agent Frontmatter Fields

Our agent definitions in `.claude/agents/*.md` can now use three new YAML frontmatter fields:

| Field        | Values                       | Purpose                                    | Relevant Agents                                                   |
| :----------- | :--------------------------- | :----------------------------------------- | :---------------------------------------------------------------- |
| `memory`     | `user` / `project` / `local` | Persistent knowledge store across sessions | ai-agent-eng (failure patterns), all agents (learned conventions) |
| `background` | `true`                       | Always run as background task              | —                                                                 |
| `isolation`  | `worktree`                   | Run in isolated git worktree               | software-eng, qa (prevent file conflicts)                         |

**`memory` is the biggest opportunity.** The ai-agent-eng failure log currently lives in `.claude/tmp/` and is lost between sessions. With `memory: project`, failure patterns would persist in `.claude/agent-memory/ai-agent-eng/MEMORY.md` and survive session boundaries.

### Bug Fixes That Explain Past Issues

| Version | Fix                                                                      | Impact on Us                                       |
| :------ | :----------------------------------------------------------------------- | :------------------------------------------------- |
| v2.1.50 | Memory leak — completed teammate tasks never garbage collected           | Explains degradation in long sessions              |
| v2.1.47 | Custom agent `model` field was silently ignored for teammates            | If we'd set custom models, they weren't being used |
| v2.1.47 | Plan mode lost after context compaction                                  | Explains plan mode weirdness after compaction      |
| v2.1.45 | Agent teams failing on Bedrock/Vertex/Foundry (env vars not propagating) | N/A unless we use non-Anthropic providers          |

### New Hook Events

| Hook                                | When                            | Use Case                                               |
| :---------------------------------- | :------------------------------ | :----------------------------------------------------- |
| `TeammateIdle` (exit code 2)        | Teammate about to go idle       | Quality gate: keep teammate working until criteria met |
| `TaskCompleted` (exit code 2)       | Task being marked complete      | Quality gate: prevent premature "done"                 |
| `WorktreeCreate` / `WorktreeRemove` | Worktree lifecycle              | Custom setup/teardown for isolated agents              |
| `ConfigChange`                      | Config files change mid-session | Security auditing                                      |
| `SubagentStop`                      | Subagent completes              | Now includes `last_assistant_message` in input         |

### New CLI

- `claude agents` — lists all configured agents without starting a session (useful for validation scripts)
- `claude --worktree` / `-w` — start in isolated git worktree

### Complete Frontmatter Schema (Current)

```yaml
---
name: my-agent
description: When to use this agent
model: sonnet # sonnet | opus | haiku | inherit
background: true # always run as background task
isolation: worktree # run in isolated git worktree
memory: project # user | project | local
tools: Read, Bash, Task(worker)
disallowedTools: Write
permissionMode: default
maxTurns: 50
skills:
  - my-skill
mcpServers:
  - server-name
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./validate.sh"
---
```

---

## Part 2: ai-mktpl Changes

### Rules NOT Yet Adopted by agent-team

| Rule                             | Added                    | Severity   | Description                                                                                                                                                                                   |
| :------------------------------- | :----------------------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file-placement.md`              | 2026-02-19 (`bb873763`)  | **High**   | Defines permanent vs tmp file placement. Conflicts with our CLAUDE.md guidance that says "use `.claude/tmp/` for working files." Research and reports should go to `docs/research/`, not tmp. |
| `relay-integrity.md`             | ~2026-02-12 (`0a2cf097`) | **Medium** | Prevents relay amplification by orchestrators. Our orchestrator is the primary relay point and should have this rule.                                                                         |
| `artifact-linking-in-reports.md` | 2026-02-17 (`5cd0f0a1`)  | **Low**    | Already in `~/.claude/rules/` (global), but not in `.claude/rules/` (project). May not reach teammates if they only load project rules.                                                       |

### Rules Already Synced

- `teammate-abstraction.md` — identical in both repos
- `research-before-broadcasting.md` — identical in both repos

### New Plugins Relevant to agent-team

| Plugin                     | Relevance  | Description                                                                                                                                                                                              |
| :------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context-bloat-prevention` | **High**   | Detects >10kB outputs, saves to file, warns agent. Agent teams specifically cited as "particularly severe" for bloat. References issue [#20470](https://github.com/anthropics/claude-code/issues/20470). |
| `agent-tab-titles`         | **Medium** | Sets tmux/iTerm2 tab titles to agent role names. Developed from Road Runner's research in `.claude/tmp/iterm-tmux-tab-naming-research.md`.                                                               |
| `fix-pr`                   | **Low**    | `/relentlessly-fix` command for iterative PR fix cycles. Useful for ops-eng/software-eng.                                                                                                                |

### Updated agent-teams-skills Skill

Two important additions (commit `2400f511`, 2026-02-18):

1. **ESC key recovery**: `tmux send-keys -t <pane-id> Escape` — interrupts stuck teammates
2. **Background sub-agent requirement**: Best practice #8 now states orchestrators MUST use `run_in_background: true` on every Task tool call

### Agent Representation Spec

New spec at `ai-mktpl/docs/specs/draft/agent-representation.md` (commit `bb873763`) defines per-agent plugin profiles. Phase 1 recommendation: Add "Available/Unavailable Skills" sections to each agent file in `.claude/agents/`.

---

## Part 3: Recommended Actions

### Priority 1 — Should Do Now

| #   | Action                                                                                            | Why                                                                |
| :-- | :------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------- |
| 1   | Add `memory: project` to ai-agent-eng agent frontmatter                                           | Persistent failure patterns across sessions                        |
| 2   | Add `file-placement.md` rule to `.claude/rules/`                                                  | Prevents research from being lost in tmp                           |
| 3   | Update CLAUDE.md to distinguish "team working files" (tmp ok) from "research/reports" (permanent) | Resolves conflict between current guidance and file-placement rule |
| 4   | Add `relay-integrity.md` rule to `.claude/rules/`                                                 | Prevents orchestrator relay amplification                          |

### Priority 2 — Should Do Soon

| #   | Action                                                                  | Why                                               |
| :-- | :---------------------------------------------------------------------- | :------------------------------------------------ |
| 5   | Install `context-bloat-prevention` plugin                               | Agent teams are high-risk for context bloat       |
| 6   | Install `agent-tab-titles` plugin                                       | UX improvement for tmux teammate identification   |
| 7   | Add `isolation: worktree` to software-eng agent frontmatter             | Prevents file conflicts between agents            |
| 8   | Evaluate `memory` field for other agents (docs-writer, deep-researcher) | Could persist learned conventions                 |
| 9   | Add ESC key recovery tip to team docs                                   | Currently only in ai-mktpl skill, not in our docs |

### Priority 3 — Track for Later

| #   | Action                                                                                  | Why                                        |
| :-- | :-------------------------------------------------------------------------------------- | :----------------------------------------- |
| 10  | Implement Phase 1 of agent-representation spec (Available/Unavailable Skills per agent) | Per-agent plugin control                   |
| 11  | Evaluate `TeammateIdle` / `TaskCompleted` hooks for quality gates                       | Automated enforcement of "done means done" |
| 12  | Consider `background: true` for specific agent roles                                    | Some agents should always run non-blocking |

---

## Potential Conflict: `.claude/tmp/` Guidance

**Current**: CLAUDE.md says "Use `.claude/tmp/` for working files shared between teammates"
**New rule** (`file-placement.md`): Research and completed work should NOT go in tmp

**Resolution**: Update CLAUDE.md to say:

- `.claude/tmp/` — for intermediate/ephemeral working files, session logs, debug artifacts
- `docs/research/` — for completed research and findings
- `.claude/plans/` — for implementation plans
- `docs/specs/` — for specifications

This aligns both guidelines without contradiction.

---

## Sources

- [Claude Code Changelog](https://code.claude.com/docs/en/changelog) — v2.1.38–v2.1.50
- [Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [Sub-agents Documentation](https://code.claude.com/docs/en/sub-agents)
- [GitHub Releases: anthropics/claude-code](https://github.com/anthropics/claude-code/releases)
- [claudelog.com](https://claudelog.com/claude-code-changelog/)
- [gradually.ai Changelog](https://www.gradually.ai/en/changelogs/claude-code/)
- ai-mktpl git log: commits `5b17f990` through `92579de4` (2026-02-18 to 2026-02-23)
- ai-mktpl files: `.ai/rules/`, `.ai/plugins/`, `docs/specs/draft/`, `docs/scratch/`
