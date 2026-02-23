# Quality Gate Hooks Assessment for Agent Teams

**Author**: Wile E. Coyote (AI Agent Eng)
**Date**: 2026-02-23
**Scope**: How TeammateIdle and TaskCompleted hooks can enforce quality in our agent team workflow
**Prerequisite reading**: `docs/research/new-claude-code-hooks.md` (Road Runner's technical research)

---

## Executive Summary

TeammateIdle and TaskCompleted hooks are production-ready quality gate mechanisms. Road Runner's research confirms both work reliably with command-based hooks and exit code 2. This assessment maps them to our specific failure patterns and recommends concrete quality gates based on observed team issues.

---

## Part 1: Failure Patterns That Quality Gates Would Catch

From the failure log (`.claude/tmp/ai-agent-eng-failure-log.md`), these recurring patterns are candidates for automated enforcement:

| Failure Pattern                                                 | Occurrences         | Hook Target                    | Gate Type            |
| :-------------------------------------------------------------- | :------------------ | :----------------------------- | :------------------- |
| Declaring "done" with uncommitted changes                       | Multiple            | TaskCompleted                  | Block completion     |
| Declaring "done" without pushing                                | Multiple            | TaskCompleted                  | Block completion     |
| Going idle without status update                                | #11+ (this session) | TeammateIdle                   | Require message      |
| Saving research to `.claude/tmp/` instead of permanent location | #17                 | TaskCompleted                  | Check file paths     |
| Using bare `#123` refs instead of full URLs                     | Standing order      | TaskCompleted                  | Check message format |
| Invalid frontmatter values (e.g., `delegate` permission mode)   | #18                 | Session start (not hook-based) | Startup validation   |

### Top 3 Candidates for Automation

**1. Uncommitted/Unpushed Work Gate (TaskCompleted)**

- Pattern: Teammate marks task complete but has uncommitted or unpushed changes
- Reference implementation: `todo-plus-plus` plugin's `check-uncommitted.sh`
- Confidence: High — proven pattern, ready to use

**2. Status Update Before Idle Gate (TeammateIdle)**

- Pattern: Teammate goes idle without sending a status message to the lead
- Implementation: Check if the teammate's last action was a SendMessage
- Confidence: Medium — requires parsing transcript JSONL to verify last action

**3. File Placement Gate (TaskCompleted)**

- Pattern: Completed research saved to `.claude/tmp/` instead of `docs/research/`
- Implementation: Check if task description mentions "research" and any new files were created in `.claude/tmp/`
- Confidence: Medium — heuristic-based, may have false positives

---

## Part 2: Recommended Quality Gates

### Gate 1: "Done Means Done" (TaskCompleted)

**What it checks**:

1. No uncommitted changes in the working directory
2. No unpushed commits on the current branch
3. If the task involves code changes, tests must pass

**Implementation approach**: Fork the `todo-plus-plus` plugin's `check-uncommitted.sh` as a starting point. Add test execution for code-related tasks.

**Risk**: False positives on tasks that don't involve code changes (e.g., research, documentation review). Mitigate by checking if the working directory is dirty rather than requiring a specific git state.

**Exit behavior**:

- Exit 0: Task completes normally
- Exit 2 + stderr feedback: "You have N uncommitted changes. Commit and push before marking complete."

### Gate 2: Idle Quality Check (TeammateIdle)

**What it checks**:

1. No build errors or lint failures in the working directory
2. (Optional) Teammate sent at least one message since last becoming active

**Implementation approach**: Run a lightweight check (e.g., `just check` or project-specific validation). Keep timeout short (< 30 seconds) — this fires on every idle transition and shouldn't slow teammates down.

**Risk**: Expensive if the check is slow. Heavy test suites should NOT run on every idle transition — save those for TaskCompleted.

**Exit behavior**:

- Exit 0: Teammate goes idle normally
- Exit 2 + stderr feedback: "Build errors detected. Fix before resting: [error summary]"

### Gate 3: File Placement Audit (TaskCompleted)

**What it checks**:

1. If the task mentions "research" or "report," verify no new files were created in `.claude/tmp/`
2. If new files were created in `.claude/tmp/`, warn that they may belong in a permanent location

**Implementation approach**: Parse `git status --porcelain` for new files in `.claude/tmp/`. Cross-reference with the task description keywords.

**Risk**: High false positive rate. Many legitimate files go in `.claude/tmp/` (failure logs, session artifacts). This should be advisory (warning in stderr) rather than blocking (exit 0, not exit 2) initially.

**Exit behavior**:

- Exit 0 always (advisory only, at least initially)
- Stderr warning: "Note: You created files in .claude/tmp/. If these are research or reports, consider moving to docs/research/."

---

## Part 3: Implementation Recommendations

### Packaging

Package as an `ai-mktpl` plugin: `agent-team-quality-gates`

```
plugins/agent-team-quality-gates/
├── hooks/
│   └── hooks.json          # Hook configuration
├── scripts/
│   ├── task-completed.sh   # Gate 1 + Gate 3
│   └── teammate-idle.sh    # Gate 2
├── plugin.json
└── README.md
```

This follows the `todo-plus-plus` pattern and makes the gates reusable across projects.

### Phased Rollout

| Phase | Gate                                | Mode                        | Timeframe              |
| :---- | :---------------------------------- | :-------------------------- | :--------------------- |
| 1     | TaskCompleted: uncommitted/unpushed | Blocking (exit 2)           | Implement now          |
| 2     | TeammateIdle: build check           | Blocking (exit 2)           | Implement soon         |
| 3     | TaskCompleted: file placement       | Advisory (exit 0 + warning) | Evaluate after Phase 1 |
| 4     | TaskCompleted: test execution       | Blocking (exit 2)           | After CI integration   |

### What NOT to Automate

Based on Road Runner's findings:

- **PreToolUse hooks for quality gates**: Unreliable — ~60% failure rate with Opus 4.6 ([#24327](https://github.com/anthropics/claude-code/issues/24327))
- **PreToolUse on Task tool**: Does not block at all ([#26923](https://github.com/anthropics/claude-code/issues/26923))
- **Prompt-based SubagentStop hooks**: Feedback sent but subagent terminates anyway ([#20221](https://github.com/anthropics/claude-code/issues/20221))
- **Heavy validation on TeammateIdle**: Keep this lightweight — it fires frequently

### Integration with Existing Rules

The quality gates reinforce these existing rules:

- `never-say-done-prematurely.md` — TaskCompleted gate enforces the validation chain
- `file-placement.md` — File placement gate catches misplaced research
- `no-unauthorized-shutdown.md` — TeammateIdle gate could validate shutdown reasons (future)

---

## Part 4: Open Questions

1. **Should TeammateIdle gate differentiate by agent role?** Research agents may not have build artifacts to check. The gate script would need access to the teammate's role from the hook input (`teammate_name`).

2. **How to handle worktree-isolated agents?** If an agent runs in `isolation: worktree`, the git checks need to target that worktree, not the main working directory. The `cwd` field in the hook input should handle this.

3. **Cost of running checks on every idle transition?** If a teammate goes idle 20 times in a session and each check takes 10 seconds, that's 200 seconds of overhead. Need to benchmark.

4. **Should we block completion for research tasks that don't involve git changes?** A research task might produce only a report file. The "uncommitted changes" check would pass (nothing to commit if the file is already committed), but we might want to verify the report was actually written.

---

## Sources

- Road Runner's hooks research: `docs/research/new-claude-code-hooks.md`
- Wile E.'s changelog audit: `docs/research/changelog-audit-20260223.md`
- Failure log: `.claude/tmp/ai-agent-eng-failure-log.md` (Failures #11-#19)
- `todo-plus-plus` plugin: `ai-mktpl/plugins/todo-plus-plus/`
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [#24327: PreToolUse exit code 2 unreliable](https://github.com/anthropics/claude-code/issues/24327)
- [#26923: PreToolUse does not block Task tool](https://github.com/anthropics/claude-code/issues/26923)
- [#20221: Prompt-based SubagentStop ineffective](https://github.com/anthropics/claude-code/issues/20221)
