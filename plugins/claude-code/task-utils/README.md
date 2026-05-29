# task-utils

Task discipline hooks and the `task-manage` skill — packages the workflow originally proven out in [nsheaps/.ai-agent-alex](https://github.com/nsheaps/.ai-agent-alex).

## What it provides

**Hooks** (PreToolUse):

- **`task-invariant.sh`** — gates `TaskCreate` / `TaskUpdate`:
  - Enforces 0-or-1 task in `in_progress` at any time.
  - Rejects `TaskCreate` with `status=in_progress` (tasks must enter `pending` first).
  - Parses `<validation-steps>` blocks from task descriptions and requires `RESULT(...)` lines on every checked `- [x]` step before allowing `* → completed`.
  - Emits lifecycle coach messages (STARTED / COMPLETED) after allowed transitions.
  - On TaskCreate, emits a `BEHAVIOR_CHANGING_COACH` reminding the agent that skill/plugin/hook updates jump the queue rather than being end-of-list ticketed.
  - Scans **only the flat MCP YAML store** (`<store-root>/<id>.yaml`); the legacy per-session JSON store is not consulted.

- **`require-task-in-progress.sh`** — gates `Write` / `Edit` / `MultiEdit` / `NotebookEdit`:
  - Denies the write tool if no task is currently `in_progress` in the flat MCP YAML store.
  - **Opt-outs:** set `TASK_UTILS_REQUIRE_TASK=0` (env var) or `requireTaskInProgress: false` in `plugins.settings.yaml` to disable the gate entirely.
  - **Known soft spot:** the `Bash` tool is NOT in the PreToolUse write-tool set (Claude Code limitation — Bash isn't in the matched set). So `bash -c 'cat > foo.txt'`, `sed -i`, `tee`, etc. bypass this gate.

- **`task-native-warning.sh`** — fires on `TaskCreate` / `TaskUpdate` (native built-in Task tools):
  - Advises or blocks use of native Task tools in favor of the MCP server equivalents.
  - Behavior controlled by `nativeTaskMode` setting (see Configuration below). Default: `warn`.

**Hooks** (PostToolUse):

- **`task-sync-from-legacy.sh`** — fires after `TaskCreate` / `TaskUpdate` (native built-in Task tools):
  - When built-in tasks are enabled, copies the resulting legacy task file (`~/.claude/tasks/<session_id>/<id>.{json,yaml}`) into the flat MCP store (`<store-root>/<id>.yaml`), converting JSON to minimal YAML if needed.
  - Makes a best-effort `git add + commit + push` after the sync.
  - Always exits 0 — PostToolUse errors never surface to the user. Skipped silently when built-in tasks are disabled (`CLAUDE_CODE_ENABLE_TASKS=0/false/off/no`).

**MCP server** (`task-mcp`):

- A bundled stdio MCP server exposing four tools — `task_create`, `task_update`, `task_list`, `task_get` — that mirror the built-in Claude Code Task tools. It is the **fallback** for contexts where the built-in Task tools are unavailable (notably Claude Code on the web), so the `require-task-in-progress.sh` write-gate stays satisfiable without resorting to `TASK_UTILS_REQUIRE_TASK=0`.
- The server re-implements the `task-invariant.sh` lifecycle invariants in-process (no born-`in_progress`, 0-or-1 `in_progress`, validation-steps required for `pending→in_progress`, `RESULT` lines required for `in_progress→completed`) — the PreToolUse hook does not match MCP tool names, so the server polices itself.
- See the `tool-task-mcp` skill for correct usage.

**Skill**:

- **`task-manage`** — doctrine for the atomicity check, breakdown pattern, status-transition table, validation-steps mechanism, background-subagent (`AGENT(<n>)`) prefix, MONITORING(<monitor-id>) prefix, and behavior-changing-jumps-the-queue rule. Forks into an isolated context via `context: fork` so the parent's window stays lean and returns a ≤5-sentence imperative instruction.
- **`tool-task-mcp`** — guides correct use of the `task-mcp` MCP tools when the built-in Task tools are unavailable.

## Task storage

| Layout               | Location                                                                | Written by                                  |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| Flat (MCP)           | `<store-root>/<task-id>.yaml`                                           | the `task-mcp` MCP server                   |
| Legacy (per-session) | `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/<session_id>/<task-id>.json` | the built-in Task tools                     |
| Synced from legacy   | `<store-root>/<task-id>.yaml`                                           | `task-sync-from-legacy.sh` PostToolUse hook |

**The hooks scan only the flat MCP store** (R1 redesign, 2026-05-24). The legacy per-session store is written by the built-in Task tools; when those tools are used, `task-sync-from-legacy.sh` copies each task into the flat store automatically so the write-gate stays satisfied.

`<store-root>` resolves in this order:

1. `TASK_UTILS_TASK_DIR` — an absolute path, used verbatim when set.
2. `<git-repo-root>/.claude/tasks` — the CWD git repo's tasks directory (default).
3. `<cwd>/.claude/tasks` — fallback when not in a git repo.

On every task create / update / delete the MCP server makes a **best-effort** templated git commit (`chore(tasks): …`) + push of the task file when the store is inside a git working tree — any git failure is logged and swallowed; the task write always succeeds.

## Configuration

Settings are resolved from three tiers (project > user > plugin defaults):

| Tier            | Location                                                                      |
| --------------- | ----------------------------------------------------------------------------- |
| Project         | `$CLAUDE_PROJECT_DIR/.claude/plugins.settings.yaml` under `task-utils:` block |
| User            | `~/.claude/plugins.settings.yaml` under `task-utils:` block                   |
| Plugin defaults | `task-utils.settings.yaml` in the plugin root                                 |

Available settings (all camelCase):

| Key                     | Default | Description                                                                                                                                      |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`               | `true`  | Enable/disable the plugin entirely                                                                                                               |
| `nativeTaskMode`        | `warn`  | What to do when built-in TaskCreate/TaskUpdate are used: `silent` (allow, no advisory), `warn` (allow with advisory), `block` (deny)             |
| `requireTaskInProgress` | `true`  | Whether the write-gate (`require-task-in-progress.sh`) is active. Set to `false` to disable entirely (also: `TASK_UTILS_REQUIRE_TASK=0` env var) |
| `syncPullEnabled`       | `true`  | Whether `task-sync-pull.sh` runs before write tools                                                                                              |
| `syncPullIntervalSecs`  | `60`    | Minimum seconds between pull syncs                                                                                                               |

**Example project-level override** (`.claude/plugins.settings.yaml`):

```yaml
task-utils:
  nativeTaskMode: silent # suppress advisory when using built-in Task tools
  requireTaskInProgress: false # disable write-gate for this project
```

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

The two PreToolUse hooks register automatically; the skills are available as `Skill(task-manage)` and `Skill(tool-task-mcp)`. The `task-mcp` MCP server connects automatically when the plugin is enabled — verify with `/mcp`, and run `/reload-plugins` if you enabled the plugin mid-session.

### How the MCP server is built (on-device, on first use)

The MCP server is shipped as TypeScript **source only** (`mcp/src/`). The runnable artifact is a **native executable** produced by `bun build --compile`. Because a compiled binary is platform-specific, it cannot be committed — instead it is built **on the end user's machine, lazily, on first use**:

- The MCP server's launch command is `mcp/launch.sh`. On first run it invokes `mcp/build.sh`, which runs `bun install` then `bun build --compile`; subsequent runs `exec` the binary directly with no rebuild.
- A `SessionStart` hook (`mcp/prewarm.sh`) kicks the same build off in the background at session start, so the binary is usually ready before the MCP server connects.
- The compiled binary lives in the plugin's **persistent data dir** — `${CLAUDE_PLUGIN_DATA}/bin/task-mcp` — so it survives plugin updates. It is keyed by plugin version: a version bump triggers a one-time rebuild. `build.sh` is idempotent and lock-guarded, so concurrent sessions are safe.
- **Requirement:** `bun` must be on `PATH` (install from <https://bun.sh>). If it is missing, the build fails with an actionable message and the MCP server does not start.

For local development / CI, `mise run build-task-mcp` compiles the binary to `mcp/dist/task-mcp` (gitignored — not shipped); `mise run test-task-mcp` builds it and runs the full test suite against it.

See the build scripts (`mcp/build.sh`, `mcp/launch.sh`) for implementation details.

## Design

Worked example for the breakdown pattern: [nsheaps/agents/docs/journal/2026/05/16/managing-tasks-example.md](https://github.com/nsheaps/agents/blob/main/docs/journal/2026/05/16/managing-tasks-example.md).

**Internal reference (private):** the full spec lives at `docs/specs/draft/task-discipline-plugin.md` and `docs/specs/draft/manage-tasks-skill.md` in the `nsheaps/.ai-agent-alex` private repo where the workflow was proven out. The behavior is fully documented in the SKILL.md doctrine sections in this plugin; the spec drafts are mainly useful for the design rationale + change history.
