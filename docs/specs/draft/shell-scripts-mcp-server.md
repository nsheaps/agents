# Shell Scripts as MCP Tools Server

**Status**: Draft
**Created**: 2026-02-18
**Author**: Road Runner (Researcher)
**Research**: [docs/research/mcp-shell-and-docs-servers-research.md](../research/mcp-shell-and-docs-servers-research.md)

---

## Problem & Requirements

### Problem

Agent teams and AI-assisted workflows frequently need to execute shell scripts — spawning agents, managing infrastructure, running builds, querying system state. Today these scripts are invoked via the `Bash` tool with hand-typed commands, which means:

1. **No discoverability** — the agent must already know the script exists and how to call it
2. **No type safety** — parameters are passed as unstructured strings, leading to errors
3. **No security boundary** — any script can run any command; there's no constraint layer
4. **No schema for the LLM** — the model has to guess parameters rather than receiving a typed tool definition

### Requirements

1. **Directory-based auto-discovery**: Point the server at a directory of `.sh` (or `.bash`, `.py`, etc.) scripts. Each script becomes an MCP tool automatically.
2. **Schema from frontmatter**: Each script declares its name, description, and typed parameters via structured comments (analogous to JSDoc for bash).
3. **Input validation**: Parameters are validated against the schema before the script executes. Support for required/optional, types (string, number, boolean), and defaults.
4. **Security constraints**: Optional CEL or simple expression-based constraints to prevent path traversal, command injection, or out-of-bounds values.
5. **Standard MCP transport**: Serve via stdio (for Claude Code integration) and optionally SSE/HTTP for remote use.
6. **Language-agnostic**: Scripts can be any executable — bash, python, node, etc. The server doesn't interpret the script, just executes it.
7. **Parameter passing convention**: Parameters passed as environment variables (e.g., `$name`, `$role`) — simple, universal, no special runtime needed in scripts.

### Non-Requirements (Explicit Exclusions)

- **Not a general shell** — this is NOT "run any command." Only pre-registered scripts with schemas are exposed.
- **Not an execution sandbox** — sandboxing is out of scope for v1. Scripts run with the server's permissions.
- **Not a workflow engine** — no chaining, no DAGs, no conditional execution between tools.

### Prior Art

| Project | Approach | Gap |
|:--------|:---------|:----|
| [MCPShell](https://github.com/inercia/MCPShell) | YAML config per tool, CEL constraints, Go binary | No auto-discovery — requires manual YAML per tool |
| [mcptools proxy](https://github.com/f/mcptools) | One-liner tool registration, env var params | No auto-discovery, no schema files, no constraints |
| [mcp-framework](https://github.com/QuantGeekDev/mcp-framework) | TypeScript auto-discovery from `tools/` dir | Discovers TS modules, not shell scripts |
| Various mcp-shell-server projects | Raw shell execution with allowlists | "Run any command" pattern, not structured tools |

**Key gap**: No existing project auto-discovers scripts from a directory and generates MCP tool schemas from structured comments.

---

## Technical Design

### Script Frontmatter Convention

Scripts declare their MCP tool metadata via structured comments at the top of the file:

```bash
#!/usr/bin/env bash
# @tool spawn-agent
# @description Spawn a new agent in the team with a specified role
# @param name:string:required Agent display name
# @param role:string:required Agent role (researcher, engineer, etc.)
# @param model:string:optional Model to use (default: sonnet)
# @constraint name != ""
# @constraint role in ["researcher", "engineer", "qa", "docs", "ops"]

set -euo pipefail
echo "Spawning agent: $name with role: $role using model: ${model:-sonnet}"
```

**Frontmatter tags**:

| Tag | Format | Required | Purpose |
|:----|:-------|:---------|:--------|
| `@tool` | `name` | Yes | MCP tool name (must be unique) |
| `@description` | free text | Yes | Tool description visible to the LLM |
| `@param` | `name:type:required\|optional description` | No | Parameter definition |
| `@constraint` | expression | No | Validation expression (v2) |
| `@timeout` | seconds | No | Max execution time (default: 30) |

### Architecture

```
┌──────────────────────────────────────┐
│  MCP Client (Claude Code)            │
│  ← tools/list, tools/call →          │
└──────────┬───────────────────────────┘
           │ stdio / SSE
┌──────────▼───────────────────────────┐
│  shell-scripts-mcp-server            │
│                                      │
│  ┌─────────────┐  ┌───────────────┐  │
│  │ Scanner     │  │ Schema Cache  │  │
│  │ (watches    │→ │ (tool name →  │  │
│  │  scripts/)  │  │  JSON Schema) │  │
│  └─────────────┘  └───────┬───────┘  │
│                           │          │
│  ┌────────────────────────▼───────┐  │
│  │ Executor                       │  │
│  │ - Validates params vs schema   │  │
│  │ - Sets env vars from params    │  │
│  │ - Spawns script as subprocess  │  │
│  │ - Captures stdout as result    │  │
│  │ - Enforces timeout             │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### Implementation Approach

**Language**: TypeScript (using `@modelcontextprotocol/sdk`)

**Why TypeScript over Go/Rust**: The MCP TypeScript SDK is the most mature and best-documented. MCPShell proves Go works, but the TS ecosystem is where Claude Code plugins and MCP servers are predominantly built.

**Core modules**:

1. **Scanner** (`scanner.ts`): Reads a directory, parses `@tool` frontmatter from each script, generates JSON Schema for parameters. Optionally watches for file changes via chokidar.
2. **Registry** (`registry.ts`): Maps tool names to script paths + schemas. Handles `tools/list` responses.
3. **Executor** (`executor.ts`): On `tools/call`, validates params against schema, sets env vars, spawns the script via `child_process.spawn`, captures stdout/stderr, enforces timeout.
4. **Server** (`server.ts`): MCP server setup with stdio transport. Registers tool handlers from Registry.

### Configuration

```yaml
# config.yaml
scripts_dir: ./tools
transport: stdio
default_timeout: 30
watch: true          # re-scan on file changes
shell: /bin/bash     # default shell for .sh files
env:                 # extra env vars for all scripts
  TEAM_NAME: looney-tunes
```

### Claude Code Integration

```json
// .mcp.json
{
  "mcpServers": {
    "team-scripts": {
      "command": "npx",
      "args": ["shell-scripts-mcp-server", "--config", "./tools/config.yaml"]
    }
  }
}
```

### Phases

| Phase | Scope | Deliverable |
|:------|:------|:------------|
| **v0.1** | Static scanning, stdio transport, env var params, basic types | Working MCP server that discovers scripts and exposes as tools |
| **v0.2** | File watching, timeout enforcement, stderr handling | Auto-reload when scripts change |
| **v0.3** | Constraint expressions, structured output parsing (JSON stdout) | Security layer and richer tool responses |

### Open Questions

1. **Should scripts return structured data?** If a script outputs JSON, should the server parse it and return structured tool results? Or always return raw text?
2. **How to handle scripts that need stdin?** Initial design assumes no stdin — all input via env vars. Interactive scripts are out of scope.
3. **Should this be a standalone npm package or part of ai-mktpl?** A standalone package has broader utility. Could be published as `shell-scripts-mcp-server` on npm.

### References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCPShell](https://github.com/inercia/MCPShell) — YAML config approach, CEL constraints
- [mcptools](https://github.com/f/mcptools) — proxy mode for quick registration
- [mcp-framework](https://github.com/QuantGeekDev/mcp-framework) — directory-based auto-discovery pattern
- [MCP Specification — Tools](https://spec.modelcontextprotocol.io/specification/server/tools/)
