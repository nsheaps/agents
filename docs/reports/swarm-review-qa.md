# Swarm Review: QA Perspective — agent-team main

**Reviewer**: Daffy Duck (Quality Assurance)
**Date**: 2026-02-18
**Repo**: `/Users/nathan.heaps/src/nsheaps/agent-team` (GitHub: `nsheaps/agent-team`)
**Branch**: `main`

## Scope

QA review covering: test coverage, defects, spec compliance, edge cases.

## Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `src/types.ts` | 90 | Type definitions |
| `src/discover.ts` | 210 | Agent file discovery + YAML parsing |
| `src/prompt.ts` | 89 | Prompt assembly (extend/replace modes) |
| `src/spawn.ts` | 109 | CLI arg building + agent spawning |
| `src/lifecycle.ts` | 308 | Kill, health, cleanup, list |
| `bin/agent-launch.ts` | 300 | CLI entry point |
| `src/__tests__/discover.test.ts` | 222 | 11 tests |
| `src/__tests__/prompt.test.ts` | 115 | 6 tests |
| `src/__tests__/spawn.test.ts` | 174 | 14 tests |
| `src/__tests__/lifecycle.test.ts` | 322 | 23 tests |
| `docs/specs/draft/agent-launcher.md` | 746 | Spec |
| `package.json` | 21 | Metadata |
| `mise.toml` | 19 | Task runner |
| `.github/workflows/test.yaml` | 37 | CI |
| `README.md` | 37 | Docs |

**Total source**: ~1106 lines across 6 source files. 54 tests across 4 test files, all passing (187 expect() calls).

---

## Test Coverage Assessment

### What IS Tested (Good)

| Module | Tests | Coverage |
|--------|-------|----------|
| `discover.ts` | 11 | Excellent — valid agents, missing fields, bad enums, no frontmatter, duplicates, defaults, all options, real project |
| `prompt.ts` | 6 | Good — extend/replace × builtin/custom, missing base file, 200KB warning |
| `spawn.ts` | 14 | Excellent — every flag combination, env vars, comprehensive all-options |
| `lifecycle.ts` | 23 | Good — read/write config, find/remove member, kill (with/without pane), list correlation, cleanup stale entries |

### What IS NOT Tested (Gaps)

| Gap | Severity | Description |
|-----|----------|-------------|
| **QA-1** | **HIGH** | `bin/agent-launch.ts` has ZERO test coverage — all 300 lines of CLI arg parsing, subcommand routing, and output formatting are untested |
| **QA-2** | **MEDIUM** | No integration tests — all tests are unit tests with mocked fs. No test spawns `agent-launch` as a subprocess to verify CLI behavior end-to-end |
| **QA-3** | **MEDIUM** | `spawnAgent()` function (spawn.ts:94-108) is untested — only `buildSpawnArgs()` is tested. The actual `Bun.spawn` call is never exercised |
| **QA-4** | **MEDIUM** | `health` subcommand (agent-launch.ts:88-118) always shows UNKNOWN status — it never calls `isTmuxPaneAlive()` despite lifecycle.ts having the function. The comment says "Future: cross-reference with tmux list-panes" but the function already exists |
| **QA-5** | LOW | No test for temp directory cleanup — tests create tmpdir fixtures but never clean them up (relies on OS temp cleanup) |
| **QA-6** | LOW | `resolveProjectRoot()` not tested for non-git directory (only tests override and git-root paths) |

---

## Defects Found

### QA-7: `health` subcommand ignores existing isTmuxPaneAlive (MEDIUM)

**File**: `bin/agent-launch.ts:103-112`

The health subcommand hardcodes "UNKNOWN" for every member:

```typescript
const row = [
  member.name.padEnd(COL1),
  "UNKNOWN".padEnd(COL2),  // Always UNKNOWN
  member.agentId.slice(0, 12) + "...",
].join("  ");
```

But `lifecycle.ts:104-118` already implements `isTmuxPaneAlive()` which can determine RUNNING/DEAD status. The health command should use it:

