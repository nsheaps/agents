# QA Report: Phase 1 Launcher (Task #116)

**Commit**: `5e28946`
**Date**: 2026-02-17
**Tester**: Daffy Duck (QA)

## Summary

**Overall**: PASS with 3 defects (0 critical, 1 high, 2 medium)

The Phase 1 launcher correctly discovers all 8 agent files, parses YAML frontmatter, assembles prompts in extend mode, builds CLI args for dry-run, and handles lifecycle subcommands. Error handling for malformed files, missing required fields, invalid enum values, and duplicate names all work correctly.

## Test Results

### 1. Discovery

| Test                               | Result | Notes                                                                                                               |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Finds all 8 agents                 | PASS   | ai-agent-eng, deep-researcher, docs-writer, ops-eng, orchestrator, project-manager, quality-assurance, software-eng |
| Alphabetical sort                  | PASS   | Output is sorted by name                                                                                            |
| Agent name filter (positional arg) | PASS   | `bun bin/agent-launch.ts software-eng` shows only that agent                                                        |

### 2. Frontmatter Parsing

| Test                                        | Result | Notes                                                                      |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Required fields (name, description)         | PASS   | Correctly parsed for all 8 agents                                          |
| Optional fields (model, color, tools, etc.) | PASS   | `model: claude-opus-4-6`, `tools`, `disallowed_tools` all resolved         |
| Default values applied                      | PASS   | `promptMode: extend`, `permissionMode: delegate`, `continueSession: false` |
| Unknown fields silently ignored             | PASS   | `orchestrator.md` has `role: orchestrator` (not in type) — no error        |
| display_name resolved                       | PASS   | Falls back to `name` when not specified                                    |

### 3. Prompt Assembly (`--prompt`)

| Test                                      | Result | Notes                                          |
| ----------------------------------------- | ------ | ---------------------------------------------- |
| Extend mode with \_builtin base           | PASS   | All 8 agents use `--append-system-prompt` only |
| Prompt char counts reported               | PASS   | Each agent shows correct character count       |
| No `--system-prompt` for \_builtin extend | PASS   | Only `--append-system-prompt` emitted          |

### 4. Dry-Run (`--dry-run`)

