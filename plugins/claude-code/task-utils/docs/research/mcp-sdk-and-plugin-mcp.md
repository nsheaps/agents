# Research — MCP TypeScript SDK and bundling an MCP server in a Claude Code plugin

Research output for the `task-utils` MCP-task-server feature. Covers (a) the
official Model Context Protocol TypeScript SDK and (b) how a Claude Code plugin
declares and bundles an MCP server.

---

## 1. The official MCP TypeScript SDK

### 1.1 Package and version

- Package: **`@modelcontextprotocol/sdk`** — the production-recommended v1 line.[^1]
- Latest v1 release at time of research: **v1.29.0** (2026-03-30).[^1]
- Install: `npm install @modelcontextprotocol/sdk zod`.[^1]
- A **v2** of the SDK exists (pre-alpha, split into `@modelcontextprotocol/server`
  and `@modelcontextprotocol/client`), with a stable release anticipated Q1 2026.[^1] **This plan targets v1** (`@modelcontextprotocol/sdk`) per the feature
  brief; v2 is noted only so the version pin is a deliberate choice.

### 1.2 Server API (v1)

The high-level server class is `McpServer`, and the local-process transport is
`StdioServerTransport`. Import paths (v1):[^2]

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
```

Minimal server skeleton (verbatim from the v1 SDK server docs):[^2]

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
// ... register tools, resources, prompts ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 1.3 Defining a tool — `registerTool`

`registerTool` takes three arguments: a tool name, a config object, and an async
handler.[^2] The config object accepts `title`, `description`, `inputSchema`, and
`outputSchema`.[^2]

> "The `inputSchema` is defined as a **zod raw shape object** — a plain object
> mapping field names to zod types (e.g. `{ name: z.string() }`), not a wrapped
> `z.object()`."[^2]

Example config shape from the docs (a BMI calculator):[^2]

> `inputSchema: { weightKg: z.number(), heightM: z.number() }` and
> `outputSchema: { bmi: z.number() }`

### 1.4 Tool handler return value and error signalling

A handler returns a result object whose `content` array holds typed items; the
standard text response is `{ content: [{ type: 'text', text: result }] }`.[^2] To
signal a failed tool call, **set `isError: true`** in the result.[^2] Verbatim
error-handling example:[^2]

```typescript
server.registerTool(
  "risky-operation",
  { description: "An operation that might fail" },
  async () => {
    try {
      const result = await doSomething();
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  },
);
```

### 1.5 Transport choice for this feature

`StdioServerTransport` is the right transport: the server runs as a **local
child process** of Claude Code, communicating JSON-RPC over stdin/stdout. Claude
Code documents stdio servers as "local processes ... ideal for tools that need
direct system access or custom scripts."[^3] The MCP-task-server needs direct
filesystem access (to write task JSON files), so stdio fits.

---

## 2. Bundling an MCP server in a Claude Code plugin

### 2.1 Two declaration locations

A plugin declares MCP servers either in a top-level `.mcp.json` in the plugin
root, or inline in `plugin.json` under an `mcpServers` key.[^4]

> "**Location**: `.mcp.json` in plugin root, or inline in plugin.json. **Format**:
> Standard MCP server configuration."[^4]

`.mcp.json` form (verbatim):[^4]

```json
{
  "mcpServers": {
    "plugin-database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": {
        "DB_PATH": "${CLAUDE_PLUGIN_ROOT}/data"
      }
    }
  }
}
```

Inline-in-`plugin.json` form (verbatim):[^4]

```json
{
  "name": "my-plugin",
  "mcpServers": {
    "plugin-api": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/api-server",
      "args": ["--port", "8080"]
    }
  }
}
```

The `plugin.json` `mcpServers` field accepts `string | array | object` — config
paths or inline config.[^4]

### 2.2 Path variables available to a plugin MCP server

Three variables are substituted in MCP server `command`/`args`/`env` and are also
exported as environment variables to the server subprocess:[^4]

| Variable                | Meaning                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | absolute path to the plugin's installation dir. **Changes on plugin update** — do not write state here.[^4] |
| `${CLAUDE_PLUGIN_DATA}` | a per-plugin **persistent state** dir that survives plugin updates.[^4]                                     |
| `${CLAUDE_PROJECT_DIR}` | the project root (same value hooks get).[^4]                                                                |

`CLAUDE_PROJECT_DIR` is set in the _server's_ environment; in plugin-provided MCP
configs `${CLAUDE_PROJECT_DIR}` substitutes directly (project/user-scoped
`.mcp.json` files need a `${CLAUDE_PROJECT_DIR:-.}` default, plugins do not).[^3]

### 2.3 Persisting Node dependencies across updates

Because `${CLAUDE_PLUGIN_ROOT}` is ephemeral, the docs show a pattern for keeping
`node_modules` in `${CLAUDE_PLUGIN_DATA}`: a hook diffs the bundled `package.json`
against the copy in `CLAUDE_PLUGIN_DATA`, runs `npm install` there when they
differ, and the MCP server runs with `NODE_PATH` pointed at the persisted
modules:[^4]

```json
{
  "mcpServers": {
    "routines": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"],
      "env": {
        "NODE_PATH": "${CLAUDE_PLUGIN_DATA}/node_modules"
      }
    }
  }
}
```

This matters for packaging strategy — see the plan doc; an alternative is to
**bundle dependencies into a single file** at build time so no `node_modules` is
needed at runtime.

### 2.4 Lifecycle

- "Plugin MCP servers start automatically when the plugin is enabled."[^4]
- "At session startup, servers for enabled plugins connect automatically. If you
  enable or disable a plugin during a session, run `/reload-plugins` to connect or
  disconnect its MCP servers."[^3]
- When a plugin updates mid-session, MCP servers keep using the old
  `${CLAUDE_PLUGIN_ROOT}`; `/reload-plugins` switches them to the new path.[^4]
- Plugin servers appear in `/mcp` with an indicator showing they come from a
  plugin; their tools appear as standard MCP tools.[^4]

### 2.5 Tool naming

MCP tools from a plugin server are namespaced. Claude Code names MCP tools
`mcp__<server>__<tool>` (the form used in `permissions.allow`, e.g. the user's
`mcp__sequential-thinking__*`). For a plugin server keyed `task-mcp` with a tool
`task_create`, the tool surfaces as `mcp__task-mcp__task_create`. The general
`mcp__server__tool` naming convention is established Claude Code behavior; the
exact prefix a _plugin_-provided server gets (whether the plugin name is part of
it) is **unverified** and should be confirmed via `/mcp` after a test install.

### 2.6 Plugin precedence and merge

In the scope-precedence list, plugin-provided servers sit below local/project/user
scopes; plugins match duplicates "by endpoint."[^3] MCP servers from multiple
sources combine under their own merge rules.[^4]

---

## 3. CLI commands relevant to making changes take effect

- `/reload-plugins` (in-session slash command) — reconnects a plugin's MCP servers
  after the plugin is enabled/disabled or updated.[^3][^4]
- `claude --debug` — "shows initialization errors" for MCP servers; the docs list
  it as the way to read MCP server logs.[^4]
- `/mcp` (in-session) — lists all MCP servers including plugin ones.[^4]
- `claude plugin install <plugin>@<marketplace>` — installs the plugin (already
  documented in the plugin README).[^5]

Plugin-provided MCP servers are **not** added with `claude mcp add` — that command
manages local/project/user-scoped servers in `~/.claude.json` or `.mcp.json`.[^3]
Plugin servers are declared inside the plugin and activated by enabling the plugin.

---

## 4. Open verification items

- [ ] **unverified** — the exact `mcp__...` tool-name prefix a plugin-provided
      server's tools receive (does it include the plugin name, the server key, or
      both?). Confirm via `/mcp` and a permissions test after a trial install.
- [ ] **unverified** — whether `CLAUDE_PLUGIN_DATA` is populated on Claude Code
      web the same way as in the desktop CLI.
- [ ] **unverified** — whether a plugin MCP server's stdio process inherits
      `CLAUDE_CONFIG_DIR` from Claude Code's environment (needed so the server writes
      task files where the hooks read them). The docs confirm `CLAUDE_PROJECT_DIR` is
      injected;[^3] `CLAUDE_CONFIG_DIR` injection is not documented — assume it must
      be passed explicitly via the server's `env` block or a new override var.

---

[^1]: MCP TypeScript SDK README — <https://github.com/modelcontextprotocol/typescript-sdk> (package `@modelcontextprotocol/sdk`, v1.29.0)

[^2]: MCP TypeScript SDK v1 server docs — <https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/docs/server.md>

[^3]: Claude Code docs — "Connect Claude Code to tools via MCP": <https://code.claude.com/docs/en/mcp>

[^4]: Claude Code docs — "Plugins reference" §MCP servers, §Plugin path variables: <https://code.claude.com/docs/en/plugins-reference>

[^5]: `task-utils` plugin README — [`README.md`](https://github.com/nsheaps/agents/blob/main/plugins/claude-code/task-utils/README.md)
