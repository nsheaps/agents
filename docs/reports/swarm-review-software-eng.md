# SWARM Review: Software Engineer (Code Quality)

**Reviewer**: Bugs Bunny (Software Engineer)
**Repo**: nsheaps/agent-team
**Branch**: main
**Date**: 2026-02-17

---

## Summary

The codebase is clean, well-structured TypeScript with a clear separation of concerns across 5 modules + 1 CLI entry point. Code follows consistent patterns and is easy to read. Test coverage is partial — 2 of 5 modules have dedicated test files. Several features are stubbed or incomplete (health checks, launch/relaunch). Below are findings grouped by severity.

---

## CRITICAL — Must Fix

### C1: No shell argument sanitization in `spawn.ts`

**File**: `src/spawn.ts:59-74`

`buildSpawnArgs()` passes user-provided strings (model, tools, disallowedTools) directly into the args array for `Bun.spawn()`. While Bun.spawn uses exec-style invocation (no shell interpretation), the `tools` and `disallowedTools` arrays come from YAML frontmatter which could contain crafted values. The `spawnAgent()` function at line 83 passes args to `Bun.spawn` with `stdio: "inherit"`.

**Risk**: Low-to-medium. Bun.spawn doesn't use a shell so classic injection is unlikely, but malformed tool names could cause unexpected CLI behavior.

**Recommendation**: Validate tool names against an allowlist pattern (e.g., `/^[a-zA-Z0-9_:-]+$/`) during frontmatter parsing in `discover.ts`.

### C2: No type checking in CI

**File**: `mise.toml`, `.github/workflows/test.yaml`

There is no `tsconfig.json` and no type-check step in CI. Bun handles TypeScript natively for execution, but compile-time type errors go undetected. The test workflow runs `fmt-check` and `bun test` but never `tsc --noEmit` or equivalent.

**Recommendation**: Add a `tsconfig.json` with `strict: true` and a `mise run typecheck` task that runs `bun x tsc --noEmit`. Add it to the CI workflow.

---

## HIGH — Should Fix Soon

### H1: Missing tests for `prompt.ts` and `lifecycle.ts`

**Files**: `src/prompt.ts`, `src/lifecycle.ts`

Only `discover.test.ts` (10 tests) and `spawn.test.ts` (13 tests) exist. The prompt assembly and lifecycle management modules have no test coverage. `lifecycle.ts` is the largest module (307 lines) with the most complex logic (team config I/O, tmux interaction, stale entry cleanup).

**Recommendation**: Add `prompt.test.ts` and `lifecycle.test.ts`. For lifecycle, mock `Bun.spawn` (tmux calls) and filesystem operations.

### H2: `agent-launch.ts` growing complexity — 300 lines, multiple subcommands

**File**: `bin/agent-launch.ts`

The CLI entry point handles 6 subcommands (list, kill, cleanup, health, relaunch, launch) plus default discovery mode, all in a single file. At 300 lines it's manageable but trending toward a maintenance burden.

**Recommendation**: Extract each subcommand handler into `src/commands/<subcommand>.ts`. The entry point should only parse args and dispatch.

### H3: `teamName` parameter accepted but unused in `buildSpawnArgs`

**File**: `src/spawn.ts:19`

```typescript
export function buildSpawnArgs(
  agent: AgentDefinition,
  teamName: string,
  ...
```

`teamName` is a required parameter but never appears in the returned args array or env vars. This is misleading — callers must provide it but it has no effect.

**Recommendation**: Either use `teamName` (pass it as `--team-name` or `CLAUDE_TEAM_NAME` env var) or remove the parameter. If it's planned for future use, add a TODO comment and make it optional.

### H4: `lint` task duplicates `fmt-check` in `mise.toml`

**File**: `mise.toml`

```toml
[tasks.lint]
run = "bun run prettier --check '**/*.md'"

[tasks.fmt-check]
run = "bun run prettier --check '**/*.md'"
```

These are identical commands. CI runs `fmt-check` but having `lint` as a duplicate creates confusion about which to use.

**Recommendation**: Make `lint` a composite task that runs `fmt-check` + any future linters (type checking, etc.), or remove the duplicate.

---

## MEDIUM — Should Fix

### M1: Health check always returns UNKNOWN

