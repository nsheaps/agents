# QA Phase 1 Code Review — Daffy D (qa)

**Date**: 2026-02-17
**Reviewer**: Daffy Duck (Quality Assurance)
**Scope**: All Phase 1 source files + CLI entry point

## Summary

5 source modules + 1 CLI entry point reviewed. **0 tests exist.** The code is functional but has several defects, missing edge case handling, and spec compliance gaps.

**Severity Legend**: CRITICAL = blocks release, HIGH = should fix before Phase 2, MEDIUM = address soon, LOW = nice to have

---

## Defects

### DEF-4 [HIGH]: No test suite exists

**Location**: Entire project
**Description**: Zero test files (`.test.ts` or `.spec.ts`) exist. For a tool that manages agent spawning and lifecycle, this is a significant gap. Every module has testable pure functions that should have unit tests.
**Impact**: Regressions will go undetected. The QA ticket (PHASE1-010) acceptance criteria cannot be fully validated without automated tests.
**Recommendation**: Add `bun:test` based unit tests for at minimum:
- `discover.ts`: `parseAgentFile` (valid, invalid, missing fields, bad enums), `discoverAgents` (empty dir, no dir, duplicates)
- `prompt.ts`: `assemblePrompt` (extend/_builtin, extend/custom, replace/_builtin, replace/custom, size warning)
- `spawn.ts`: `buildSpawnArgs` (all flag combinations)
- `lifecycle.ts`: `readTeamConfig`, `findMember`, `removeMember`, `killAgent`, `listAgents`

### DEF-5 [HIGH]: `cleanupStaleEntries` is a no-op

**Location**: `src/lifecycle.ts:178-192`
**Description**: The function always returns `{ removed: [], message: "..." }`. It does not actually clean up anything. The comment says "Full cleanup requires tmux pane tracking (future)" but this means the `cleanup` subcommand is misleading — it claims to be a cleanup command but does nothing.
**Impact**: Users running `agent-launch cleanup` get a message saying members exist but nothing is cleaned. The PHASE1-010 acceptance criterion "Auto-cleanup: removes stale entries on demand" is NOT met.
**Recommendation**: Either (a) implement real cleanup using `isTmuxPaneAlive` to detect dead panes and remove their config entries, or (b) clearly document this as unimplemented and remove the acceptance criterion.

### DEF-6 [MEDIUM]: `health` subcommand always reports UNKNOWN

**Location**: `bin/agent-launch.ts:88-118`
**Description**: Every member is reported as "UNKNOWN" status. The `isTmuxPaneAlive` function exists in `lifecycle.ts` but is never called from the health check. Without tmux pane IDs in the config, health checks are non-functional.
**Impact**: PHASE1-010 acceptance criterion "Health check: correctly reports running vs dead agents" is NOT met.
**Recommendation**: Document as known limitation or extend team config schema to include tmux pane IDs.

### DEF-7 [MEDIUM]: `listAgents` uses agent `name` for matching, but config may use `displayName`

**Location**: `src/lifecycle.ts:197-219`
**Description**: `listAgents` compares `discoveredNames` (agent names from files) against `config.members[].name` (from team config). But the team config `name` field may contain display names like "Daffy D (qa)" while the agent file `name` is "quality-assurance". This mismatch means the comparison will never find matches.
**Impact**: `agent-launch list` would show agents as both NOT_SPAWNED (from file) and UNKNOWN (from config) as separate entries, rather than correlating them.
**Recommendation**: The correlation needs to use a consistent identifier. Either normalize display names back to agent names, or store the agent file name as an additional field in team config.

### DEF-8 [MEDIUM]: `launch` subcommand doesn't actually spawn anything

**Location**: `bin/agent-launch.ts:138-160`
**Description**: The `launch` subcommand prints the command but says "Direct spawning not yet implemented." The `spawnAgent` function exists in `spawn.ts` but is never called from the CLI.
**Impact**: The primary purpose of the launcher — launching agents — doesn't work from the CLI.
**Recommendation**: Either wire up `spawnAgent` or clearly mark this as Phase 2.

### DEF-9 [MEDIUM]: `relaunch` uses stale discovery results

**Location**: `bin/agent-launch.ts:162-196`
**Description**: Discovery happens once at line 121 before the relaunch block. The comment at line 177 says "Re-discover agent (file may have changed)" but it reuses the same `discoverResult` — it does NOT re-discover. If the agent file was edited between kill and relaunch, the old definition is used.
**Impact**: The "re-discover" comment is misleading. In practice this is only an issue for interactive use where someone edits the file mid-command, so actual impact is low.
**Recommendation**: If re-discovery is intended, call `discoverAgents` again after kill. If not, fix the comment.

### DEF-10 [MEDIUM]: `killAgent` doesn't kill the tmux pane

