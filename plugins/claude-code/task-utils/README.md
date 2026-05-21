# task-utils

Task discipline hooks and the `manage-tasks` skill — packages the workflow originally proven out in [nsheaps/.ai-agent-alex](https://github.com/nsheaps/.ai-agent-alex).

## What it provides

**Hooks** (PreToolUse):

- **`task-invariant.sh`** — gates `TaskCreate` / `TaskUpdate`:
  - Enforces 0-or-1 task in `in_progress` at any time.
  - Rejects `TaskCreate` with `status=in_progress` (tasks must enter `pending` first).
  - Parses `<validation-steps>` blocks from task descriptions and requires `RESULT(...)` lines on every checked `- [x]` step before allowing `* → completed`.
  - Emits lifecycle coach messages (STARTED / COMPLETED) after allowed transitions.
  - On TaskCreate, emits a `BEHAVIOR_CHANGING_COACH` reminding the agent that skill/plugin/hook updates jump the queue rather than being end-of-list ticketed.

- **`require-task-in-progress.sh`** — gates `Write` / `Edit` / `MultiEdit` / `NotebookEdit`:
  - Denies the write tool if no task is currently `in_progress`. Keeps file edits attached to a tracked unit of work.
  - **Fallback for no-built-in-tools contexts:** where `TaskCreate` / `TaskUpdate` are not enabled (notably Claude Code on the web), use the bundled `task-mcp` MCP server (see below) — a `task_update`-promoted `in_progress` task satisfies this gate. The `TASK_UTILS_REQUIRE_TASK=0` opt-out remains as a belt-and-suspenders escape that disables the gate entirely; the MCP server is the preferred fix because it keeps the discipline.
  - **Known soft spot:** the `Bash` tool is NOT in the PreToolUse write-tool set (Claude Code limitation — Bash isn't in the matched set). So `bash -c 'cat > foo.txt'`, `sed -i`, `tee`, etc. bypass this gate. The invariant is "edits via Claude's native write tools require an in_progress task"; file writes via shell commands are not gated and rely on agent discipline alone.

**MCP server** (`task-mcp`):

- A bundled stdio MCP server exposing four tools — `task_create`, `task_update`, `task_list`, `task_get` — that mirror the built-in Claude Code Task tools. It is the **fallback** for contexts where the built-in Task tools are unavailable (notably Claude Code on the web), so the `require-task-in-progress.sh` write-gate stays satisfiable without resorting to `TASK_UTILS_REQUIRE_TASK=0`.
- The server re-implements the `task-invariant.sh` lifecycle invariants in-process (no born-`in_progress`, 0-or-1 `in_progress`, validation-steps required for `pending→in_progress`, `RESULT` lines required for `in_progress→completed`) — the PreToolUse hook does not match MCP tool names, so the server polices itself.
- See the `mcp-task-tools` skill for correct usage.

**Skill**:

- **`manage-tasks`** — doctrine for the atomicity check, breakdown pattern, status-transition table, validation-steps mechanism, background-subagent (`AGENT(<n>)`) prefix, MONITORING(<monitor-id>) prefix, and behavior-changing-jumps-the-queue rule. Forks into an isolated context via `context: fork` so the parent's window stays lean and returns a ≤5-sentence imperative instruction.
- **`mcp-task-tools`** — guides correct use of the `task-mcp` MCP tools when the built-in Task tools are unavailable.

## Task storage

Both the hooks and the MCP server resolve task storage identically:

| Layout               | Location                                                                | Written by                |
| -------------------- | ----------------------------------------------------------------------- | ------------------------- |
| Flat (MCP)           | `<store-root>/<task-id>.json`                                           | the `task-mcp` MCP server |
| Legacy (per-session) | `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/<task-id>.json` | the built-in Task tools   |

`<store-root>` resolves in this order:

1. `TASK_UTILS_TASK_DIR` — an absolute path, used verbatim when set.
2. `<git-repo-root>/.claude/tasks` — the CWD git repo's tasks directory (default).
3. `<cwd>/.claude/tasks` — fallback when not in a git repo.

`require-task-in-progress.sh` is satisfied by an `in_progress` task in **either** store, so built-in-Task-tool users and MCP-fallback users both keep working. On every task create / update / delete the MCP server makes a **best-effort** templated git commit (`chore(tasks): …`) + push of the task file when the store is inside a git working tree — any git failure is logged and swallowed; the task write always succeeds.

## Installation

Add to your `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "task-utils@agents": true
  },
  "extraKnownMarketplaces": {
    "agents": {
      "source": { "source": "github", "repo": "nsheaps/agents" }
    }
  }
}
```

Then in a fresh session:

```bash
claude plugin install task-utils@agents
```

The two PreToolUse hooks register automatically; the skills are available as `Skill(manage-tasks)` and `Skill(mcp-task-tools)`. The `task-mcp` MCP server connects automatically when the plugin is enabled — verify with `/mcp`, and run `/reload-plugins` if you enabled the plugin mid-session.

### How the MCP server is built (on-device, on first use)

The MCP server is shipped as TypeScript **source only** (`mcp/src/`). The runnable artifact is a **native executable** produced by `bun build --compile`. Because a compiled binary is platform-specific, it cannot be committed — instead it is built **on the end user's machine, lazily, on first use**:

- The MCP server's launch command is `mcp/launch.sh`. On first run it invokes `mcp/build.sh`, which runs `bun install` then `bun build --compile`; subsequent runs `exec` the binary directly with no rebuild.
- A `SessionStart` hook (`mcp/prewarm.sh`) kicks the same build off in the background at session start, so the binary is usually ready before the MCP server connects.
- The compiled binary lives in the plugin's **persistent data dir** — `${CLAUDE_PLUGIN_DATA}/bin/task-mcp` — so it survives plugin updates. It is keyed by plugin version: a version bump triggers a one-time rebuild. `build.sh` is idempotent and lock-guarded, so concurrent sessions are safe.
- **Requirement:** `bun` must be on `PATH` (install from <https://bun.sh>). If it is missing, the build fails with an actionable message and the MCP server does not start.

For local development / CI, `mise run build-task-mcp` compiles the binary to `mcp/dist/task-mcp` (gitignored — not shipped); `mise run test-task-mcp` builds it and runs the full test suite against it.

See [`docs/research/native-build-strategy.md`](docs/research/native-build-strategy.md) for the rationale and design.

## Design

Worked example for the breakdown pattern: [nsheaps/agents/docs/journal/2026/05/16/managing-tasks-example.md](https://github.com/nsheaps/agents/blob/main/docs/journal/2026/05/16/managing-tasks-example.md).

**Internal reference (private):** the full spec lives at `docs/specs/draft/task-discipline-plugin.md` and `docs/specs/draft/manage-tasks-skill.md` in the `nsheaps/.ai-agent-alex` private repo where the workflow was proven out. The behavior is fully documented in the SKILL.md doctrine sections in this plugin; the spec drafts are mainly useful for the design rationale + change history.
