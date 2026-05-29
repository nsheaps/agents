# Plan — MCP task server for `task-utils`

**Status:** DRAFT — for human review. Updated 2026-05-21 with resolutions and empirical verification.
**Scope:** add a fallback task-management toolset to the `task-utils` plugin,
delivered as a bundled MCP server, for contexts where the built-in Task tools
(`TaskCreate`/`TaskUpdate`/`TaskList`/`TaskGet`) are unavailable — notably Claude
Code on the web.

See companion research:

- [`docs/research/task-tools-and-state.md`](../research/task-tools-and-state.md)
- [`docs/research/mcp-sdk-and-plugin-mcp.md`](../research/mcp-sdk-and-plugin-mcp.md)
- [`docs/research/q3-session-id-verification.md`](../research/q3-session-id-verification.md) — **Q3 empirical result**
- [`docs/research/repo-storage-design.md`](../research/repo-storage-design.md) — **NEW requirement 1 design**
- [`docs/research/git-auto-commit-design.md`](../research/git-auto-commit-design.md) — **NEW requirement 2 design**

---

## 1. Problem and goal

The `task-utils` hooks (`require-task-in-progress.sh`, `task-invariant.sh`) gate
write tools and the built-in Task tools around an on-disk task state. They were
designed around the built-in Task tools.[^1] Where those tools are disabled, no
`in_progress` task can ever exist, so the write-gate is permanently
unsatisfiable; today the only escape is `TASK_UTILS_REQUIRE_TASK=0`, which throws
away the discipline entirely.[^2]

**Goal:** ship an MCP server inside `task-utils` that exposes task-management
tools functionally equivalent to the built-ins, writes task state on disk in the
form the existing hooks already accept, and is used as a **fallback** when the
built-ins are unavailable. The hooks get small changes so they also recognise
MCP-created tasks and honour a new storage-location override.

### 1.1 Design principles

- **KISS / YAGNI** — replicate only what the hooks and `manage-tasks` doctrine
  need; do not re-implement every built-in nuance.
- **Move-first** — the MCP server is additive; existing hooks keep working for
  built-in tasks unchanged. Hook edits are minimal and backward compatible.
- **Single source of truth for state** — the on-disk JSON files remain the
  canonical state; the MCP server and the hooks both read/write the same files.

---

## 2. Storage design

### 2.1 Directory the hooks scan

Both hooks compute `TASKS_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks/$SESSION_ID"`
and read `*.json` files named `<task-id>.json` containing `id`, `subject`,
`status`, `description`.[^1] The MCP server must write files of that shape into a
directory the hooks scan.

### 2.2 The "distinct id" — RESOLVED (Q1)

The MCP-managed tasks are stored under a **sibling session directory**:

```
${TASK_STORE}/tasks/<session_id>-mcp/<task-id>.json
```

- `<session_id>` is the same id the hooks use (from hook stdin `.session_id`, or from `CLAUDE_CODE_SESSION_ID` env var in the MCP server).
- The `-mcp` suffix is the "distinct id": it guarantees the MCP server's
  task directory never overlaps the built-in `tasks/<session_id>/` directory, so
  the two id spaces cannot collide and `task-invariant.sh`'s id-addressed
  `TASK_FILE` lookup can never read across systems.
- Within `<session_id>-mcp/`, task ids are MCP-server-generated and `<id>.json`
  filenames follow the same convention the hooks expect.

**Decision:** Confirmed (a) — distinct _session-directory_ (`<session_id>-mcp/`).

### 2.3 New storage-location override env var — RESOLVED (Q2)

The new env var **overrides the task storage location entirely**:

- **Name:** `TASK_UTILS_TASK_DIR`
- **Semantics:** when set and non-empty, it is the absolute path used as the
  task-store root _in place of_ `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks`. The
  per-session subdir is still appended. Resolution order:

  ```
  if TASK_UTILS_TASK_DIR is set and non-empty:
      store_root = $TASK_UTILS_TASK_DIR
  else:
      store_root = "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/tasks"
  built-in tasks dir : $store_root/<session_id>
  MCP    tasks dir   : $store_root/<session_id>-mcp
  ```

- The MCP server and **BOTH hooks** must resolve the store identically, so they all
  agree on where files live.
- The override relocates **both** the built-in and MCP task directories for consistency.

**Decision:** Confirmed — env var `TASK_UTILS_TASK_DIR`, overrides whole path, relocates both.

### 2.4 Task file schema written by the MCP server

The MCP server writes `<task-id>.json` with at least the fields the hooks read,
plus the dependency/metadata fields the `manage-tasks` doctrine uses:

```json
{
  "id": "1",
  "subject": "string — required by hooks",
  "status": "pending | in_progress | completed",
  "description": "string — may contain a <validation-steps> block",
  "activeForm": "string (optional)",
  "blocks": ["<id>", "..."],
  "blockedBy": ["<id>", "..."],
  "owner": "string (optional)",
  "metadata": {},
  "source": "task-utils-mcp",
  "createdAt": "ISO-8601 UTC",
  "updatedAt": "ISO-8601 UTC"
}
```

- `id` MUST equal the filename stem (hook self-skip logic depends on it).[^1]
- `source: "task-utils-mcp"` marks the file as MCP-managed (useful for debugging
  and for any future hook logic; the hooks tolerate unknown fields).
- `blocks`/`blockedBy`/`owner`/`metadata` mirror the built-in Task-tool
  schema[^3] so the doctrine's dependency-graph guidance still applies.

---

## 3. The MCP server's tools

Four tools, mirroring the built-ins[^3], named with a `task_` prefix and
snake*case (MCP tool-name convention). Server key: `task-mcp` (final tool names
become `mcp**task-mcp**task*\*`— exact prefix confirmed via`/mcp` after install).

### 3.1 `task_create`

- **Mirrors:** `TaskCreate`.
- **Input schema** (zod raw shape): `{ subject: z.string(), description?:
z.string(), activeForm?: z.string(), metadata?: z.record(z.any()) }`.
- **Behavior:** assigns a new id, writes the task file with `status: "pending"`.
  Enforces the same invariant as `task-invariant.sh`: a task may **not** be born
  `in_progress` — there is no `status` input on create.[^1]
- **Output:** `{ content: [{ type: "text", text: "<json>" }] }` where the JSON is
  `{ task: { id, subject } }` — matching the built-in result shape so the id is
  discoverable.[^3]

### 3.2 `task_update`

- **Mirrors:** `TaskUpdate`.
- **Input schema:** `{ taskId: z.string(), status?: z.enum(["pending",
"in_progress","completed","deleted"]), subject?: z.string(), description?:
z.string(), activeForm?: z.string(), addBlocks?: z.array(z.string()),
addBlockedBy?: z.array(z.string()), owner?: z.string(), metadata?:
z.record(z.any()) }`.
- **Behavior:** patches one task file by id; `status: "deleted"` removes the file.
  The MCP server **re-implements the `task-invariant.sh` invariants in-process**
  so they hold even though the MCP tools are not matched by the PreToolUse hook
  (the hook only matches the literal tool names `TaskCreate|TaskUpdate`):
  - 0-or-1 `in_progress` across the MCP task dir.
  - `pending → in_progress` requires a `<validation-steps>` block with ≥1
    unchecked `- [ ]` (parser must match the awk parser in `task-invariant.sh`).
  - `in_progress → completed` requires all steps `- [x]` each with a `RESULT`
    line.
  - `pending → completed` skips the validation-step check.
    On a rejected transition, return `isError: true` with the same prose the hook
    uses, so the agent gets identical coaching.[^2]
- **Output:** `{ content: [{ type: "text", text: "<json of updated task>" }] }`.
- **Git auto-commit:** After the file write succeeds, the server attempts
  `git add` + `git commit` + `git push` (see §3.5.1 and design note[^7]).

> **Design note:** the validation-steps parser is duplicated between
> `task-invariant.sh` (awk) and the MCP server (TS). Recommend extracting the
> parsing rules into a short shared spec doc so the two stay in sync; a follow-up
> task. (Not in scope for the first implementation.)

### 3.3 `task_list`

- **Mirrors:** `TaskList`. Read-only.
- **Input schema:** `{ status?: z.enum([...]) }` (optional filter).
- **Output:** JSON array of full task objects from the MCP task dir.

### 3.4 `task_get`

- **Mirrors:** `TaskGet`. Read-only.
- **Input schema:** `{ taskId: z.string() }`.
- **Output:** the full task object, or `isError: true` if not found.

### 3.5 Session id resolution inside the server — RESOLVED (Q3)

The MCP server is a long-lived stdio subprocess. **Empirically verified** that
Claude Code injects `CLAUDE_CODE_SESSION_ID` into the MCP server environment.[^5]

**Resolution:**

```typescript
const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
if (!sessionId) {
  throw new Error("CLAUDE_CODE_SESSION_ID not found in environment");
}
// Use sessionId to compute $TASK_UTILS_TASK_DIR/<sessionId>-mcp/
```

No fallback strategy needed. The server and hooks are guaranteed to agree on the
session directory.[^5]