```typescript
// Should be:
const status = member.tmuxPaneId
  ? isTmuxPaneAlive(member.tmuxPaneId) ? "RUNNING" : "DEAD"
  : "UNKNOWN";
```

The `listAgents()` function at lifecycle.ts:268-269 already does this correctly. The health subcommand is inconsistent.

### QA-8: `launch` subcommand doesn't actually launch (MEDIUM)

**File**: `bin/agent-launch.ts:138-160`

The launch command prints the args then says "Direct spawning not yet implemented." Despite `spawnAgent()` existing in spawn.ts:94-108. The spec §5 says launch should spawn the agent. This is a known incomplete implementation but it means the `launch` and `relaunch` commands are effectively no-ops.

### QA-9: `relaunch` uses stale discovery result (LOW)

**File**: `bin/agent-launch.ts:162-196`

The relaunch command kills the agent at line 170, then looks up the agent from `discoverResult` (line 178) which was computed before the kill at line 121. The comment says "Re-discover agent (file may have changed)" but it doesn't actually re-discover — it uses the cached result. If the agent file was modified between discover and relaunch, the stale version is used.

Should call `discoverAgents(projectRoot)` again after the kill.

### QA-10: `cleanupStaleEntries` counter is wrong after modification (LOW)

**File**: `src/lifecycle.ts:216`

```typescript
const trackedCount = config.members.filter((m) => m.tmuxPaneId).length + removed.length;
```

After `config.members = kept` (line 213), `config.members` no longer includes removed members. So `config.members.filter((m) => m.tmuxPaneId).length` counts only the surviving tracked members. Adding `removed.length` gives "original tracked count" which is correct for the message. However, this is confusing code — the variable name `trackedCount` refers to the pre-cleanup state but is computed from post-cleanup state + removed count. Not a bug, but a readability issue.

### QA-11: `writeTeamConfig` doesn't create parent directories (LOW)

**File**: `src/lifecycle.ts:62-68`

`writeTeamConfig()` calls `writeFileSync()` but doesn't `mkdirSync` first. If the team directory doesn't exist, this will throw. All current callers (`removeMember`, `cleanupStaleEntries`) only write after a successful read, so the directory exists. But `writeTeamConfig` is exported and could be called directly.

### QA-12: License mismatch (INFO)

**File**: `package.json:10` vs `LICENSE`

`package.json` says `"license": "UNLICENSED"` but `LICENSE` file exists (MIT). README says "Proprietary. All rights reserved." — three contradictory statements. Same issue found in nsheaps/agent (AGT-11).

### QA-13: README says "54 passing tests" — will become stale (INFO)

**File**: `README.md:9`

Hardcoded test count will drift as tests are added/removed. Consider removing the number or generating it.

---

## Spec Compliance

Compared implementation against `docs/specs/draft/agent-launcher.md`:

| Spec Section | Status | Notes |
|-------------|--------|-------|
| §2 Discovery | **IMPLEMENTED** | Correct per spec. Tests verify all error cases. |
| §3 Schema | **IMPLEMENTED** | All fields from spec present in types.ts. Defaults match. |
| §4 Prompt Assembly | **IMPLEMENTED** | Both modes work. 200KB warning present. |
| §5 Spawning | **PARTIAL** | `buildSpawnArgs()` correct, but `launch` command is a no-op (QA-8) |
| §6.1 Kill | **IMPLEMENTED** | Works correctly per tests. Graceful shutdown (10s timeout) NOT implemented — goes straight to force kill. |
| §6.2 Health | **PARTIAL** | Exists but always returns UNKNOWN (QA-7) |
| §6.3 Cleanup | **IMPLEMENTED** | Works correctly per tests |
| §6.4 List | **IMPLEMENTED** | Correctly cross-references files and config |
| §6.5 Relaunch | **PARTIAL** | Uses stale discovery (QA-9), spawning is no-op |
| §7 Tool Control | **IMPLEMENTED** | `--tools` and `--disallowedTools` correctly built |
| §9 Orchestrator | **NOT IMPLEMENTED** | No `role` field, no `start` command, no tmux -CC auto-launch |
| §10 CLI | **PARTIAL** | Missing: `start`, `--all`, `--verbose`, `--project-root`, `--teammate-mode`, `--no-interactive` |
| §11 Migration | N/A | claude-team still exists separately |

