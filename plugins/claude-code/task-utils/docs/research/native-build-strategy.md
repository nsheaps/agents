# Research / Report — task-utils MCP server: native on-device build strategy

**Status:** IMPLEMENTED — 2026-05-21.
**Scope:** changes the build & packaging of the `task-utils` plugin's MCP
server (`task-mcp`). Server behavior is unchanged — this is a build/packaging
change only.

Supersedes "Strategy A — committed bundled artifact" from
[`docs/plans/mcp-task-server.md` §7](../plans/mcp-task-server.md).

---

## 1. The change

| Aspect         | Before (Strategy A)                             | After (Strategy C)                                         |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Build command  | `bun build src/server.ts --target=node`         | `bun build --compile --outfile … src/server.ts`            |
| Artifact       | `mcp/dist/server.js` — a node-target JS bundle  | `task-mcp` — a single **native executable**                |
| Committed?     | Yes — `dist/server.js` was committed to git     | **No** — `dist/` is gitignored; binary is never committed  |
| Built where    | Once, by a maintainer, before commit            | **On the end user's machine, on first use**                |
| Runtime needs  | `bun`/`node` on PATH to interpret the JS bundle | nothing — the binary is self-contained                     |
| Launch command | `bun ${CLAUDE_PLUGIN_ROOT}/mcp/dist/server.js`  | `bash ${CLAUDE_PLUGIN_ROOT}/mcp/launch.sh` (builds, execs) |

Directive: the handler overrode the prior committed-bundle design and required
(1) a `bun build --compile` native binary, (2) `dist/` gitignored — the binary
never committed, (3) the build to happen on the end user's machine on first use.

## 2. Why on-device compilation is correct

A `bun build --compile` binary embeds a platform-specific runtime — it is built
for one OS/arch (e.g. `ELF x86-64` on Linux, a Mach-O binary on macOS). A
single committed binary therefore **cannot** serve every consumer of the
plugin. The only way to ship a native binary across platforms is to compile it
on each machine. On-device compilation is not a workaround here; it is the
correct consequence of choosing a native binary.

## 3. Where the binary lives — and why

The compiled binary is written to:

```
${CLAUDE_PLUGIN_DATA}/bin/task-mcp
${CLAUDE_PLUGIN_DATA}/bin/task-mcp.version   # version marker
```

`${CLAUDE_PLUGIN_DATA}` is the per-plugin **persistent state dir** — it
**survives plugin updates**, unlike `${CLAUDE_PLUGIN_ROOT}` which is overwritten
on every update.[^plugins] Storing the binary there means a plugin update does
not, by itself, force a rebuild.

**Staleness is handled by version-keying.** Because `CLAUDE_PLUGIN_DATA`
persists, a binary built from an old plugin version would otherwise be reused
after a code change. To prevent that, the binary is keyed by the installed
plugin version: `build.sh` reads `version` from
`${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`, and compares it to the
`task-mcp.version` marker. A version bump → marker mismatch → one-time rebuild.
The `task-utils` plugin version is therefore bumped (`0.1.2 → 0.1.3`) as part
of this change, in both `plugin.json` and the repo-root `marketplace.json`.

When `CLAUDE_PLUGIN_DATA` is not set (older Claude Code, or hand runs), the
scripts fall back to `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugin-data/task-utils`.

## 4. How the on-device build is triggered

Two mechanisms, both calling the **same** idempotent `build.sh`:

1. **`mcp/launch.sh` — load-bearing.** This is the MCP server's launch
   `command` in `.mcp.json`. It calls `build.sh` (build-if-missing) and only
   then `exec`s the binary. Because it _is_ the launch command, the server can
   never start without a binary — there is no hook-ordering race to lose. On
   the first run it builds; on every subsequent run `build.sh` returns
   immediately and `launch.sh` `exec`s the binary directly.

2. **`mcp/prewarm.sh` — optimisation.** Registered as a `SessionStart` hook in
   `hooks/hooks.json`. It starts `build.sh` **detached in the background** and
   returns instantly, so the session is never blocked on a compile. Its purpose
   is to have the binary ready _before_ the MCP server connects, avoiding a
   slow first connection. It is not relied on for correctness — `launch.sh` is.

If `launch.sh` and `prewarm.sh` run concurrently (likely — MCP connect and
SessionStart happen at roughly the same time), the lock in `build.sh` (§6)
ensures exactly one builds and the other waits.

### First-connection latency note

On a cold machine, if the MCP server connects before the pre-warm build
finishes, `launch.sh` blocks on the build before `exec`ing. A long first build
could exceed the MCP client's init timeout, in which case that one session's
`task-mcp` may be marked unavailable — but the build still completes in the
background, so **every subsequent session connects fast**. The degradation is
graceful and self-healing; no committed artifact is needed to avoid it.

## 5. Dependency handling

`bun build --compile` inlines all dependencies into the binary, but it still
needs them resolved on disk at build time. `build.sh` therefore runs
`bun install --frozen-lockfile` (falling back to `bun install`) in
`${CLAUDE_PLUGIN_ROOT}/mcp/` before compiling — using the shipped `bun.lock`
for a reproducible dependency set (`@modelcontextprotocol/sdk`, `zod`). The
resulting `node_modules/` is transient build scratch in the ephemeral plugin
dir; once the binary is compiled it is no longer needed at runtime.

