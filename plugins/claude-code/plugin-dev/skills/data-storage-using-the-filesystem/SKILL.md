---
name: Data Storage Using the Filesystem
description: >
  This skill should be used when the user asks about "how to store data in a plugin",
  "what file format to use for plugin storage", "YAML vs JSON in a plugin",
  "how to keep task files in sync", "streaming storage", "frontmatter metadata",
  "data storage for hooks", "writing files in MCP servers", "concurrent writes in plugin storage",
  "file format selection", "storing plugin state", or "persistent data in Claude Code plugins".
version: 0.1.0
---

# Data Storage Using the Filesystem

## Purpose

Defines the conventions for how Claude Code plugins, hooks, MCP servers, and agents store persistent
data on the filesystem. Covers file format selection, metadata conventions, path discipline,
concurrency, sync, and streaming boundaries.

---

## Storage Format Preference Order

**YAML > JSON5 > Markdown-with-frontmatter > JSON**

Only deviate from this order when a specific constraint forces it (e.g., a wire protocol requires
JSON, or a tool only parses TOML).

| Format | Use When |
|--------|----------|
| YAML | Default for structured data: task files, config, plugin state |
| JSON5 | Config files where comments are needed but tooling only supports JSON-like syntax |
| Markdown-with-frontmatter | Docs, plans, specs — when prose + queryable metadata both needed |
| JSON | Wire protocols, MCP stdio, external APIs that require it |
| TOON/TRON | Streaming tool output where structured types are needed (narrow case) |
| XML / SQLite | Special cases only — structured queries across many records, or existing schema |

---

## File Sizing

Keep files small. Prefer many small files over a few large ones.

**Why:**
- **Grep / embeddings**: Large files produce low-precision hits; small files are O(1) to scan
- **Context window**: Agents load files into context — large files bloat the window
- **Write contention**: A single large file is a contention point for concurrent writers
- **Diffs**: Small files produce readable, reviewable diffs

Rule of thumb: if a file exceeds ~300 lines, split it. Store each logical record in its own file
(e.g., one task per file, one spec per file). Use an INDEX file or directory structure for discovery.

---

## Metadata Storage

### For Markdown files

Store metadata as YAML frontmatter at the top of the file:

```markdown
---
id: "42"
status: in_progress
created_at: 2026-05-23T10:00:00Z
---

Free-form prose content here.
```

### For non-Markdown files (scripts, config, YAML data)

Use a comment-block frontmatter at the file head, after any shebang:

```yaml
# ---
# schema_version: 1
# created_by: task-utils
# ---
id: "42"
status: in_progress
```

### Schema discipline

- **Define the schema explicitly.** Extra fields are not queryable unless declared.
- Use `yq` or `jq` for structured queries against stored data.
- Document the schema in the plugin's `docs/` or a `references/` file.
- Prefer flat structures (fewer nesting levels) for grep-ability.

---

## YAML: Pros, Cons, and Conventions

### Pros

- Comments (`#`) — documents intent inline without breaking parsers
- Multi-document support (`---` separator) — stream multiple records per file
- References and anchors (`&anchor` / `*alias`) — reduce repetition in config
- JSON superset — valid JSON is valid YAML
- Human-readable diffs — block scalars and newlines are preserved
- Structured types: strings, numbers, booleans, nulls, sequences, mappings — no ambiguity

### Cons

- **Token cost** — YAML is verbose; large YAML files consume more context tokens than compact JSON
- **No atomic in-place edit** — YAML must be rewritten in full; use copy-swap for safe updates
  (write to `<file>.tmp`, then `mv <file>.tmp <file>`)
- **JSONL conversion required** for RPC formats** — MCP stdio protocol, HTTP streaming, and other
  line-delimited transports need JSONL, not YAML; convert at the boundary

### YAML style in task/data files

- Use block style (`key: value\n`) not flow style (`{key: value}`)
- Multi-line strings: prefer `|` (literal) or `|-` (literal, strip trailing newline)
- String IDs: always quote numeric-looking IDs (`id: "42"`, not `id: 42`)
- Status values: never quote (`status: in_progress`, not `status: "in_progress"`)

---

## YAML → JSONL at Streaming / RPC Boundaries

When outputting to a line-delimited protocol (MCP stdio, HTTP streaming, shell pipelines):

1. **Convert YAML → JSON** at the output boundary using `yq` or a serialization layer
2. **One JSON object per line** (JSONL / NDJSON format)
3. Never write YAML to an RPC wire protocol

**YAML list → JSONL mapping:**

```yaml
# YAML (storage)
- id: "1"
  status: completed
- id: "2"
  status: in_progress
```

```jsonl
{"id":"1","status":"completed"}
{"id":"2","status":"in_progress"}
```

**Tradeoff:** Per-row streaming (JSONL) loses formatted-document output (comments, structure).
Use YAML on disk; produce JSONL only at the wire boundary.

For streaming tool output where structured types with type metadata are needed, consider
TOON/TRON format (see `references/streaming-formats.md`).

