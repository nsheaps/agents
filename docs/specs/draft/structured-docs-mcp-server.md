# Structured Documents as MCP Tools + Resources Server

**Status**: Draft
**Created**: 2026-02-18
**Author**: Road Runner (Researcher)
**Research**: [docs/research/mcp-shell-and-docs-servers-research.md](../research/mcp-shell-and-docs-servers-research.md)

---

## Problem & Requirements

### Problem

Organizations need to distribute rules, standards, and documentation to AI agents working across projects. Current approaches have fundamental trade-offs:

1. **CLAUDE.md / rules files**: Always in context but limited to the project they're in. No cross-project sharing. No way to serve a subset based on relevance.
2. **Skills**: Good for "how to do X" but not designed for "always remember these rules." Content is only loaded when the skill is invoked.
3. **MCP tools (existing servers like rules-mcp)**: Content delivered on-demand via tool calls, but **tool descriptions don't contain the rules themselves** — meaning the agent doesn't know the rules exist until it explicitly calls the tool.
4. **MCP resources**: Discoverable via `resources/list` but content requires explicit fetch. Resources are passive — agents must choose to read them.

The core tension: **rules that must always be visible** (like "never push to main") vs **documents too large to always be in context** (like a full security policy).

### The Dual-Channel Solution

Use MCP's two content mechanisms strategically:

- **Tool descriptions** contain critical rule summaries — these are always visible in the tool listing, even when Claude Code uses deferred tool loading. The description itself carries the most important rules.
- **Resources** contain full document content — fetched on demand when the agent needs the complete text.

This means: even if the agent never calls the tool, it has seen the critical rules in the tool description. If it needs details, it calls the tool or reads the resource.

### Requirements

1. **Directory-based auto-discovery**: Point at a directory of Markdown files with YAML frontmatter. Each document becomes a tool + resource pair.
2. **Rule summaries in tool descriptions**: The `description` field of each MCP tool contains the document's critical rules/summary — visible in tool listings without calling the tool.
3. **Full content via resources**: Each document is also exposed as an MCP resource at a predictable URI (e.g., `docs://security/full`).
4. **Frontmatter-driven configuration**: Each document declares its tool name, summary (for the description), tags, and whether it's always-apply.
5. **Tag/glob filtering**: Tools for listing and filtering documents by tag or file glob pattern.
6. **Standard MCP transport**: stdio for Claude Code, optionally SSE/HTTP.

### Non-Requirements

- **Not a search engine** — no embeddings, no semantic search. This is for known, structured documents, not ad-hoc discovery.
- **Not a CMS** — documents are files on disk, edited by humans. The server is read-only.
- **Not a replacement for CLAUDE.md** — CLAUDE.md handles project-specific context. This server handles cross-project organizational standards.

### Prior Art