## 6. Idempotency & loop-safety

`build.sh` is safe to call any number of times, concurrently:

- **Up-to-date fast path** — if `task-mcp` exists, is executable, and
  `task-mcp.version` matches the current plugin version, it exits 0 immediately.
- **Atomic directory lock** — `mkdir "$LOCK_DIR"` is atomic; exactly one racer
  wins and builds, the rest wait (polling for the binary, up to 600 s) then
  `exec` the same binary. A stale lock (older than 600 s, from a crashed build)
  is detected and stolen.
- **Atomic publish** — the binary is compiled to `task-mcp.tmp.$$` and
  `mv`d into place; the version marker is written only after the `mv`. A
  killed/crashed build never leaves a half-written binary that the up-to-date
  check would wrongly accept.
- **Lock cleanup** — a `trap … EXIT` removes the lock dir even on failure, so a
  failed build does not deadlock future runs.

## 7. Files changed

| File                                             | Change                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `mcp/build.sh`                                   | **new** — on-device build-if-missing (lock-guarded, version-keyed)      |
| `mcp/launch.sh`                                  | **new** — MCP launch command: build then `exec`                         |
| `mcp/prewarm.sh`                                 | **new** — SessionStart background build pre-warm                        |
| `mcp/dist/server.js`                             | **removed** — committed bundle no longer shipped                        |
| `mcp/.gitignore`                                 | now ignores `dist/` (and `node_modules/`); nothing committed            |
| root `.gitignore`                                | dropped the `!…/task-utils/mcp/dist/` exception                         |
| `.mcp.json`                                      | `command` → `bash …/mcp/launch.sh`; added `CLAUDE_PLUGIN_DATA` to `env` |
| `hooks/hooks.json`                               | added the `SessionStart` → `prewarm.sh` hook                            |
| `mcp/package.json`                               | `build` script → `--compile`; `main` → `dist/task-mcp`; version `0.1.3` |
| `mcp/src/server.ts`                              | `isMain` → `import.meta.main` (compiled-binary safe); `SERVER_VERSION`  |
| `mcp/test/integration.test.ts`                   | drives the compiled binary directly instead of `bun dist/server.js`     |
| `mcp/test/hook-integration.test.sh`              | runs the compiled binary directly; guards on its existence              |
| `mise.toml` (`build-task-mcp`)                   | `--compile` → `dist/task-mcp`                                           |
| `.claude-plugin/plugin.json`, `marketplace.json` | `task-utils` version `0.1.2 → 0.1.3`                                    |
| `README.md`, `docs/plans/mcp-task-server.md`     | document the new build flow                                             |

The `isMain` change is necessary: a `bun build --compile` binary's entrypoint
path is the binary itself, not `server.js`, so the old `argv[1].endsWith(
"server.js")` check would never fire and `main()` would not run.
`import.meta.main` is correct for compiled binaries, `bun run`, and tests alike.

## 8. Verification (2026-05-21)

All run from a clean state (`dist/` + `node_modules` + plugin-data deleted):

- **(a) Native compile** — `build.sh` from a fully clean state ran
  `bun install` + `bun build --compile` and produced
  `${CLAUDE_PLUGIN_DATA}/bin/task-mcp`; `file` reports
  `ELF 64-bit LSB executable, x86-64` — a native binary, not a JS bundle.
- **(b) Server starts + responds over stdio** — `launch.sh` (the MCP launch
  command) started the server; an `initialize` + `tools/list` exchange returned
  `serverInfo.name = "task-mcp"`, `version = "0.1.3"`, and all four tools
  (`task_create`, `task_update`, `task_list`, `task_get`).
- **(c) Second run skips the rebuild** — a second `launch.sh` invocation
  produced empty build stderr (no `bun install`, no `compile`) and `exec`d the
  existing binary directly.
- **Version-keying** — overwriting the marker with `0.0.1` forced a rebuild;
  the marker was restored to `0.1.3`.
- **Concurrency** — three `build.sh` racers from a cold state: exactly one
  built, two waited on the lock, all exited 0, the lock dir was cleaned up.
- **Full suite** — `mise run check` green: 66/66 unit tests pass, all 7
  hook-integration tests pass (including the core acceptance criterion — an
  MCP-created `in_progress` task satisfies the `require-task-in-progress.sh`
  write-gate), lint clean.

## 9. Out of scope / follow-ups

- Old per-version binaries are not garbage-collected from
  `${CLAUDE_PLUGIN_DATA}/bin/` (only the current `task-mcp` name is reused, so
  there is at most one binary; no cleanup needed in practice).
- Bumping the MCP client init timeout to fully eliminate the cold-first-build
  latency window (§4) — left to the user's environment; documented instead.

---

[^plugins]:
    Claude Code docs — "Plugins reference" §Plugin path variables:
    `${CLAUDE_PLUGIN_ROOT}` changes on plugin update; `${CLAUDE_PLUGIN_DATA}` is
    persistent per-plugin state. <https://code.claude.com/docs/en/plugins-reference>