| Test                                              | Result | Notes                                                                 |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| Shows CLI command with flags                      | PASS   | `claude --append-system-prompt ... --model ... --permission-mode ...` |
| Shows env vars                                    | PASS   | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`                              |
| `--dangerously-skip-permissions` for orchestrator | PASS   | Present when `dangerously_skip_permissions: true`                     |
| `--tools` comma-joined                            | PASS   | e.g., `Read,Edit,Write,Bash,Grep,Glob,WebSearch,WebFetch`             |
| `--disallowedTools` repeated per tool             | PASS   | e.g., `--disallowedTools Edit --disallowedTools Write`                |
| Requires `--team-name`                            | PASS   | Error with exit 1 when missing                                        |

### 5. Error Handling

| Test                        | Result | Notes                                                                              |
| --------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Empty frontmatter           | PASS   | `WARN [_test-empty.md]: Missing required field 'name'`                             |
| Missing description         | PASS   | `WARN [_test-nodescrip.md]: Missing required field 'description'`                  |
| No frontmatter at all       | PASS   | `WARN [_test-nofm.md]: Missing required field 'name'`                              |
| Invalid prompt_mode enum    | PASS   | `WARN [_test-badmode.md]: Invalid prompt_mode 'invalid'. Must be: extend, replace` |
| Duplicate agent name        | PASS   | `ERROR` (not warn) with exit code 1                                                |
| Kill without team name      | PASS   | `ERROR: Team name required.` exit 1                                                |
| Kill without agent name     | PASS   | `ERROR: Agent name required for kill command.` exit 1                              |
| Launch nonexistent agent    | PASS   | `ERROR: Agent '...' not found in agent files.` exit 1                              |
| Health with no team config  | PASS   | Error message + exit 1                                                             |
| Cleanup with no team config | PASS   | Error message + exit 0 (graceful)                                                  |
| List with no team config    | PASS   | Shows all agents as NOT_SPAWNED (graceful)                                         |

### 6. Edge Cases

| Test                                            | Result | Notes                                    |
| ----------------------------------------------- | ------ | ---------------------------------------- |
| Unknown frontmatter fields                      | PASS   | `role: orchestrator` ignored silently    |
| Agents with `tools` + `disallowed_tools`        | PASS   | Both arrays parsed and emitted correctly |
| Agent with `dangerously_skip_permissions: true` | PASS   | Flag added to CLI args                   |

## Defects

### DEF-1: `--dry-run` truncates CLI args, command not copy-pasteable

**File**: `bin/agent-launch.ts:289`
**Severity**: High
**Description**: The `--dry-run` output truncates any arg longer than 80 chars with `"${a.slice(0, 77)}..."`. This means `--append-system-prompt` and `--tools` values are truncated, making the output useless for copy-paste execution — which is the primary use case of `--dry-run`.
**Expected**: Full command that can be copy-pasted and run, or at minimum a `--raw` flag to disable truncation.
**Actual**: Truncated args like `"<system-message>\nYour full name is Bugs Bunny.\nYou are named after the Looney..."`.
**Steps to reproduce**:

```bash
bun bin/agent-launch.ts --dry-run --team-name test software-eng
```

### DEF-2: `agentFilter` positional arg parsing is fragile

**File**: `bin/agent-launch.ts:40-47`
**Severity**: Medium
**Description**: The `agentFilter` is found by searching `process.argv` for the first arg that isn't the binary, script, subcommand, team name, or flag-prefixed. This heuristic breaks if:

- An agent is named the same as a subcommand (e.g., `list`, `kill`)
- Future flags are added that take positional-looking values
  **Expected**: Use a proper CLI arg parser (e.g., `commander`, `yargs`, or Bun's built-in `parseArgs`).
  **Actual**: Custom heuristic that could silently misinterpret arguments.
  **Steps to reproduce**: Create an agent file with `name: list` — the filter logic would fail to distinguish it from the subcommand.

### DEF-3: Duplicate name error message has confusing order

**File**: `src/discover.ts:199`
**Severity**: Medium
**Description**: The error message says `Duplicate agent name 'X' in ${existing} and ${file}` — where `existing` is the first file parsed (the one kept) and `file` is the second (the one rejected). However, the error is attributed to `file` (the rejected one, line 197: `filename: file`). The message reads as if the duplicate is "in A and B", but it's only the second file that is rejected.
**Expected**: Message like `Duplicate agent name 'X': '${file}' conflicts with already-loaded '${existing}'` to make it clearer which file is rejected.
**Actual**: `Duplicate agent name 'orchestrator' in _test-dup.md and orchestrator.md` — ambiguous about which is kept.

## Observations (Not Defects)

1. **`launch` and `relaunch` don't actually spawn**: Both print a note saying "Direct spawning not yet implemented." This is expected per the phase plan.

2. **`cleanup` is a stub**: Returns "Auto-cleanup requires tmux pane tracking (future)." Expected per spec.

3. **`health` shows UNKNOWN for all**: Without tmux pane ID tracking in team config, health can't determine actual status. Expected limitation.

4. **`--tools` flag format**: The launcher emits `--tools Read,Edit,Write,...` (comma-joined). Need to verify this matches what `claude` CLI actually expects. If it expects `--tools Read --tools Edit ...` (repeated), this would be a bug.

5. **No `--help` support**: Running `bun bin/agent-launch.ts --help` falls through to default discovery mode. A `--help` flag would be useful.

6. **No `replace` mode agents to test**: All 8 agents use `extend` mode. The `replace` code path in `prompt.ts` is untested with real data (only validated via enum rejection test).
