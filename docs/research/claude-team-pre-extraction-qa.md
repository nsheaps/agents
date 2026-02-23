> **Note (2026-02-23):** `delegate` permission mode was removed in Claude Code v2.1.50. The replacement is `bypassPermissions`. This document reflects findings at the time of writing.

# Pre-Extraction QA Review: claude-team Scripts — Daffy D (qa)

**Date**: 2026-02-17
**Reviewer**: Daffy Duck (Quality Assurance)
**Scope**: `bin/claude-team`, `bin/ct`, `bin/lib/claude.lib.sh`, `bin/lib/stdlib.sh` in claude-utils
**Purpose**: Identify issues to fix during extraction to standalone `claude-team` repo

---

## Files Reviewed

| File                    | Lines | Purpose                                                    |
| ----------------------- | ----- | ---------------------------------------------------------- |
| `bin/claude-team`       | 197   | Main script — mode picker, tmux detection, launches claude |
| `bin/ct`                | 34    | Shorthand alias, delegates to claude-team                  |
| `bin/lib/claude.lib.sh` | 200   | Shared library — happy/claude routing, settings backup     |
| `bin/lib/stdlib.sh`     | 490   | General utility library — colors, check_and_install, etc.  |

---

## Critical Issues (must fix during extraction)

### EXT-1 [CRITICAL]: `claude-team` uses `--dangerously-skip-permissions` directly

**File**: `bin/claude-team:193-195`
**Description**: Both the tmux and non-tmux launch paths pass `--dangerously-skip-permissions` directly to claude:

```bash
exec tmux -CC new-session -- claude --dangerously-skip-permissions "${TEAM_FLAGS[@]}" ...
command claude --dangerously-skip-permissions "${TEAM_FLAGS[@]}" ...
```

But `TEAM_FLAGS` already includes `--permission-mode delegate`. Per the team's earlier finding (from claude-utils MEMORY.md), there's a semantic difference between `--dangerously-skip-permissions` and `--allow-dangerously-skip-permissions`. The `simple_claudeish` function in `claude.lib.sh:98-106` uses `--allow-dangerously-skip-permissions`, and the code standard says to use `simple_claudeish` instead of passing the flag directly.
**Impact**: Security/permission model inconsistency. May bypass intended permission gates.
**Recommendation**: Use `--allow-dangerously-skip-permissions` instead, or make this configurable.

### EXT-2 [CRITICAL]: Heavy dependency on claude-utils library ecosystem

**File**: `bin/claude-team:23` → `bin/lib/claude.lib.sh` → `bin/lib/stdlib.sh`
**Description**: `claude-team` sources `claude.lib.sh`, which sources `stdlib.sh`. Together these are ~690 lines of library code. The extraction must either:

1. Copy the needed functions into claude-team's own lib
2. Or keep a dependency on claude-utils

The decision says "claude-team does NOT depend on run-claude", but it still depends on `claude.lib.sh` and `stdlib.sh`.
**Impact**: Without resolving this, the extracted script won't work standalone.
**Recommendation**: Extract only the functions actually used by claude-team into a minimal lib. Used functions:

- From `stdlib.sh`: `info`, `warn`, `error`, `fatal`, `hint`, `success`, `check_and_install`
- From `claude.lib.sh`: `claude_check_settings_backup` (but user REJECTED settings backup migration — see EXT-5)

### EXT-3 [CRITICAL]: `--continue` is hardcoded

**File**: `bin/claude-team:173`
**Description**: `TEAM_FLAGS` always includes `"--continue"`. The user decision says "Make configurable (add flag/env var to override, default to --continue)".
**Impact**: Can't start fresh sessions without editing the script.
**Recommendation**: Add `--no-continue` flag and `CLAUDE_TEAM_CONTINUE` env var. Default to `--continue`.

---

## High Issues (should fix during extraction)

### EXT-4 [HIGH]: `gum` used without install guard in `check_and_install` itself

**File**: `bin/lib/stdlib.sh:178-179`
**Description**: The `check_and_install` function uses `gum spin` to show progress when installing a tool via brew. But if `gum` itself is the tool being installed, this creates a circular dependency — `check_and_install gum` tries to use `gum spin` before `gum` exists.