### Key Spec Gaps

1. **No `start` command** — the primary entry point per spec §10 doesn't exist
2. **No graceful shutdown** — spec §6.1 says send `SendMessage` shutdown request with 10s timeout, but implementation goes straight to `tmux kill-pane`
3. **No `--all` batch launch** — spec §5 defines batch launch, not implemented
4. **No orchestrator recognition** — no `role` field parsing, no special orchestrator handling
5. **No `--project-root` override** — `resolveProjectRoot()` supports override param but CLI doesn't expose it

---

## Edge Cases

| Edge Case | Handled? | Details |
|-----------|----------|---------|
| Agent file with empty body | **YES** | Parsed as empty string, no crash |
| Agent with whitespace-only name | **YES** | `trim()` + empty check catches it (discover.ts:83) |
| Concurrent config writes (race condition) | **NO** | No file locking on config.json. Two agents calling `removeMember` simultaneously could corrupt the file |
| Very long agent names (>30 chars) in list output | **NO** | `padEnd(30)` in agent-launch.ts will misalign columns |
| Team name with special characters | **NO** | Used directly in file path (lifecycle.ts:41). `/`, `..`, or null bytes could cause path traversal |
| Agent file with BOM (byte order mark) | **UNKNOWN** | gray-matter may or may not handle BOM |
| symlinked agent files | **UNKNOWN** | `readFileSync` follows symlinks, but `Glob.scan` behavior with symlinks is undocumented for Bun |

---

## Positive Findings

- **Clean architecture**: Separation of discover → prompt → spawn → lifecycle is excellent
- **Testable design**: `buildSpawnArgs` returns data instead of spawning, making tests straightforward
- **Comprehensive tests**: 54 tests with 187 assertions is solid for ~1100 lines of source
- **Good error handling**: Graceful degradation throughout — invalid files warn, don't crash
- **Type safety**: Full TypeScript types with discriminated unions for enums
- **Fixture-based tests**: Real markdown files as test fixtures, not inline strings
- **CI pipeline**: lint + test on PRs and main pushes

---

## Issue Summary

| ID | Severity | Description |
|----|----------|-------------|
| QA-1 | **HIGH** | `bin/agent-launch.ts` (300 lines) has zero test coverage |
| QA-4 | **MEDIUM** | `health` subcommand always shows UNKNOWN despite `isTmuxPaneAlive` existing |
| QA-7 | **MEDIUM** | `health` hardcodes UNKNOWN, should use existing lifecycle functions |
| QA-8 | **MEDIUM** | `launch` and `relaunch` are no-ops — don't actually spawn |
| QA-2 | **MEDIUM** | No integration tests (CLI subprocess testing) |
| QA-3 | **MEDIUM** | `spawnAgent()` function untested |
| QA-9 | LOW | `relaunch` uses stale discovery result |
| QA-11 | LOW | `writeTeamConfig` doesn't create parent dirs |
| QA-5 | LOW | Test fixtures create temp dirs without cleanup |
| QA-6 | LOW | `resolveProjectRoot()` non-git path untested |
| QA-10 | LOW | `cleanupStaleEntries` counter computed from mixed state |
| QA-12 | INFO | License mismatch (package.json vs LICENSE vs README) |
| QA-13 | INFO | Hardcoded "54 passing tests" in README |

**1 HIGH, 5 MEDIUM, 5 LOW, 2 INFO issues found.**

The codebase is clean, well-structured, and the implemented features work correctly. The main concerns are: (1) the CLI entry point has zero test coverage, (2) several subcommands are no-ops despite the underlying functions existing, and (3) spec compliance is partial — key features like `start`, batch launch, and graceful shutdown are missing.

For a POC/sandbox (as README states), this is solid work. The test infrastructure is excellent and the architecture is ready for the next implementation push.