---

## Markdown with Frontmatter

Use when both prose content and queryable metadata are needed:

- **Plans, specs, docs** — human-readable body + machine-queryable metadata
- **Task files with rich descriptions** — status, ID, dates in frontmatter; notes in body

```markdown
---
id: "42"
subject: Fix the authentication bug
status: in_progress
created_at: 2026-05-23T10:00:00Z
---

## Work Log

2026-05-23T10:00:00Z — Started investigation.
```

Query frontmatter with `yq` (treats the YAML block as a document):

```bash
yq -y '.status' task-42.yaml   # Returns "in_progress"
```

---

## Known Paths and Path Discipline

**Always store data in known paths**, built from well-known environment variables:

| Variable | Use For |
|----------|---------|
| `$CLAUDE_PROJECT_DIR/.claude/tasks/` | Task files (flat, one per ID) |
| `$CLAUDE_PROJECT_DIR/.claude/logs/` | Hook and daemon log files |
| `$CLAUDE_PROJECT_DIR/.claude/tmp/` | Disposable intermediate files |
| `$CLAUDE_PLUGIN_ROOT/data/` | Plugin-level persistent state |
| `$CLAUDE_PLUGIN_DATA/` | Plugin data dir (if supported by runtime) |
| `$HOME/.claude/tasks/<session_id>/` | Legacy built-in Task tool per-session store |

**Never use random temp paths** (`/tmp/<uuid>/`) for persistent data. Temp paths are invisible to
git, invisible to other agents, and are deleted on reboot.

**Commit persistent data.** Task files, plugin state, and index files belong in git. This enables:
- Cross-agent visibility (other agents can pull and see state)
- History and auditability
- Recovery after session restart

---

## Concurrency: Copy-Swap Pattern

YAML files cannot be atomically edited in place. Use copy-swap for safe concurrent writes:

```bash
# Write to a temp file, then atomically replace
yq -y '. + {"status": "completed"}' "$task_file" > "${task_file}.tmp"
mv "${task_file}.tmp" "$task_file"
```

For higher contention (multiple agents writing the same directory), prefer a daemon or MCP server
that serializes writes (see Sync Model section below).

---

## Sync Model

### Default: fetch-before-edit, push-after-write

1. Before editing any task file: `git pull --ff-only` from the repo root
2. Write the file (copy-swap pattern)
3. Immediately after write: `git add <file> && git commit -m "chore(tasks): ..." && git push`

This keeps the flat store visible to all agents. If two agents race, one will get a non-fast-forward
error on push; the losing agent must pull, re-apply, and push again.

### Preferred: daemon or MCP server

A daemon that owns the store directory (writes-on-change, syncs in the background) is more robust
than per-agent git operations:

- The daemon serializes writes, eliminating race conditions
- Agents call the daemon's API (tool call or HTTP) instead of touching files directly
- The daemon handles git operations transparently

The task-utils MCP server (`plugins/claude-code/task-utils/mcp/`) is an example of this pattern.

### Conflict resolution

When a merge conflict occurs in a task file:
- Do NOT auto-resolve by picking "ours" or "theirs"
- Emit a structured error with both versions
- A designated conflict-resolver sub-agent (baked into the plugin) reconciles them
- The conflict-resolver is never the writing agent — separation of concerns

### Alternative: network filesystem

For high-concurrency teams, consider a network filesystem (NFS, FUSE-mounted object store) instead
of synced local storage. Agents read/write directly; the filesystem handles consistency.

---

## Programmatic Updates (Agent Last Resort)

Agents should rarely touch storage files directly. Prefer:

1. **Hooks** — fire on tool events, write side-effects automatically
2. **Daemon/MCP** — agent calls a tool; daemon writes the file
3. **Background poller** — daemon watches for changes, writes on interval

If an agent must write directly:
- Only after configurable-retry exhaustion (e.g., daemon unavailable)
- On failure, emit a detailed error message so the agent knows whether escalation will help
- Never silently swallow write errors

---

## Storage Plugins and External APIs

Plugins can expose storage as an API:

- Provide a `jq`-like query interface where possible: `task_query({filter: ".status == 'in_progress'"})` 
- Storage plugins wrap external APIs (S3, GCS, Notion, etc.) transparently
- Agents use the same tool interface regardless of backend
- The plugin handles serialization format differences at the boundary

---

## Additional Resources

### Reference Files

For detailed information on specific topics, consult:

- **`references/storage-formats.md`** — Detailed YAML vs JSON5 vs Markdown-frontmatter vs JSON comparison, with examples
- **`references/sync-and-concurrency.md`** — Copy-swap pattern, daemon/MCP architecture, conflict resolution strategies
- **`references/streaming-formats.md`** — TOON/TRON, JSONL, per-row vs formatted-document tradeoffs

### Related Plugins

- **`plugins/claude-code/task-utils/`** — Reference implementation: YAML flat store, MCP server, git auto-commit hooks