Looking more carefully at line 178: it checks `if command -v gum &>/dev/null` first, so it falls through to the non-gum `spinner` path. But the `spinner` function at line 202 calls `check_and_install gum` — creating infinite recursion if gum isn't installed.
**Impact**: If `gum` is not installed and `tmux` is not installed, running `claude-team --mode tmux` would hit infinite recursion in `spinner → check_and_install gum → ... → spinner`.

Wait — actually re-reading: `check_and_install gum` at line 105 would first try to install gum. Inside `check_and_install`, since `gum` is missing, it goes to the brew install block. At line 178, it checks `if command -v gum` — gum is missing, so it goes to `else` at line 181, which runs `(brew install "$cmd") &` then calls `spinner`. `spinner` at line 202 calls `check_and_install gum` again — gum is still installing in background — still not found — loops.

**Impact**: Infinite recursion if gum is not installed. This was previously identified by both Tweety and Wile E. in claude-utils.
**Recommendation**: In the extracted version, don't use gum-based spinner for installing gum itself. Use a simple `brew install gum` with plain output.

### EXT-5 [HIGH]: Settings backup should NOT be migrated

**File**: `bin/claude-team:185-186`
**Description**: `claude_check_settings_backup` is called on startup and via EXIT trap. The user explicitly rejected settings backup migration (per MEMORY.md and extraction decisions).
**Impact**: If copied to the extracted repo, it contradicts the user's decision.
**Recommendation**: Remove `claude_check_settings_backup` calls and the EXIT trap from the extracted version. Do NOT include the backup functions from `claude.lib.sh`.

### EXT-6 [HIGH]: `SCRIPT_DIR` resolution depends on symlink layout

**File**: `bin/claude-team:22`, `bin/ct:10`
**Description**: `SCRIPT_DIR="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"` resolves the real path through symlinks. This works when Homebrew symlinks `bin/claude-team` to `/opt/homebrew/bin/claude-team`. But when extracted to a new repo with a different structure, the relative path to `lib/claude.lib.sh` must still resolve correctly.
**Impact**: If the extracted repo has a different directory layout (e.g., `lib/` instead of `bin/lib/`), the source path breaks.
**Recommendation**: Define the lib path explicitly in the extracted version, not relative to bin.

### EXT-7 [HIGH]: `ct` hardcodes relative path to `claude-team`

**File**: `bin/ct:34`
**Description**: `exec "$SCRIPT_DIR/claude-team" "$@"` assumes `claude-team` is in the same directory as `ct`. In Homebrew, both are symlinked to the same `bin/` so this works. But in the extracted repo, if installation puts them in different locations, this breaks.
**Impact**: `ct` won't find `claude-team` if installed differently.
**Recommendation**: In the extracted version, have `ct` resolve via `PATH` (`exec claude-team "$@"`) rather than relative path, or document that both must be in the same directory.

---

## Medium Issues (address during or after extraction)

### EXT-8 [MEDIUM]: Orchestrator prompt is minimal and hardcoded

**File**: `bin/claude-team:141`
**Description**: The orchestrator system prompt is a single sentence:

```
"You are an orchestrator of an agent team using claude code. You do not perform any tasks, only create/launch teammates and coordinate between them."
```

This is hardcoded in the script. The agent-team TypeScript launcher has a configurable prompt system with extend/replace modes. The extracted version should at minimum allow overriding via env var or file.
**Impact**: Users can't customize orchestrator behavior without editing the script.
**Recommendation**: Support `CLAUDE_TEAM_ORCHESTRATOR_PROMPT` env var and/or a prompt file path (e.g., `--orchestrator-prompt-file`).

### EXT-9 [MEDIUM]: Hooks JSON is hardcoded inline

**File**: `bin/claude-team:144-167`
**Description**: The `HOOKS_SETTINGS_JSON` is a multi-line JSON blob hardcoded in the script. It contains `SessionStart` and `Stop` hooks that just echo messages. No way to customize.
**Impact**: Users can't add custom hooks without editing the script.
**Recommendation**: Support merging user hooks with defaults, or allow overriding via file/env var.

### EXT-10 [MEDIUM]: No `--version` flag

**File**: `bin/claude-team` (entire file)
**Description**: No `--version` flag exists. `claude.lib.sh` has `CLAUDE_UTILS_VERSION="v0.8.7"` but it's not exposed via CLI. The extracted repo should have its own version.
**Recommendation**: Add `--version` flag that reads from a VERSION file or package.json.

