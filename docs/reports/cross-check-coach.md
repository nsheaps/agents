# GitHub Issues Cross-Check — AI Agent Eng (Wile E. Coyote)

Date: 2026-02-18 | Session: 3

## Methodology

Exported all issues from agent-team (63 issues), claude-utils (5 issues), and ai-mktpl (92+ issues). Spot-checked closed issues for evidence quality. Checked for duplicates, wrong-repo placement, and gaps.

## Findings

### 1. DUPLICATE: agent-team #42 and #44

- **#42**: "Separate agent-team interop rules from general Claude rules" (CLOSED, created by PM)
- **#44**: "Copy agent-interop rules to agent-team .claude/rules/" (CLOSED, created by me)

Both reference session task #166 and describe the same work. #44 has commit hashes (1751fcd, 5585d12). #42 does not.

**Recommendation**: Close #42 as duplicate of #44 with a comment linking to it.

### 2. MISSING EVIDENCE on closed issues

Several closed issues lack commit hashes or artifact paths:

| Issue | Title                             | Evidence?                                          |
| :---- | :-------------------------------- | :------------------------------------------------- |
| #42   | Separate agent-team interop rules | NO — just "Resolved in session"                    |
| #39   | Build tab naming plugin           | NO — "Plugin implemented and working"              |
| #35   | PM session coordination           | Likely NO (process work, but should cite artifact) |

**Good examples** (for comparison):
| Issue | Title | Evidence? |
|:------|:------|:----------|
| #55 | killAgent tmux pane fix | YES — commits f2fe867, 9a7354b |
| #54 | Software eng SWARM review | YES — artifact path + related issues |
| #48 | Fix swarm review findings | YES — 5 commit hashes |

**Recommendation**: The new `verify-completion-evidence` behavior (commit `1864ecf`) should prevent this going forward. Consider retroactively adding evidence to #39.

### 3. COVERAGE ASSESSMENT

All major work streams have issues:

| Role         | Issues Created                                                 | Quality                         |
| :----------- | :------------------------------------------------------------- | :------------------------------ |
| Coach (me)   | #44, #46, #48, #49, #50, #63 + claude-utils #4 + ai-mktpl #160 | Good — all have evidence        |
| Researcher   | #26-29, #31, #33 (all CLOSED)                                  | Good — research artifacts cited |
| Docs Writer  | #30 (CLOSED)                                                   | Good                            |
| QA           | #32, #37, #43 (CLOSED) + #34, #36 (OPEN)                       | Good — defects properly tracked |
| PM           | #35, #40, #45, #51, #52 (CLOSED)                               | Mixed — some lack evidence      |
| Ops          | #38, #41 (CLOSED) + #47 (OPEN)                                 | Good                            |
| Software Eng | #53, #55 (CLOSED) + #54, #56, #57, #59 (MIXED)                 | Good — code commits cited       |

### 4. NO WRONG-REPO PLACEMENT DETECTED

All issues appear to be on the correct repository.

### 5. NO MISSING WORK ITEMS DETECTED

All session work streams appear to be tracked. The behavioral corrections are on ai-mktpl (#159, #160). Release pipeline work is on both claude-utils (#3, #5) and agent-team (#38). Cross-repo dependency is on claude-utils (#4).

## Summary

- **1 duplicate** to resolve (#42 → #44)
- **2-3 closed issues** missing commit evidence (pre-dates the new behavior)
- **Overall coverage**: Good — all work streams tracked across repos
- **No wrong-repo issues** found
