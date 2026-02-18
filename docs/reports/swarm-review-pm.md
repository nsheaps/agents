# Swarm Review: PM Perspective — nsheaps/agent-team

**Reviewer**: Elmer Fudd (Project Manager)
**Date**: 2026-02-18
**Scope**: Open issues coverage, task tracking gaps, prioritization

---

## 1. GitHub Issues Coverage

### Current State

Only **2 issues exist** on nsheaps/agent-team (1 open, 1 closed):

| # | Title | State |
|---|-------|-------|
| 3 | Research GitHub auth abstraction for agent teams | OPEN |
| 2 | Write specs for docs MCP server and scripts MCP server | CLOSED |

### Gap: File-Based Tickets Not Mirrored to GitHub Issues

There are **22 file-based tickets** in `docs/tickets/`, of which **14 are still open**:

**Open feature tickets (8):**
- PHASE1-001: System prompt research
- PHASE1-003: Agent file discovery
- PHASE1-004: Prompt assembly
- PHASE1-005: Agent spawning
- PHASE1-006: Agent kill/cleanup
- PHASE1-007: Health check auto-cleanup
- PHASE1-008: Agent list/relaunch
- PHASE1-009: Update agent frontmatter
- PHASE1-010: QA full lifecycle
- PHASE1-011: Review launcher vs claude-team
- PHASE1-012: Customizable team name

**Open defect tickets (5, held for Phase 2):**
- DEF-08: launch doesn't spawn (MEDIUM)
- DEF-09: Relaunch stale discovery (LOW)
- DEF-11: Path traversal (LOW)
- DEF-12: Silent validation failures (LOW)
- DEF-13: Shell escaping (LOW)

**None of these have corresponding GitHub Issues.** Per the new directive that GitHub Issues is our ticketing system, these should be migrated or explicitly deprioritized.

### Recommendation

Given that agent-team is a **POC/sandbox** (per README), I recommend:
1. **Do NOT bulk-create 14 GitHub Issues** for stale POC tickets — it creates noise
2. **Create issues only for items that will be actively worked** in the near term
3. **Close/archive the file-based tickets** with a note that agent-team is paused as POC
4. Keep the MCP server specs and auth research as the only active issues (already done)

---

## 2. Prioritization Assessment

### Repo Status: Paused POC

The README correctly states this is a POC/sandbox. The real work is happening in:
- **claude-team** (shell-based orchestration, actively developed)
- **agent** (Bun CLI wrapper, MVP shipped)

agent-team serves as:
- A research repository (37 research docs!)
- A spec incubator (11 draft specs)
- A POC for TypeScript/Bun lifecycle management (54 passing tests)

### Priority Stack (for this repo specifically)

| Priority | Item | Rationale |
|----------|------|-----------|
| P1 | Keep as research/spec repository | Most valuable current use |
| P2 | GitHub auth spec (issue #3) | Active research by Road Runner |
| P3 | MCP server specs (in ai-mktpl#135, #136) | Specs live here, issues tracked on ai-mktpl |
| P4 | POC source code maintenance | Low — paused, 54 tests pass, no active dev |
| P5 | Open defect tickets | Very low — POC code, not shipping |

---

## 3. Task Tracking Gaps

### Gap 1: Dual Tracking Systems

Work is tracked in **three places** with no single source of truth:
1. **GitHub Issues** (new, sparse — 2 total)
2. **File-based tickets** in `docs/tickets/` (22 tickets, stale)
3. **Session TaskList** (ephemeral, dies with session)

This creates confusion about what's actually open vs done vs abandoned.

**Recommendation**: Establish that GitHub Issues is authoritative. File-based tickets should be:
- Migrated to GitHub Issues (for active items)
- Archived in place with `status: archived` (for paused/abandoned items)
- `docs/tickets/README.md` updated to note the migration

### Gap 2: scratch.md Is a Junk Drawer

`docs/scratch.md` (100 lines) contains a mix of:
- Feature ideas (agent dashboard, monetization, meetings)
- Architecture decisions (persistent task tracking, project isolation)
- Research topics (already duplicated in `docs/to-research.md`)
- Operational learnings (context bloat, launch requirements)

Much of this is valuable but **unstructured and untracked**. Important items buried in scratch.md risk being forgotten.

**Recommendation**: Triage scratch.md into:
- GitHub Issues (for actionable items)
- Specs (for design-worthy ideas)
- Archive (for superseded items)

### Gap 3: research-topics.md Also Untracked

`docs/to-research.md` (35 lines) and `docs/research-topics.md` list research questions with no corresponding issues or assignments. Some have been answered (by Road Runner's 37 research docs) but the lists haven't been updated.

**Recommendation**: Cross-reference research docs against to-research items, mark completed ones, create GitHub Issues for remaining active research needs.

---

## 4. Cross-Repo Tracking

### Related Issues on Other Repos

| Repo | Issue | Relates to agent-team |
|------|-------|-----------------------|
| ai-mktpl#135 | Shell Scripts MCP Server | Spec in agent-team/docs/specs/draft/ |
| ai-mktpl#136 | Structured Docs MCP Server | Spec in agent-team/docs/specs/draft/ |
| agent-team#3 | GitHub Auth Abstraction | Active research |

### Missing Cross-References

The 11 draft specs in `docs/specs/draft/` have no corresponding GitHub Issues anywhere:
- agent-abstraction-levels.md
- agent-communication-protocol.md
- agent-launcher.md
- agent-team-architecture.md
- cchistory-prompt-flavors.md
- e2e-testing.md
- marketplace-structure.md
- mesh-mcp-server.md
- multi-repo-phase-plan.md
- persona-system.md
- web-session-orchestration.md

Some of these may be superseded or informational. A triage pass is needed.

---

## 5. Key Findings Summary

| # | Finding | Severity | Recommendation |
|---|---------|----------|---------------|
| PM-1 | 14 open file tickets with no GitHub Issues | MEDIUM | Triage: migrate active, archive stale |
| PM-2 | Dual tracking (files + issues + session tasks) | MEDIUM | Establish GitHub Issues as single source of truth |
| PM-3 | scratch.md is unstructured backlog | LOW | Triage into issues, specs, or archive |
| PM-4 | 11 draft specs with no tracking | LOW | Triage: which are active, which are informational |
| PM-5 | research-topics.md stale | LOW | Cross-reference against completed research |
| PM-6 | No release tracking needed (POC) | INFO | Correct — no shipping code |

**Overall assessment**: agent-team's biggest value is as a research and spec repository. The tracking gaps are understandable for a paused POC, but if/when development resumes, the file-based tickets need migration to GitHub Issues to avoid confusion.