### EXT-11 [MEDIUM]: `happy` binary routing is irrelevant for extraction

**File**: `bin/lib/claude.lib.sh:20-97`
**Description**: The entire `_claudeish`/`claudeish`/`happy_bin` routing system is specific to the user's `happy` CLI wrapper preference. None of this is needed in the extracted `claude-team` — the decision says it launches `claude` binary directly.
**Impact**: Code bloat and confusion if copied wholesale.
**Recommendation**: Do NOT copy the happy routing. claude-team should invoke `claude` directly. The `simple_claudeish` pattern (line 98-106) that just adds `--allow-dangerously-skip-permissions` is closer to what's needed, but even that should be simplified.

### EXT-12 [MEDIUM]: `run-claude` update check should move to `claude-team` entry point

**File**: `bin/run-claude:36-47`
**Description**: Per MEMORY.md: "Brew update check should move FROM run-claude TO claude-team (entry point only, not per-agent)". Currently `run-claude` checks for updates to `claude-code` and `claude-utils` formulae. The extracted `claude-team` should check for updates to `claude-team` formula instead.
**Impact**: Users of `claude-team` (standalone) won't get update notifications.
**Recommendation**: Add Homebrew update check for the `claude-team` formula in the extracted version.

---

## Low Issues (nice to have)

### EXT-13 [LOW]: `tmux -CC` assumption is iTerm2-specific

**File**: `bin/claude-team:136, 193`
**Description**: `tmux -CC` is iTerm2 control mode. The info message says "iTerm2 control mode" but doesn't check if the user is actually in iTerm2. On other terminals, `tmux -CC` may not work as expected.
**Impact**: Confusing behavior on non-iTerm2 terminals.
**Recommendation**: Detect iTerm2 via `$TERM_PROGRAM == iTerm.app` before suggesting/using `-CC`.

### EXT-14 [LOW]: No test suite for shell scripts

**Description**: No tests exist for `claude-team` or `ct`. Given these are the primary user-facing tools for agent teams, they should have at minimum:

- Arg parsing tests (--mode values, --no-interactive, --)
- Help output tests
- Exit code tests for invalid inputs
  **Recommendation**: Add bats or shunit2 tests in the extracted repo.

### EXT-15 [LOW]: `stdlib.sh` is ~490 lines but claude-team uses ~7 functions

**Description**: The full stdlib is massive for what claude-team needs. Functions actually used:

- `info`, `warn`, `error`, `fatal`, `hint`, `success` (output formatting)
- `check_and_install` (dependency management)

Functions NOT used by claude-team: `debug`, `dryrun`, `stream_command_as_debug`, `run`, `colorize`, `debounce`, `yn_prompt`, `yn_prompt_default_yes`, `expand_path`, `find_up`, `find_files`, `find_files_with_extensions`, `required`, `sync_directory`, `create_dir_symlink`, `spinner`, `retry`, all `realpath.*` functions.
**Recommendation**: Extract only the ~40 lines actually needed into claude-team's own minimal lib.

---

## Extraction Checklist

Based on this review, the extraction should:

- [ ] Remove `--dangerously-skip-permissions` in favor of `--allow-dangerously-skip-permissions` (or configurable) (EXT-1)
- [ ] Create minimal standalone lib with only needed functions (EXT-2, EXT-15)
- [ ] Make `--continue` configurable with flag/env var (EXT-3)
- [ ] Fix `check_and_install` circular dependency with gum (EXT-4)
- [ ] Remove settings backup calls (EXT-5)
- [ ] Ensure SCRIPT_DIR resolution works for new repo layout (EXT-6)
- [ ] Make `ct` resolve `claude-team` reliably (EXT-7)
- [ ] Allow orchestrator prompt customization (EXT-8)
- [ ] Allow hooks customization (EXT-9)
- [ ] Add `--version` flag (EXT-10)
- [ ] Don't copy happy routing code (EXT-11)
- [ ] Add Homebrew update check for claude-team formula (EXT-12)
- [ ] Detect iTerm2 before using `tmux -CC` (EXT-13)
- [ ] Add shell script tests (EXT-14)
