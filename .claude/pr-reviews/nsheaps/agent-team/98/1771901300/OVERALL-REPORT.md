# PR Review: agent-team#98 (v2 Re-review)

**Score**: 90/100 ✅
**Verdict**: Ready to merge
**Previous**: 82/100 → 90/100

## Fix Verification

| Finding                                                           | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :---------------------------------------------------------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2: `bypassPermissions` default with tradeoff documentation added | ✅ Fixed | `docs/specs/draft/claude-team-cli.md` §2.2, line 195: explicit note — "bypassPermissions grants unrestricted tool access and is appropriate for agent team teammates that need autonomous operation... When creating agents for team use, the interactive flow highlights bypassPermissions as the recommended choice." Tradeoffs documented.                                                                                              |
| P2: Update path for existing agents (not just error-on-conflict)  | ✅ Fixed | `docs/specs/draft/claude-team-cli.md` §2.2 error handling table (line 266-267): "Agent name already exists (no --overwrite): Error ... Use --overwrite to replace." AND "Agent name already exists (--overwrite): Warning: Overwriting... Proceeds." Both create and update paths are now specified.                                                                                                                                       |
| P2: Future frontmatter fields annotated properly                  | ✅ Fixed | §2.2 Note (line 260): "The minimal output includes only name, description, and permission_mode... Fields model, prompt_mode, color, tools, and disallowed_tools are only included when explicitly set via flags. Of these, model is live today; prompt_mode, color, tools, and disallowed_tools are planned fields defined in the Agent Launcher Spec but not yet consumed by the Claude Code runtime." Clear live-vs-planned delineation. |
| P3 fixes (various)                                                | ✅ Fixed | §6 Validation Rules: team name max 50 chars, agent name max 30 chars, kebab-case regex specified, display name uniqueness and max 30 chars documented. Tool flag mutual exclusivity documented with error message.                                                                                                                                                                                                                         |

All 4 tracked fixes verified. Good work on the spec completeness.

## Category Scores

| Category             |  v1 |  v2 | Status |
| :------------------- | --: | --: | :----- |
| Correctness & Logic  |  82 |  92 | ✅     |
| Security             |  85 |  88 | ✅     |
| Error Handling       |  80 |  92 | ✅     |
| Code Quality & Style |  85 |  92 | ✅     |
| Documentation        |  82 |  94 | ✅     |
| Testing              |  75 |  80 | ⚠️     |
| Dependencies         |  85 |  90 | ✅     |
| Spec Compliance      |  80 |  92 | ✅     |

## Remaining / New Findings

**spec-1** (P3 — Low)
**File**: `docs/specs/draft/claude-team-cli.md:596`
**Description**: The spec references `docs/research/session-reconnection.md` at line 596 (`../../../docs/research/session-reconnection.md`). This path resolves to three levels up from `docs/specs/draft/`, which would be the repo root's parent directory — that's out of the repo. The path should be `../../research/session-reconnection.md` (relative to `docs/specs/draft/`) or `docs/research/session-reconnection.md` (absolute from repo root).
**Expected**: Correct relative path to the session reconnection research document.
**Actual**: Path with three `../` traversals escapes the repository directory structure.
**Severity**: P3 — Low (doc link is broken, but spec is otherwise complete)

**spec-2** (P3 — Low)
**File**: `docs/specs/draft/claude-team-cli.md:28-33`
**Description**: The spec's "Non-Goals" section says "Running or launching agents (that's `bin/run-claude-team-persistent` or the agent launcher)" but `bin/run-claude-team-persistent` is now superseded by `bin/claude-team` (added in agent-team#78). The spec should reference `bin/claude-team` as the launch tool, not the older `run-claude-team-persistent`.
**Expected**: Non-goals references updated to `bin/claude-team` as the launch mechanism.
**Actual**: Stale reference to `bin/run-claude-team-persistent`.
**Severity**: P3 — Low (cosmetic in a draft spec)

**testing-1** (P3 — Low)
**File**: `docs/specs/draft/claude-team-cli.md`
**Description**: The spec defines extensive validation rules (§6) and error handling (per command) but has no test plan or test cases. For a CLI spec this complex, the spec should include a §9 Test Cases section or reference a test plan document. Without it, implementors have no acceptance criteria to test against.
**Expected**: A test cases section or reference to a test plan.
**Actual**: No test plan in the spec.
**Severity**: P3

**completeness-1** (P4 — Low)
**File**: `docs/specs/draft/claude-team-cli.md:499-506`
**Description**: §5 "Runtime Config" mentions `~/.claude/tasks/{team-name}/` for the shared task list but the team structure docs reference the built-in TaskCreate/TaskList tools, not a file-based task store. This section may be speculative or outdated. If the runtime doesn't actually use this path, the spec is misleading.
**Expected**: Verify that `~/.claude/tasks/{team-name}/` is a real runtime path, or mark it as "future/hypothetical."
**Actual**: Listed as a current runtime path without verification note.
**Severity**: P4