**Location**: `src/lifecycle.ts:136-169`
**Description**: The `killAgent` function removes the agent from config but does NOT call `killTmuxPane`. The `killTmuxPane` and `isTmuxPaneAlive` functions exist but are unused. The spec §6.1 says "Force kill tmux pane (if applicable)" as step 2, but this is skipped.
**Impact**: After `kill`, the agent process may still be running in a tmux pane even though it's removed from config. This creates orphan processes.
**Recommendation**: Store tmux pane ID in team config at spawn time, then use it in `killAgent`.

### DEF-11 [LOW]: `readBasePrompt` doesn't handle relative paths with `..`

**Location**: `src/prompt.ts:83-89`
**Description**: `readBasePrompt` uses `join(projectRoot, filePath)` which could traverse outside the project if `filePath` contains `../`. No path traversal check exists.
**Impact**: Low in practice since the frontmatter is authored by the team, but it's a minor security concern if agent files are untrusted.
**Recommendation**: Add a check that the resolved path is within the project root.

### DEF-12 [LOW]: `discoverAgents` silently treats validation failures as warnings, not errors

**Location**: `src/discover.ts:154-209`
**Description**: When a file has invalid frontmatter, missing required fields, or bad enum values, these are pushed to `warnings` (not `errors`). The CLI exits with code 1 only if `errors` is non-empty. This means malformed agent files are silently skipped.
**Impact**: A typo in `permission_mode` silently drops the agent with only a warning. The user might not notice.
**Recommendation**: Consider making required-field-missing and invalid-enum-value actual errors, or at minimum log them more prominently.

### DEF-13 [LOW]: Shell escaping in `launch` command output is incomplete

**Location**: `bin/agent-launch.ts:153`, `bin/agent-launch.ts:289-291`
**Description**: The shell escaping logic handles spaces, newlines, and double quotes by wrapping in single quotes. But it doesn't handle other special characters (backticks, `$`, `!`, etc.) that could cause issues if the output is copy-pasted into a shell.
**Impact**: Low — this is display-only for dry-run mode. But if users copy-paste the command, it could fail with certain prompt content.
**Recommendation**: Use a proper shell-escape library or at minimum document the limitation.

---

## Missing Test Coverage

| Module | Functions | Test Priority |
|--------|-----------|---------------|
| `discover.ts` | `resolveProjectRoot`, `parseAgentFile` (private), `discoverAgents` | HIGH |
| `prompt.ts` | `assemblePrompt`, `readBasePrompt` (private) | HIGH |
| `spawn.ts` | `buildSpawnArgs`, `spawnAgent` | HIGH |
| `lifecycle.ts` | `readTeamConfig`, `writeTeamConfig`, `findMember`, `removeMember`, `killAgent`, `cleanupStaleEntries`, `listAgents`, `isTmuxPaneAlive`, `killTmuxPane` | MEDIUM |
| `bin/agent-launch.ts` | CLI arg parsing, subcommand routing | MEDIUM |

---

## Spec Compliance Summary

| PHASE1-010 Criterion | Status | Notes |
|----------------------|--------|-------|
| Launch: agent spawns with correct prompt/permissions | PARTIAL | `buildSpawnArgs` works, but `spawnAgent` never called from CLI |
| Kill: config entry removed cleanly | PARTIAL | Config removed, but tmux pane NOT killed (orphan process) |
| Relaunch: no `-2` suffix | UNKNOWN | Can't verify without actual spawn |
| Health check: running vs dead | FAIL | Always reports UNKNOWN |
| Auto-cleanup: removes stale entries | FAIL | Function is a no-op |
| List: accurate status | PARTIAL | Name mismatch between file names and config display names |
| Edge cases: no crashes | PARTIAL | No tests to verify |
| Test report | N/A | This is the report |

---

## Positive Observations

1. **Clean type definitions**: `types.ts` is well-structured with clear separation of raw frontmatter vs resolved definition
2. **Good validation in discovery**: Enum validation, required field checks, duplicate name detection all present
3. **Prompt assembly logic is solid**: Both extend and replace modes correctly implemented per the described algorithm
4. **`buildSpawnArgs` is well-separated**: Pure function that returns args without side effects — very testable
5. **Code is concise**: ~520 lines total across 5 modules. No over-engineering.

---

## Recommendations (Priority Order)

1. **Write unit tests** (DEF-4) — highest ROI, enables all future QA
2. **Fix `killAgent` to actually kill tmux panes** (DEF-10) — orphan processes are a real operational concern
3. **Fix name mismatch in `listAgents`** (DEF-7) — makes the list command actually useful
4. **Either implement or clearly mark as unimplemented**: cleanup (DEF-5), health (DEF-6), launch (DEF-8)
5. **Fix misleading relaunch comment** (DEF-9)