### 3.5.1 Git auto-commit on write — NEW requirement 2

When the MCP server writes/updates/deletes a task file, it attempts to auto-commit:

```
git add $FILE
git commit -m "chore(tasks): {add|update|remove} task <id> <subject>"
git push origin
```

- **Message template** (no AI calls): conventional-commit format, templated
- **Best-effort**: Any failure (not a git repo, no remote, push rejected, etc.) is caught, logged, and the tool still succeeds. Task writes never fail on git.
- **Condition**: Only attempt git when the store is inside a git working tree.

See design note §2[^7] for command sequence, error handling, and implementation strategy.

---

## 4. Hook changes required

Both changes are small, backward compatible, and gated so existing built-in-task
setups see no behavior change.

### 4.1 `require-task-in-progress.sh`

- **Honor `TASK_UTILS_TASK_DIR`:** replace
  `TASKS_DIR="$CLAUDE_DIR/tasks/$SESSION_ID"` with resolution through the new
  store-root logic (§2.3).
- **Also count MCP tasks:** in addition to scanning the built-in
  `<store_root>/<session_id>/`, also scan the MCP dir `<session_id>-mcp/`. An `in_progress` task in either satisfies the write-gate.
- The `TASK_UTILS_REQUIRE_TASK=0` opt-out stays as-is — it becomes the
  belt-and-suspenders escape; the MCP server is the preferred fix.

### 4.2 `task-invariant.sh`

- **Honor `TASK_UTILS_TASK_DIR`** the same way.
- **No new tool matcher needed** — `task-invariant.sh` only matches
  `TaskCreate|TaskUpdate`; the MCP tools (`mcp__task-mcp__task_*`) are different
  tool names and will not trigger it. That is intentional: the MCP server
  enforces the invariants in-process (§3.2). The hook does NOT need to police MCP
  calls.
- **Counting behavior:** built-in `task-invariant.sh` counts only the built-in dir,
  the MCP server counts only the MCP dir. **Keep them separate** — mixing contexts
  can't happen (you either have the built-ins or you don't). This avoids cross-talk.

### 4.3 `hooks/hooks.json`

No change — the matchers stay `TaskCreate|TaskUpdate` and
`Write|Edit|MultiEdit|NotebookEdit`.

---

## 5. Repo-tracked task state — NEW requirement 1

When `TASK_UTILS_TASK_DIR` points into a git repo (e.g., `$CLAUDE_PROJECT_DIR/.claude/tasks`),
task state becomes a repo artifact. **Decision: keep storage session-scoped.**

See design note §1[^6] for detailed analysis. Summary:

- The hooks already support session-agnostic reads (they scan for `in_progress` across all subdirectories)
- Session-scoped storage (one dir per session) yields a clean, persistent audit trail
- Git commits per-session directories; over time the repo accumulates task history
- No flat renaming or session-id-prefixing needed
- Hook behavior is unchanged; only the store root becomes configurable

Example:

```
.claude/tasks/
  ├── abc-def-123/       (built-in task dir, session A)
  ├── abc-def-123-mcp/   (MCP task dir, session A) — auto-committed
  └── xyz-ghi-456-mcp/   (MCP task dir, session B, current)
```

---

## 6. File layout inside the plugin

```
plugins/claude-code/task-utils/
├── .claude-plugin/plugin.json      # unchanged (plugin metadata)
├── .mcp.json                       # NEW — declares the MCP server
├── hooks/
│   ├── hooks.json                  # unchanged
│   ├── require-task-in-progress.sh # edited (§4.1)
│   ├── task-invariant.sh           # edited (§4.2)
│   └── git-helper.ts               # NEW (§3.5.1) — git auto-commit logic
├── mcp/                            # NEW — the MCP server
│   ├── package.json                # deps: @modelcontextprotocol/sdk, zod
│   ├── bun.lock                    # shipped — `bun install --frozen-lockfile`
│   ├── build.sh                    # on-device build-if-missing (§7)
│   ├── launch.sh                   # MCP launch command — builds then execs (§7)
│   ├── prewarm.sh                  # SessionStart pre-warm of the build (§7)
│   ├── src/
│   │   ├── server.ts               # McpServer + registerTool calls + stdio
│   │   ├── store.ts                # store-root resolution, file read/write
│   │   ├── validation-steps.ts     # <validation-steps> parser (mirrors awk)
│   │   └── git-helper.ts           # git auto-commit helper
│   └── dist/task-mcp               # local-dev/CI compile output (gitignored)
├── skills/manage-tasks/SKILL.md    # may need a note about the MCP fallback
├── docs/                           # this research + plan + design notes
└── README.md                       # updated to document the fallback + env vars
```

