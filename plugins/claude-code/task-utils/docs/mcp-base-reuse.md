# MCP base reuse — task-utils → ticket-utils

The `task-utils` MCP server (`mcp/`) is built so the SAME base scaffolding can
back a future `ticket-utils` MCP server without forking the plumbing. This note
documents the reuse boundary so a future ticket-utils server is a thin
re-skin, not a copy-paste.

## What is already generic (reuse verbatim)

These modules/scripts contain no task-specific assumptions and can be reused as-is
by a ticket-utils server:

- **`mcp/src/git-helper.ts` — best-effort auto-commit/push engine.**
  `tryGitAutoCommit(storeRoot, filePath, operation, commitMessage)` is fully
  decoupled: it takes the commit message as a parameter. The only task-flavoured
  piece is `buildCommitMessage()` (which emits `chore(tasks): …`). A ticket-utils
  server supplies its own `buildCommitMessage` (e.g. `chore(tickets): …`) and
  calls the same `tryGitAutoCommit`. `TaskOperation` (`create|update|delete`) is a
  generic CRUD verb set and applies unchanged.
- **`mcp/src/store.ts` — flat-file store + git-root resolution.**
  `gitRepoRoot()`, `resolveStoreRoot()`, the `TaskStore` read/write/list/remove/
  `nextId()` mechanics, and `compareIds()` are all format-agnostic YAML-file
  CRUD. To re-skin for ticket-utils: parameterise the env-var name
  (`TASK_UTILS_TASK_DIR`), the store sub-path (`.claude/tasks`), and the record
  type/`source` tag. Everything else carries over.
- **`mcp/build.sh`, `mcp/launch.sh`, `mcp/prewarm.sh` — on-device build/launch.**
  These are keyed off `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` and the plugin
  version, with an atomic build-lock and build-if-missing. None of it is
  task-specific — only the binary name (`task-mcp`) and the plugin-data subdir
  would change for ticket-utils.
- **`server.ts` bootstrap** — the `createServer()` / `StdioServerTransport` /
  `import.meta.main` entrypoint pattern and the `jsonResult` / `errorResult`
  helpers are reusable boilerplate.

## What is task-specific (re-implement per server)

- **`mcp/src/tasks.ts`** — the task lifecycle/invariant engine (0-or-1
  in_progress, validation-steps gating, RESULT-cite gating). ticket-utils would
  have its own state machine.
- **`mcp/src/validation-steps.ts`** — task validation-step parsing.
- **`server.ts` tool registrations** — `task_create/update/list/get`. ticket-utils
  registers its own `ticket_*` tools.
- **`TaskRecord` / `TaskStatus` types and the `source: "task-utils-mcp"` tag** in
  `store.ts`.

## Recommended path for ticket-utils (do later — not built here)

1. Lift `git-helper.ts` (minus the task-flavoured `buildCommitMessage`),
   `store.ts` (parameterised), and the build/launch/prewarm scripts into a shared
   base — either a small internal package or a copied `mcp/base/` the two servers
   share by convention.
2. ticket-utils provides: its record type + status enum, a `buildCommitMessage`
   for `chore(tickets):`, its lifecycle engine, and its tool registrations.

This PR intentionally does NOT build ticket-utils or pre-extract a shared package
— that would be speculative. It only keeps the boundary clean and documents it so
the extraction is low-risk when ticket-utils is actually scoped.