| Project | Approach | Gap |
|:--------|:---------|:----|
| [rules-mcp](https://github.com/rules-mcp/rules-mcp) | Markdown + frontmatter, tag filtering, `alwaysApply` | Tools-only (no resources). Descriptions describe the tool, not the rules. |
| [claude-critical-rules-mcp](https://github.com/optimaquantum/claude-critical-rules-mcp) | Rules in tool descriptions as forcing function | Hardcoded to 21 specific rules, not configurable |
| [library-mcp](https://github.com/lethain/library-mcp) | Markdown knowledge base, tag/date retrieval | Tools-only. Descriptions describe the tool's function, not the content. |
| [docs-mcp-server](https://github.com/arabold/docs-mcp-server) | Semantic search over docs from multiple sources | Overkill for internal rules. Requires embedding provider. |
| [MCPRules](https://github.com/bartwisch/MCPRules) | Category-based programming guidelines | No dual-channel pattern. Tools-only. |

**Key gap**: No existing project puts rule summaries in tool descriptions AND serves full content via resources.

---

## Technical Design

### Document Frontmatter Convention

```markdown
---
tool: security-rules
summary: |
  CRITICAL RULES — Always enforce:
  - Never commit secrets or credentials to git
  - Use environment variables for all sensitive configuration
  - Validate and sanitize all user input at system boundaries
  - No raw SQL queries — use parameterized queries only
  - Apply principle of least privilege for all service accounts
  Call this tool for the complete security policy.
tags: [security, critical, always-apply]
alwaysApply: true
---

# Security Policy

## 1. Credential Management

Never store credentials in source code, configuration files, or environment
variable defaults. All secrets must be managed through a secrets manager
(e.g., AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault).

[... full 300-line policy ...]
```

**Frontmatter fields**:

| Field | Type | Required | Purpose |
|:------|:-----|:---------|:--------|
| `tool` | string | Yes | MCP tool name (unique identifier) |
| `summary` | string (multiline) | Yes | Placed directly in the MCP tool `description`. This is what the agent always sees. |
| `tags` | string[] | No | For filtering and categorization |
| `alwaysApply` | boolean | No | If true, full content included in initial context (via a prompt or resource) |
| `globs` | string[] | No | File patterns this document applies to (e.g., `["**/*.ts"]`) |

### Architecture

```
┌─────────────────────────────────────────┐
│  MCP Client (Claude Code)               │
│                                         │
│  tools/list → sees descriptions with    │
│               critical rule summaries   │
│                                         │
│  tools/call → gets full document +      │
│               practical guidance        │
│                                         │
│  resources/read → fetches raw content   │
│                   by URI                │
└──────────┬──────────────────────────────┘
           │ stdio / SSE
┌──────────▼──────────────────────────────┐
│  structured-docs-mcp-server             │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Scanner     │  │ Document Cache  │   │
│  │ (reads      │→ │ (tool name →    │   │
│  │  docs/)     │  │  frontmatter +  │   │
│  └─────────────┘  │  content)       │   │
│                   └────────┬────────┘   │
│                            │            │
│  Tools exposed:            │            │
│  ├── <tool-name>          ←┘            │
│  │   description: <summary from FM>     │
│  │   returns: full document content     │
│  ├── list-documents                     │
│  │   description: "List available docs" │
│  │   params: { tags?, glob? }           │
│  └── search-documents                   │
│      description: "Search doc content"  │
│      params: { query }                  │
│                                         │
│  Resources exposed:                     │
│  ├── docs://<tool-name>/full            │
│  ├── docs://<tool-name>/summary         │
│  └── docs://index                       │
└─────────────────────────────────────────┘
```

### How Dual-Channel Works in Practice

**Step 1**: Claude Code starts, connects to MCP server, calls `tools/list`.

The response includes:
```json
{
  "name": "security-rules",
  "description": "CRITICAL RULES — Always enforce:\n- Never commit secrets...\n- Use environment variables...\nCall this tool for the complete security policy.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

The agent now **always has** the critical security rules visible — even if it never calls the tool. Even with deferred tool loading, the description survives `ToolSearch`.

**Step 2**: When the agent needs the full policy (e.g., before a security-related change), it either:
- Calls `security-rules` tool → gets the full 300-line document as tool output
- Reads `docs://security-rules/full` resource → same content via resource protocol

**Step 3**: `list-documents` and `search-documents` tools help the agent discover what rules exist when working on unfamiliar topics.

### Implementation Approach

**Language**: TypeScript (using `@modelcontextprotocol/sdk`)

**Core modules**:

1. **Scanner** (`scanner.ts`): Reads a directory, parses YAML frontmatter from each `.md` file, validates required fields.
2. **Registry** (`registry.ts`): Maps tool names to documents. Generates MCP tool definitions with `summary` as `description`. Generates MCP resource definitions.
3. **Handlers** (`handlers.ts`):
   - `tools/list` → returns all document tools + utility tools (list, search)
   - `tools/call` for document tool → returns full markdown content
   - `tools/call` for `list-documents` → returns filtered document index
   - `tools/call` for `search-documents` → simple text search across content
   - `resources/list` → returns resource URIs for all documents
   - `resources/read` → returns document content or summary
4. **Server** (`server.ts`): MCP server setup, transport configuration.

### Configuration

```yaml
# config.yaml
docs_dir: ./rules
transport: stdio
watch: true           # re-scan on file changes
resource_prefix: docs # URI prefix (docs://...)
```

### Claude Code Integration

```json
// .mcp.json
{
  "mcpServers": {
    "org-rules": {
      "command": "npx",
      "args": ["structured-docs-mcp-server", "--config", "./rules/config.yaml"]
    }
  }
}
```

### Phases

| Phase | Scope | Deliverable |
|:------|:------|:------------|
| **v0.1** | Static scanning, tools with summaries in descriptions, resource URIs, stdio | Core dual-channel server |
| **v0.2** | File watching, `list-documents` with tag/glob filtering, `search-documents` | Discovery and filtering |
| **v0.3** | `alwaysApply` documents auto-included via MCP prompts, glob-based contextual loading | Smart context management |

### Why This Matters for Claude Code Specifically

1. **Deferred tool loading**: Claude Code loads a subset of tools initially and defers others. Tool descriptions survive deferral — they're shown when `ToolSearch` finds the tool. Rule summaries in descriptions ensure critical rules are always discoverable.
2. **Context budget**: Full documents (300+ lines) are expensive in the context window. The dual-channel approach keeps summaries cheap (5-10 lines in description) and full content on-demand.
3. **Cross-project consistency**: Unlike CLAUDE.md (per-project), an MCP server can serve the same rules to every project the developer works on.
4. **Team distribution**: MCP servers can be configured at the organization level via managed settings, ensuring every team member's agent has access to the same standards.

### Open Questions

1. **Should `alwaysApply` docs use MCP prompts or be included as resources in the system message?** MCP has a `prompts/` capability — could `alwaysApply` documents be served as prompts that Claude Code automatically includes?
2. **How should document updates propagate?** File watching can trigger resource change notifications, but can tool descriptions be updated mid-session? (Probably not — see plugin research on hot-reload limitations.)
3. **Should this be combined with the shell-scripts server?** Both use directory scanning + frontmatter. A single server serving both scripts-as-tools and docs-as-tools would reduce MCP server count.
4. **Naming**: `structured-docs-mcp-server`? `org-rules-mcp`? `dual-channel-docs`?

### References

- [MCP Specification — Tools](https://spec.modelcontextprotocol.io/specification/server/tools/)
- [MCP Specification — Resources](https://spec.modelcontextprotocol.io/specification/server/resources/)
- [rules-mcp](https://github.com/rules-mcp/rules-mcp) — Markdown frontmatter pattern
- [claude-critical-rules-mcp](https://github.com/optimaquantum/claude-critical-rules-mcp) — Rules-in-descriptions pattern
- [library-mcp](https://github.com/lethain/library-mcp) — Markdown knowledge base retrieval
- [Claude Code deferred tool loading](https://code.claude.com/docs/en/how-claude-code-works) — Why tool descriptions matter for discoverability
- [Plugin hot-reload research](../research/plugin-install-research-source.md) — What reloads and what doesn't
