# MCP Comms Relay — Connector & Auth Requirements (Research)

**Date:** 2026-05-30
**Status:** Research / grounding for the MCP comms relay design.
**Scope note:** This captures the **deployment-agnostic** requirements that any
relay must satisfy to be addable to claude.ai as a custom connector. The chosen
deployment is a **self-hosted Docker container behind a `cloudflared` (Cloudflare
Tunnel) sidecar**, authored in `nsheaps/agents`. A Cloudflare Workers + Durable
Objects deployment was *considered and not chosen* (notes at the end) — but its
OAuth/MCP findings are deployment-independent and apply here too.

---

## 1. What claude.ai requires to add a remote MCP server as a "custom connector"

- **Availability:** Custom connectors are available on Free (limit 1), Pro, Max,
  Team, Enterprise. On Team/Enterprise only Owners add org-wide connectors.
- **Transport:** **Streamable HTTP** is the required baseline for new builds (a
  single HTTPS endpoint, e.g. `https://relay.example.com/mcp`, handling POST for
  messages and GET for the SSE stream). Legacy HTTP+SSE is deprecated.
- **Auth:** **OAuth 2.1 with PKCE, `S256` mandatory.** Claude always sends
  `code_challenge_method=S256`; the AS must advertise
  `"code_challenge_methods_supported": ["S256"]`. Authorization-code flow + user
  consent. **Not supported:** static bearer tokens, `?token=` query-string
  tokens, pure `client_credentials` (no user consent).
- **OAuth callback (claude.ai web/desktop):** `https://claude.ai/api/mcp/auth_callback`
- **Token endpoint** must accept `Content-Type: application/x-www-form-urlencoded`.
- **Auth spec versions accepted:** 2025-03-26, 2025-06-18, 2025-11-25. Target
  **2025-11-25** for new builds (requires RFC 9728 Protected Resource Metadata).

