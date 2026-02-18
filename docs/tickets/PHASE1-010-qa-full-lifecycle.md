---
id: PHASE1-010
title: "QA: test full agent lifecycle (launch, kill, relaunch)"
status: open
assignee: Daffy Duck (Quality Assurance)
priority: high
phase: 1
blocked_by: [PHASE1-005, PHASE1-006, PHASE1-007, PHASE1-008]
blocks: []
created: 2026-02-17
updated: 2026-02-17
task_id: "116"
---

# PHASE1-010: QA — test full agent lifecycle

End-to-end QA testing of the complete agent lifecycle. This is the Phase 1 exit gate — all lifecycle operations must work reliably before moving to Phase 2.

## Scope

1. Test agent launch from `.claude/agents/*.md` file definitions
2. Test agent kill with clean config cleanup
3. Test agent relaunch without stale entries or `-2` suffixes
4. Test health check detection of dead agents
5. Test auto-cleanup of orphaned config entries
6. Test agent list command accuracy
7. Test edge cases: concurrent launches, rapid kill-relaunch, missing agent files

## Acceptance Criteria

- [ ] Launch: agent spawns in tmux with correct prompt and permissions
- [ ] Kill: agent terminated, config entry removed cleanly
- [ ] Relaunch: same agent name works immediately after kill (no `-2` suffix)
- [ ] Health check: correctly reports running vs dead agents
- [ ] Auto-cleanup: removes stale entries on demand
- [ ] List: accurate status for all agents (running, dead, not-spawned)
- [ ] Edge cases: no crashes or data corruption under stress
- [ ] Test report saved to `.claude/tmp/qa-lifecycle-report.md`

## References

- All PHASE1 implementation tickets (PHASE1-003 through PHASE1-008)
- Architecture MVP priority: `docs/specs/draft/agent-team-architecture.md`
- Stale entry problem: `.claude/behaviors/team-member-cleanup.md`