`.mcp.json` (recommended, keeps `plugin.json` clean):

```json
{
  "mcpServers": {
    "task-mcp": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/mcp/dist/server.js"],
      "env": {
        "TASK_UTILS_TASK_DIR": "${TASK_UTILS_TASK_DIR}",
        "CLAUDE_CONFIG_DIR": "${CLAUDE_CONFIG_DIR}",
        "CLAUDE_PROJECT_DIR": "${CLAUDE_PROJECT_DIR}"
      }
    }
  }
}
```

> Passing `CLAUDE_CONFIG_DIR` and `TASK_UTILS_TASK_DIR` explicitly is necessary —
> `CLAUDE_CONFIG_DIR` is **not** auto-injected into MCP subprocesses.[^5]
> `CLAUDE_PROJECT_DIR` is documented to be injected.[^4]

---

## 7. Build and packaging

The repo's JS toolchain is **bun** (`mise.toml` pins `bun`).[^8]

> **Strategy changed (2026-05-21, handler directive).** The original plan chose
> **Strategy A — committed `bun build --target=node` bundle**. That has been
> superseded by **Strategy C — on-device native compile**. See
> [`docs/research/native-build-strategy.md`](../research/native-build-strategy.md)
> for the full rationale; summary below.

**Strategy C — on-device native binary (current).** The plugin ships the
TypeScript **source only** (`mcp/src/`, `package.json`, `bun.lock`). The
runnable artifact is a native executable produced by `bun build --compile`,
**built on the end user's machine on first use** — never committed.

- **Why not a committed bundle:** the handler directed that the build artifact
  not be committed. A `bun build --compile` binary is platform-specific anyway,
  so a single committed binary could not work cross-platform; on-device
  compilation is the correct fit.
- **Where the binary lives:** `${CLAUDE_PLUGIN_DATA}/bin/task-mcp` — the
  per-plugin persistent data dir, which **survives plugin updates** (unlike the
  ephemeral `${CLAUDE_PLUGIN_ROOT}`). The binary is keyed by plugin version
  (a `task-mcp.version` marker); a version bump triggers a one-time rebuild.
- **How the build is triggered:**
  - **Load-bearing:** `mcp/launch.sh` is the MCP server's launch `command`.
    It calls `mcp/build.sh` (build-if-missing) then `exec`s the binary — so the
    server can never launch without a binary.
  - **Optimisation:** a `SessionStart` hook (`mcp/prewarm.sh`) starts the same
    build in the background at session start, so the binary is usually ready
    before the MCP server connects.
- **Dependencies:** `mcp/build.sh` runs `bun install --frozen-lockfile` (from
  the shipped `bun.lock`) before `bun build --compile`. `--compile` inlines all
  deps + the runtime into the binary; no `node_modules` is needed afterwards.
- **Idempotency / loop-safety:** `build.sh` skips the build when an up-to-date
  binary exists, serialises concurrent invocations with an atomic `mkdir`
  directory lock, and writes the binary via temp-path + atomic `mv` so a killed
  build never leaves a half-written artifact.
- **Runtime requirement:** `bun` on `PATH` (to build). If absent, the build
  fails loudly with an actionable message.

`mise run build-task-mcp` runs the same `bun build --compile` for local-dev /
CI verification, emitting `mcp/dist/task-mcp` (gitignored — not shipped).

---

## 8. Testing strategy

1. **Unit — validation-steps parser.** Test `validation-steps.ts` against the
   same fixtures `task-invariant.sh`'s awk parser handles: unchecked/checked
   items, missing `RESULT` lines, tags-in-code-blocks, whitespace edges. The two
   parsers MUST agree.
2. **Unit — store resolution.** Assert the store-root logic resolves correctly
   for: no env, `CLAUDE_CONFIG_DIR` set, `TASK_UTILS_TASK_DIR` set, both set
   (override wins).
3. **Unit — git auto-commit.** Assert the git helper correctly stages, commits,
   and pushes; handles failures gracefully; logs errors.
4. **Integration — MCP protocol.** Drive the server over stdio with an MCP client
   (the SDK ships a client) and assert each tool's input/output and that
   `task_create` writes a correct `<id>.json`, `task_update` transitions enforce
   the invariants, `task_list`/`task_get` read back faithfully.
5. **Integration — hook satisfaction.** Create an `in_progress` MCP task, then run
   `require-task-in-progress.sh` with a `Write` payload and assert it now returns
   `allow` (the core acceptance criterion). Run it with no task and assert `deny`.
