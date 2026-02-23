# New Claude Code Hooks for Agent Teams

**Author**: Road Runner (Deep Researcher)
**Date**: 2026-02-23
**Scope**: TeammateIdle, TaskCompleted, and other new hooks in Claude Code v2.1.33–v2.1.50
**Confidence**: High (multiple sources cross-referenced)

---

## Question

What new hooks has Claude Code added for agent teams? How do they work, can they serve as quality gates, and how should we integrate them?

## Answer

Claude Code v2.1.33–v2.1.50 introduced **6 new hook events** relevant to agent teams. The two most impactful — **TeammateIdle** and **TaskCompleted** — are production-ready quality gate mechanisms that use exit code 2 to block actions and feed stderr back as actionable feedback. Both are confirmed working and reliable. Other hooks (ConfigChange, WorktreeCreate/Remove, SubagentStop enhancement) serve infrastructure and isolation use cases.

---

## Hook #1: TeammateIdle

**Introduced**: v2.1.33 (early February 2026)
**Fires when**: A teammate finishes its turn and is about to go idle
**Scope**: Agent teams only (does not fire in single-agent sessions)
**Confidence**: High

### Input Schema (stdin JSON)

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "TeammateIdle",
  "teammate_name": "researcher",
  "team_name": "my-project"
}
```

### Exit Code Behavior

| Exit Code | Effect                                                         |
| --------- | -------------------------------------------------------------- |
| 0         | Teammate goes idle normally                                    |
| 2         | Teammate receives stderr as feedback and continues working     |
| Other     | Non-blocking error; logged in verbose mode, teammate goes idle |

### Key Properties

- **No matcher support** — fires on every idle transition; `matcher` field silently ignored
- **Command hooks only** — does NOT support prompt-based or agent-based hooks
- **Exit-code-only decision model** — no JSON output processing
- **Confirmed working** — no known issues with this hook ([source: GitHub research](#sources))

### Example: Build Artifact Check

```bash
#!/bin/bash
if [ ! -f "./dist/output.js" ]; then
  echo "Build artifact missing. Run the build before stopping." >&2
  exit 2
fi
exit 0
```

---

## Hook #2: TaskCompleted

**Introduced**: v2.1.33 (early February 2026)
**Fires when**: A task is marked completed (explicit `TaskUpdate` with `status: "completed"`, or teammate finishes turn with in-progress tasks)
**Scope**: All sessions (not just agent teams)
**Confidence**: High

### Input Schema (stdin JSON)

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "TaskCompleted",
  "task_id": "task-001",
  "task_subject": "Implement user authentication",
  "task_description": "Add login and signup endpoints",
  "teammate_name": "implementer",
  "team_name": "my-project"
}
```

**Note**: `task_description`, `teammate_name`, and `team_name` are optional — may be absent in non-team sessions.

### Exit Code Behavior

| Exit Code | Effect                                                |
| --------- | ----------------------------------------------------- |
| 0         | Task marked completed                                 |
| 2         | Task remains in-progress; stderr fed back as feedback |
| Other     | Non-blocking error; task completes anyway             |

### Key Properties