**File**: `bin/agent-launch.ts:186-210`

The health subcommand lists all team members but always shows status as "UNKNOWN" because it's not wired to `isTmuxPaneAlive()` from lifecycle.ts.

**Recommendation**: Wire it up — `lifecycle.ts` already has `isTmuxPaneAlive()`. Call it for each member's `paneId` and display "ALIVE" / "DEAD" / "UNKNOWN" (when no paneId).

### M2: Launch/relaunch subcommands are stubs

**File**: `bin/agent-launch.ts:212-257`

Both print "Direct spawning not yet implemented" and exit. This is documented but could confuse users.

**Recommendation**: Either implement using `spawnAgent()` from spawn.ts, or clearly mark these subcommands as `[WIP]` in the `--help` output and skip them from default command listing.

### M3: `resolveProjectRoot()` silently falls back to cwd

**File**: `src/discover.ts:12-22`

If `git rev-parse --show-toplevel` fails (not in a git repo), the function silently falls back to `process.cwd()`. This could lead to confusing behavior if agent files are expected to be in a git repo but aren't found.

**Recommendation**: At minimum, emit a warning when falling back to cwd. Consider making the fallback configurable or documented.

### M4: Frontmatter defaults applied inline in `parseAgentFile`

**File**: `src/discover.ts:50-120`

Default values for optional fields (model, permissionMode, teammateMode, framework, promptMode, dangerouslySkipPermissions, continue) are applied inline within `parseAgentFile()`. This mixes parsing/validation with default resolution.

**Recommendation**: Extract default application to a separate `applyDefaults()` function for clarity. Tests can then verify defaults independently from parsing.

### M5: No `.gitignore` for `.claude/tmp/`

**File**: `.gitignore`

The `.claude/tmp/` directory contains 40+ research/QA artifacts that appear to be ephemeral. If these aren't meant to be committed, they should be gitignored.

**Recommendation**: Add `.claude/tmp/` to `.gitignore` if these are ephemeral. If they're intentional, consider moving permanent artifacts to `docs/`.

---

## LOW — Nice to Have

### L1: `gray-matter` is the only runtime dependency

**File**: `package.json`

The project has exactly one runtime dependency (`gray-matter`). This is excellent for a CLI tool — minimal dependency surface.

**Observation**: No action needed. This is a positive pattern to maintain.

### L2: Test fixtures are well-organized

**File**: `src/__tests__/fixtures/`

9 fixture files covering valid, invalid, edge case, and all-options scenarios. Good pattern.

**Observation**: Positive. Extend this pattern to prompt.ts and lifecycle.ts tests.

### L3: No error types — all errors are plain strings

**Files**: `src/discover.ts`, `src/lifecycle.ts`

Errors are pushed as plain strings to arrays or thrown as generic Error objects. No custom error types.

**Recommendation**: Consider introducing `AgentError` types (validation, parsing, lifecycle) for better error handling downstream. Low priority — current approach works fine for a CLI tool.

---

## Pattern Observations

| Pattern            | Quality                             | Notes                                                                      |
| ------------------ | ----------------------------------- | -------------------------------------------------------------------------- |
| Module separation  | Good                                | Clean split: types → discover → prompt → spawn → lifecycle → CLI           |
| Error handling     | Adequate                            | Errors collected in arrays, returned to caller. No silent swallowing.      |
| TypeScript usage   | Good                                | Proper interfaces, union types for enums, no `any` usage found             |
| Test organization  | Good structure, incomplete coverage | Fixtures well-organized, but only 2/5 modules tested                       |
| CLI arg parsing    | Adequate                            | Uses `node:util` parseArgs — works but limited compared to yargs/commander |
| Dependency hygiene | Excellent                           | 1 runtime dep (gray-matter), all devDeps are tooling                       |

---

## Recommended Priority Order

1. **C2** — Add type checking to CI (low effort, high value)
2. **H1** — Add missing tests for prompt.ts and lifecycle.ts
3. **H4** — Fix lint/fmt-check duplication in mise.toml
4. **H3** — Resolve unused teamName parameter
5. **M1** — Wire up health check to isTmuxPaneAlive
6. **C1** — Add tool name validation
7. **H2** — Extract subcommands from agent-launch.ts
8. **M2** — Implement or clearly mark stub subcommands
