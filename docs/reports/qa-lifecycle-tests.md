# QA Report: Lifecycle Fixes & Unit Tests — Daffy D (qa)

**Date**: 2026-02-17
**Reviewer**: Daffy Duck (Quality Assurance)
**Scope**: Commits f8ff932, f2fe867, 9a7354b — unit tests + lifecycle fixes (DEF-5/6/7/10)
**Test run**: 54 pass, 0 fail, 187 expect() calls across 4 files [161ms]

---

## 1. Test Suite Execution

**Result: ALL 54 TESTS PASS**

| File                | Tests | Status |
| ------------------- | ----- | ------ |
| `discover.test.ts`  | 11    | PASS   |
| `prompt.test.ts`    | 6     | PASS   |
| `spawn.test.ts`     | 13    | PASS   |
| `lifecycle.test.ts` | 14    | PASS   |

---

## 2. DEF-5 Review: `cleanupStaleEntries` (was no-op)

**Fix commit**: f2fe867
**Implementation**: `lifecycle.ts:192-224`

**Verdict: PASS — properly implemented**

The function now:

- Iterates over members, checking `isTmuxPaneAlive(member.tmuxPaneId)` for those with pane IDs
- Members with dead panes get removed from config
- Members without pane IDs are skipped (left untouched)
- Config is written back to disk only when changes occur (line 211-213)
- Returns descriptive message including count removed and count skipped

**Test coverage**: 3 tests

- Skips members without pane IDs ✓
- Removes members with dead pane IDs and writes config ✓ (verified with `readTeamConfig` after cleanup)
- Handles missing config gracefully ✓

**Observation**: The test at line 293-311 verifies the config is actually written back with the dead member removed — this is the key assertion that was missing before (old function never wrote anything). Solid.

---

## 3. DEF-6 Review: Health check always UNKNOWN

**Fix commit**: f2fe867
**Implementation**: `lifecycle.ts:265-272` (inside `listAgents`)

**Verdict: PASS — health status now uses tmux pane liveness**

The `listAgents` function now checks:

- If member has `tmuxPaneId` → calls `isTmuxPaneAlive()` → returns `RUNNING` or `DEAD`
- If member has no `tmuxPaneId` → returns `UNKNOWN`
- If no config entry → returns `NOT_SPAWNED`

**Test coverage**: Test at lifecycle.test.ts:264-277 — verifies `DEAD` status for a fake pane ID `%9999`.

**Note**: No test for `RUNNING` status — would require a real tmux pane to be alive during testing. This is acceptable since the code path is symmetric (same `isTmuxPaneAlive` call, just different return branch), but worth noting.

---

## 4. DEF-7 Review: `listAgents` name mismatch

**Fix commit**: 9a7354b
**Implementation**: `lifecycle.ts:235-307`

**Verdict: PASS — correlation now uses `agentName` field**

The function now:

1. Builds `agentNameToMember` map from config members that have `agentName` set
2. Falls back to `displayNameToMember` for direct name match
3. Tracks matched config members to avoid duplicates
4. Unmatched config members appear separately as config-only entries
5. Returns `configName` field when the display name differs from the agent name

**Test coverage**: 4 tests

- Correlates via `agentName` field ✓ (software-eng → Bugs B (software-eng))
- Falls back to direct name match without `agentName` ✓
- Handles no config gracefully ✓
- Shows DEAD status for dead panes ✓

**Quality note**: The `configName` return field (line 283) is a nice touch — it lets the CLI show both the file name and the display name.

---

## 5. DEF-10 Review: `killAgent` doesn't kill tmux pane

**Fix commit**: f2fe867
**Implementation**: `lifecycle.ts:160-183`

**Verdict: PASS — tmux pane kill now wired in**

The function now:

1. Looks up the member in config
2. If `member.tmuxPaneId` exists, calls `killTmuxPane(member.tmuxPaneId)`
3. Removes member from config regardless of pane kill success
4. Reports pane kill result in message (killed, failed, or no pane ID)

**Test coverage**: 4 tests

- No pane ID → removes from config, reports "no tmux pane ID tracked" ✓
- With pane ID → attempts kill, reports result ✓ (fake pane %999 → "tmux pane kill failed")
- Missing config → fails gracefully ✓
- Missing agent → fails gracefully ✓

---

## 6. TeamMember Type Changes

**File**: `types.ts` — no changes (TeamMember is in lifecycle.ts)
**File**: `lifecycle.ts:10-18`

```typescript
export interface TeamMember {
  name: string;
  agentId: string;
  agentType: string;
  tmuxPaneId?: string; // NEW — optional
  agentName?: string; // NEW — optional
}
```

**Verdict: CORRECT**

Both new fields are properly optional (`?`). They have JSDoc comments explaining purpose and when they're set. The optionality is important because:

- Existing team configs won't have these fields → backward compatible
- Claude Code manages the config schema → we extend, not replace

---

## 7. Test Quality Assessment

### Strengths

- **Good fixture strategy**: 10 fixture files cover valid, minimal, missing fields, bad enums, no frontmatter, duplicates
- **Proper isolation**: lifecycle tests use temp HOME directory to avoid touching real config
- **Cleanup**: `afterEach(teardownTmpHome)` prevents test pollution
- **Real-world test**: discover.test.ts:208-221 tests against the actual project's `.claude/agents/` directory
- **Edge cases covered**: Missing config, missing members, invalid JSON, empty directories

### Gaps (not blockers, but worth tracking)

**GAP-1 [LOW]**: No test for `RUNNING` status in `listAgents`. Would require a real tmux pane. Could be addressed with a mock/spy in future.

**GAP-2 [LOW]**: No test for `isTmuxPaneAlive` or `killTmuxPane` directly. These are thin wrappers around `Bun.spawnSync` and are implicitly tested via the lifecycle tests, but a direct unit test with a mock would be cleaner.

**GAP-3 [LOW]**: No CLI integration tests for `bin/agent-launch.ts`. The arg parsing and subcommand routing are tested indirectly by the module tests, but exercising the actual CLI binary would catch integration issues.

**GAP-4 [LOW]**: `cleanupStaleEntries` test doesn't verify that members WITHOUT pane IDs are preserved in the config after cleanup (it checks removed count = 0 and message, but doesn't read back the config to confirm no data loss).

---

## 8. Summary

| Defect                 | Fix Status       | Test Coverage | Verdict  |
| ---------------------- | ---------------- | ------------- | -------- |
| DEF-5 (cleanup no-op)  | Fixed in f2fe867 | 3 tests       | **PASS** |
| DEF-6 (health UNKNOWN) | Fixed in f2fe867 | 1 test        | **PASS** |
| DEF-7 (name mismatch)  | Fixed in 9a7354b | 4 tests       | **PASS** |
| DEF-10 (kill no pane)  | Fixed in f2fe867 | 4 tests       | **PASS** |

**All 4 defects verified fixed with adequate test coverage.** 54 tests passing, 0 failures. No regressions.

4 low-severity test coverage gaps identified for future improvement — none block Phase 1 exit.