Sources:
- [Get started with custom connectors — Claude Help Center](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Building custom connectors — Claude docs](https://claude.com/docs/connectors/building)
- [Authentication for connectors — Claude docs](https://claude.com/docs/connectors/building/authentication)
- [Transports — MCP spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)

---

## 2. MCP authorization flow the relay must implement (RFC chain)

Post-June-2025 spec: **the MCP server is a resource server only**; a separate
authorization server (AS) issues tokens. For a single self-hosted relay we can
co-locate both roles in one container, but the *endpoints* below must exist.

1. Unauthenticated MCP request → server returns **HTTP 401** with a
   `WWW-Authenticate` header pointing at the Protected Resource Metadata URL.
2. Client fetches **PRM** `/.well-known/oauth-protected-resource` (RFC 9728):
   contains `resource` (must exactly match server URL) + `authorization_servers`.
3. Client fetches **AS metadata** `/.well-known/oauth-authorization-server`
   (RFC 8414): contains `authorization_endpoint`, `token_endpoint`,
   `registration_endpoint`, `code_challenge_methods_supported: ["S256"]`.
4. Client obtains a client_id — via **DCR** (RFC 7591 `POST /register`), CIMD, or
   pre-registered creds (configurable in the connector "Advanced settings").
5. PKCE: client builds `code_verifier`/`code_challenge` (S256).
6. Authorization-code flow → user consents → `code` → `POST /token` with
   `code_verifier` → `access_token` (+ `refresh_token`, rotate for public clients).
7. MCP requests carry `Authorization: Bearer <token>`.

Required endpoints to expose on the relay:
`/mcp` (Streamable HTTP), `/.well-known/oauth-protected-resource`,
`/.well-known/oauth-authorization-server`, `/authorize`, `/token`, `/register`.

Security: PKCE S256 mandatory, HTTPS only (cloudflared terminates TLS), token
never in query string, exact redirect-URI matching, validate `Origin`
(DNS-rebinding protection).

Sources:
- [Authorization — MCP spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [Authorization for MCP: OAuth 2.1, PRMs — OSO](https://www.osohq.com/learn/authorization-for-ai-agents-mcp-oauth-21)
- [Diving into the MCP Authorization Spec — Descope](https://www.descope.com/blog/post/mcp-auth-spec)

---

## 3. Practical limits that shape the relay tools

| Constraint | Limit | Implication |
|---|---|---|
| Max tool result (claude.ai / Desktop) | ~150,000 chars | Keep message/peer-list payloads small; paginate |
| Max tool result (Claude Code) | 25,000 tokens (`MAX_MCP_OUTPUT_TOKENS`) | Same |
| Tool handler timeout (claude.ai / Desktop) | 300 s | Enables long-poll `receive`/`wait_for_message` up to ~300 s |
| Tool handler timeout (Claude Code) | `MCP_TOOL_TIMEOUT` | Same |

**Receive model:** claude.ai's agent only acts when it calls a tool, so async
server→client notifications are unreliable for driving the model. Design
`receive`/`wait_for_message` as a **long-poll** (block up to ~the tool timeout,
return immediately when a message is queued).

---

## 4. MCP TypeScript SDK (for the relay server + any client tooling)

- **Package:** `@modelcontextprotocol/sdk` (v1.x line; verify latest on npm,
  ~1.12.x stable as of early 2026). **Do not use v2** (pre-alpha).
- Remote server transport: `StreamableHTTPServerTransport`
  (`@modelcontextprotocol/sdk/server/streamableHttp.js`).
- High-level server: `McpServer` (`@modelcontextprotocol/sdk/server/mcp.js`).
- Stdio (only if a local stdio shim is ever wanted): `StdioServerTransport`.
- Zod is a required peer dep for input schemas (v1).
- **stdout is reserved for JSON-RPC on stdio transports — log to stderr only.**

Sources:
- [modelcontextprotocol/typescript-sdk (GitHub)](https://github.com/modelcontextprotocol/typescript-sdk)
- [npm: @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [Build an MCP server — modelcontextprotocol.io](https://modelcontextprotocol.io/docs/develop/build-server)

---

## 5. Deployment decision

**Chosen:** self-hosted Node/Bun container running the MCP relay (Streamable HTTP
+ OAuth endpoints + broker state), with a `cloudflared` sidecar providing the
public HTTPS hostname. Docker-compose-droppable, authored in `nsheaps/agents`,
mirroring the `cloudflared` pattern from `nsheaps/portainer-stacks`.

**Considered, not chosen — Cloudflare Workers + Durable Objects:** viable
(`workers-oauth-provider` + `McpAgent`, DO-per-session, 32 MiB WS messages), but
the handler wants a container they can drop into compose with cloudflared rather
than a Workers deployment. Relevant if we ever want a serverless variant.

Sources:
- [Build a Remote MCP server — Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Building an MCP server with OAuth and Cloudflare Workers — Stytch](https://stytch.com/blog/building-an-mcp-server-oauth-cloudflare-workers/)

---

## 6. Open design questions (to resolve in the spec)

- **Symmetry:** the handler wants *both* agent sides to connect, advertise,
  discover peers, and handshake. Simplest model: **both sides are MCP clients of
  the same relay** (claude.ai via custom connector; a local Claude Code agent via
  a remote-MCP entry). No local stdio bridge needed — only the relay is public
  (via cloudflared); both agents dial out to it.
- **Broker state:** cross-session registry (peers/rooms/queues). In-memory for
  MVP; persistence (SQLite/Redis) later if needed.
- **Local WS/second-leg auth:** if any non-OAuth leg exists, it needs its own
  auth (shared secret / JWT). With the all-MCP-clients model, every leg is OAuth.
- **Identity/consent for a single user:** OAuth issuer can be a minimal built-in
  AS (single user) or delegate to an upstream IdP. MVP: built-in single-user AS.