- **No matcher support** — fires on every task completion
- **Command hooks only** — does NOT support prompt-based or agent-based hooks
- **Exit-code-only decision model** — no JSON output processing
- **Two trigger paths**: explicit TaskUpdate AND implicit teammate-finish-with-in-progress-tasks
- **Confirmed working** — no known issues ([source: GitHub research](#sources))

### Working Example: Uncommitted Changes Check

The `todo-plus-plus` plugin in `ai-mktpl` has a production TaskCompleted hook that blocks completion if uncommitted changes exist:

**Hook config** (`plugins/todo-plus-plus/hooks/hooks.json`):

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/check-uncommitted.sh",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

**Script** (`plugins/todo-plus-plus/scripts/check-uncommitted.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail
cat > /dev/null  # Consume stdin

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  exit 0  # Not a git repo, allow
fi

status_output=$(git status --porcelain 2>/dev/null || true)
if [ -n "$status_output" ]; then
  change_count=$(echo "$status_output" | wc -l | tr -d ' ')
  echo "BLOCKED: You have $change_count uncommitted change(s). Commit and push your work before marking this task complete." >&2
  exit 2
fi

# Also check for unpushed commits
local_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -n "$local_branch" ] && [ "$local_branch" != "HEAD" ]; then
  ahead_count=$(git rev-list --count "@{upstream}..HEAD" 2>/dev/null || echo "0")
  if [ "$ahead_count" -gt 0 ]; then
    echo "BLOCKED: You have $ahead_count unpushed commit(s). Push your changes before marking this task complete." >&2
    exit 2
  fi
fi

exit 0
```

This is a proven pattern for enforcing "done means done."

---

## Hook #3: ConfigChange

**Introduced**: v2.1.49 (mid February 2026)
**Fires when**: Configuration files change during a session
**Scope**: All sessions
**Confidence**: High

### Input Schema

```json
{
  "hook_event_name": "ConfigChange",
  "source": "project_settings",
  "file_path": "/path/to/.claude/settings.json"
}
```

`source` is one of: `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills`

### Key Properties

- **Supports matchers** — can match on specific `source` values
- **Exit code 2 blocks the change** — except for `policy_settings` which cannot be blocked (enterprise policies always take effect)
- **Primary use case**: Security auditing and unauthorized change prevention

### Relevance to Agent Teams

Medium. Useful for preventing teammates from modifying project settings or hooks mid-session. Also valuable for enterprise compliance.

---

## Hook #4 & #5: WorktreeCreate / WorktreeRemove

**Introduced**: v2.1.50 (late February 2026)
**Fires when**: Worktree lifecycle events (creation via `--worktree` or `isolation: "worktree"`, removal at session exit)
**Scope**: All sessions
**Confidence**: High

### WorktreeCreate

- **Must print absolute path to stdout** — this becomes the session's working directory
- **Replaces default `git worktree` behavior** when configured
- **Use case**: Alternative VCS (SVN, Perforce, Mercurial), custom isolation strategies

### WorktreeRemove

- **Cannot block removal** — failures logged in debug mode only
- **Input includes `worktree_path`** — the path originally printed by WorktreeCreate
- **Use case**: Custom cleanup, artifact preservation before deletion

### Relevance to Agent Teams

Medium-High. The `isolation: worktree` agent frontmatter field (also new) triggers these hooks. For agent-team, this enables custom setup/teardown when agents work in isolation — e.g., pre-configuring environment variables or installing dependencies.

---

## Hook #6: SubagentStop Enhancement

**Enhanced**: v2.1.47 (mid February 2026)
**Change**: Added `last_assistant_message` field to input
**Scope**: Subagent contexts

### New Field

```json
{
  "hook_event_name": "SubagentStop",
  "agent_id": "def456",
  "agent_type": "Explore",
  "agent_transcript_path": "~/.claude/projects/.../subagents/agent-def456.jsonl",
  "last_assistant_message": "Analysis complete. Found 3 potential issues..."
}
```

### Why This Matters

Before v2.1.47, validating subagent output required parsing the full JSONL transcript file. Now the final response text is available directly in the hook input, enabling fast output validation without file I/O.

### Caveat

**Prompt-based SubagentStop hooks do NOT prevent termination** — the feedback is sent but the subagent gets no additional turn to respond ([GitHub #20221](https://github.com/anthropics/claude-code/issues/20221)). Use **command-based hooks with exit code 2** for reliable blocking.

---

## Quality Gate Pattern: TaskCompleted + TeammateIdle

The evidence suggests the most effective quality gate for agent teams combines both hooks:

```json
{
  "hooks": {
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/teammate-quality-gate.sh",
            "timeout": 60
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/task-quality-gate.sh",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

**Workflow**:

1. Teammate finishes turn → TeammateIdle fires → checks build/lint/tests
2. If checks fail (exit 2) → teammate continues working with feedback
3. Teammate marks task complete → TaskCompleted fires → validates deliverables
4. If validation fails (exit 2) → task stays in-progress, teammate gets feedback

This creates a two-layer gate: TeammateIdle catches quality issues before rest, and TaskCompleted enforces acceptance criteria before closure.

---

## Known Issues and Limitations

### Working Reliably

| Hook                  | Status            | Notes                                                            |
| --------------------- | ----------------- | ---------------------------------------------------------------- |
| TeammateIdle          | Confirmed working | Command hooks only                                               |
| TaskCompleted         | Confirmed working | Command hooks only; proven in production (todo-plus-plus plugin) |
| ConfigChange          | Confirmed working | Cannot block policy_settings by design                           |
| WorktreeCreate/Remove | Confirmed working | New in v2.1.50                                                   |

### Known Problems

| Hook                        | Issue                                             | Reference                                                        |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| PreToolUse (exit code 2)    | Claude stops instead of retrying ~60% of the time | [#24327](https://github.com/anthropics/claude-code/issues/24327) |
| PreToolUse on Task tool     | Exit code 2 does not block Task tool calls at all | [#26923](https://github.com/anthropics/claude-code/issues/26923) |
| SubagentStop (prompt-based) | Feedback sent but subagent terminates anyway      | [#20221](https://github.com/anthropics/claude-code/issues/20221) |

**Key takeaway**: Use **command-based hooks** for reliability. Avoid PreToolUse for blocking quality gates (unreliable with current model). TeammateIdle and TaskCompleted are the correct patterns for agent team quality enforcement.

---

## Recommendations for agent-team

### Priority 1: Implement Now

1. **TaskCompleted hook** — Enforce "done means done" by requiring tests to pass and uncommitted changes to be committed before any task can be marked complete. The `todo-plus-plus` plugin's `check-uncommitted.sh` is a ready-made reference implementation.

2. **TeammateIdle hook** — Basic quality check before teammates rest. Start simple: verify no lint errors or broken builds.

### Priority 2: Implement Soon

3. **ConfigChange hook** (audit mode) — Log all configuration changes during team sessions for post-session review. Run with exit code 0 (don't block), just log.

4. **SubagentStop validation** — Use the `last_assistant_message` field to validate subagent output quality (e.g., minimum length, no error patterns). Use command-based hooks only.

### Priority 3: Evaluate Later

5. **WorktreeCreate/Remove hooks** — Relevant when agents use `isolation: worktree` frontmatter. Custom setup/teardown for isolated agent environments.

6. **Multi-hook quality pipeline** — Combine TeammateIdle + TaskCompleted + SubagentStop for comprehensive quality enforcement across the agent lifecycle.

---

## Integration with Existing Infrastructure

### Connection to Wile E.'s Audit Recommendations

Wile E.'s changelog audit (`docs/research/changelog-audit-20260223.md`) flagged these hooks in Priority 2, item #11: "Evaluate `TeammateIdle` / `TaskCompleted` hooks for quality gates." This report provides the detailed evidence needed to proceed with implementation.

### Connection to Task #40

Task #40 ("Investigate TeammateIdle and TaskCompleted hooks for quality gates") assigned to Wile E. can reference this report for the technical details. The evidence here confirms both hooks are production-ready for quality gate use.

### Plugin Packaging

The quality gate hooks should be packaged as an `ai-mktpl` plugin (similar to `todo-plus-plus`) for reuse across projects. This aligns with the organization's plugin-first approach to shared behavior.

---

## Sources

### Official Documentation

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Changelog](https://code.claude.com/docs/en/changelog)

### Internal Sources

- `ai-mktpl/.ai/plugins/agent-teams-skills/skills/agent-teams/references/hooks-and-config.md` — Full JSON schemas for TeammateIdle and TaskCompleted
- `ai-mktpl/plugins/todo-plus-plus/` — Working TaskCompleted hook implementation
- `docs/research/changelog-audit-20260223.md` — Wile E.'s changelog audit flagging these hooks

### GitHub Issues (Known Limitations)

- [#24327: PreToolUse exit code 2 causes Claude to stop](https://github.com/anthropics/claude-code/issues/24327)
- [#26923: PreToolUse hook does not block Task tool calls](https://github.com/anthropics/claude-code/issues/26923)
- [#20221: Prompt-based SubagentStop hooks don't prevent termination](https://github.com/anthropics/claude-code/issues/20221)

### Sub-agent Research Files

- `.claude/tmp/hooks-docs-research.md` — Official documentation analysis
- `.claude/tmp/hooks-github-research.md` — GitHub issues and community findings

### External Resources

- [Claude Code Hook Control Flow (Steve Kinney)](https://stevekinney.com/courses/ai-development/claude-code-hook-control-flow)
- [Claude Code Hooks Guide (aiorg.dev)](https://aiorg.dev/blog/claude-code-hooks)