6. **Integration — invariant parity.** Assert `task_update` rejects the same
   transitions `task-invariant.sh` rejects (born-in_progress, second
   in_progress, missing validation-steps, incomplete steps), with matching prose.
7. **Manual — real Claude Code web session.** Install the plugin, confirm `/mcp`
   lists `task-mcp`, confirm the tools work and the write-gate is satisfiable
   end-to-end. This is the scenario the whole feature exists for.

All file-touching tests use a temp `TASK_UTILS_TASK_DIR` so they never write to a
real `~/.claude`.

---

## 9. Making changes take effect via the `claude` CLI

1. After editing the plugin, in a session run **`/reload-plugins`** — this
   reconnects `task-mcp` and re-points hooks to the new `${CLAUDE_PLUGIN_ROOT}`.[^4]
2. Verify the server with **`/mcp`** — `task-mcp` should be listed with a
   plugin indicator.[^4]
3. For a clean check, start `claude --debug` — MCP initialization errors surface
   there.[^4]
4. For consumers installing fresh:
   `claude plugin install task-utils@agents` (per the existing README).[^9]
5. A plugin **version bump** in `.claude-plugin/plugin.json` is required so
   installed copies pick up the new MCP server on update.

---

## 10. Out of scope / follow-ups

- Extracting the validation-steps parser into a shared spec consumed by both the
  hook and the server (noted §3.2).
- Any change to `manage-tasks/SKILL.md` doctrine beyond a short note that an MCP
  fallback exists.
- Supporting transports other than stdio.
- v2 SDK migration (`@modelcontextprotocol/server`) — revisit when v2 is stable.
- Auto-commit failure monitoring and feedback (noted in design note §3[^7]).

---

## 11. Reviewer decision checklist

- [x] **Q1** — "distinct id" = distinct session-directory (`<session_id>-mcp/`)? **CONFIRMED**
- [x] **Q2** — new env var `TASK_UTILS_TASK_DIR`, overrides whole `<config>/tasks` path, relocates both built-in and MCP dirs? **CONFIRMED**
- [x] **Q3** — MCP server learns session id via `CLAUDE_CODE_SESSION_ID` environment variable? **CONFIRMED via empirical verification**[^5]
- [x] **NEW requirement 1** — When `TASK_UTILS_TASK_DIR` points into a git repo, keep storage session-scoped. **DECIDED & DOCUMENTED**[^6]
- [x] **NEW requirement 2** — Git auto-commit + push on task write. **DESIGNED & DOCUMENTED**[^7]
- [x] Runtime `node` vs `bun`: **RESOLVED** — the server is now an on-device
      `bun build --compile` native binary (Strategy C, §7). No `node`/`bun`
      runtime is needed to _run_ the binary; `bun` is needed once to _build_ it.
- [ ] `.mcp.json` file vs inline `mcpServers` in `plugin.json`. **Recommendation: separate `.mcp.json`**
- [ ] Should built-in `task-invariant.sh` count MCP tasks toward 0-or-1, or stay isolated? **Recommendation: isolated**

---

[^1]: `task-utils` hooks — [`require-task-in-progress.sh`](https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/hooks/require-task-in-progress.sh), [`task-invariant.sh`](https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/hooks/task-invariant.sh)

[^2]: `task-utils` README + `require-task-in-progress.sh` opt-out comment — [`README.md`](https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/README.md)

[^3]: Claude Code docs — "Migrate to Task tools": <https://code.claude.com/docs/en/agent-sdk/todo-tracking>

[^4]: Claude Code docs — "Plugins reference" §MCP servers / "Connect Claude Code to tools via MCP": <https://code.claude.com/docs/en/plugins-reference>, <https://code.claude.com/docs/en/mcp>

[^5]: Empirical verification — [`docs/research/q3-session-id-verification.md`](../research/q3-session-id-verification.md). Test: Node.js subprocess confirms `CLAUDE_CODE_SESSION_ID` is present in environment; `CLAUDE_CONFIG_DIR` is not auto-injected.

[^6]: Design decision — [`docs/research/repo-storage-design.md`](../research/repo-storage-design.md). Analysis: hooks already support session-agnostic reads; session-scoped storage yields clean git audit trail; no flat renaming needed.

[^7]: Design — [`docs/research/git-auto-commit-design.md`](../research/git-auto-commit-design.md). Git helper wraps `add` + `commit` + `push` with best-effort error handling; task writes never fail on git; logged for debugging.

[^8]: Repo toolchain — [`mise.toml`](https://github.com/nsheaps/agents/blob/main/mise.toml)

[^9]: `task-utils` plugin README — [`README.md`](https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/README.md)
