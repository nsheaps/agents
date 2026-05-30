---
title: "MCP Comms Relay"
status: draft
version: "0.1.0"
created: 2026-05-30
updated: 2026-05-30
pr: "nsheaps/agents#TBD"
---

## Reader Guide

**Audience:** the handler (Nate), plus engineers/agents implementing the relay.

**How to read this spec:** Narrative sections describe intent and the chosen
architecture. `Given/When/Then` blocks are the testable acceptance criteria —
review those for correctness. **Phasing** at the end is the implementation order;
nothing past Phase 1 starts until the prior phase is verified.

---

## Problem

The handler wants to exchange messages (and later, files) between two AI agents
that sit on opposite sides of a network boundary — e.g. an agent on **claude.ai**
(web) and a **local Claude Code** agent — without either side running a publicly
reachable server. claude.ai can only talk to a remote MCP server registered as a
**custom connector**, which _requires_ a public HTTPS endpoint with OAuth. The
handler does not want to expose their local machine, and has no signaling server.

The need: a single, small, **publicly reachable relay** that both agents _dial
out to_, advertise themselves on, discover each other, handshake, and then
exchange messages through. The relay is the only public component; both agents
are clients. Public reach is provided by **`cloudflared`** (Cloudflare Tunnel),
so no inbound ports or public IP are needed on the host running the relay.

**Explicitly out of scope (separate concern):** file sharing. The protocol
should leave room for it, but this spec does not implement file transfer.

## Requirements

1. A relay service that exposes an **MCP server over Streamable HTTP** at a
   stable HTTPS URL, suitable to add to claude.ai as a **custom connector**.
2. **OAuth 2.1 + PKCE (S256)** in front of the MCP endpoint, with the full
   discovery chain claude.ai requires (PRM → AS metadata → authorize/token,
   plus DCR). See `docs/research/mcp-comms-relay-requirements.md`.
3. The relay is a **rendezvous + broker**: any connected agent can `advertise`
   itself, `discover` peers, `handshake` with a peer, and `send`/`receive`
   messages. Both sides are symmetric MCP clients.
4. **Both agents dial out** — neither needs to be publicly accessible. Only the
   relay is public (via `cloudflared`).
5. Shipped as a **Docker container + a docker-compose stack** (relay +
   `cloudflared`) that is droppable into compose, authored in `nsheaps/agents`,
   mirroring the `cloudflared` + `1password` init-secrets pattern used in
   `nsheaps/portainer-stacks`.
6. Single-user / single-room for the MVP. Multi-user, persistence, and file
   sharing are explicitly deferred.

## Design

### Topology

```
   claude.ai (custom connector)            local Claude Code (remote MCP entry)
        │  HTTPS Streamable HTTP                 │  HTTPS Streamable HTTP
        │  OAuth 2.1 + PKCE                      │  OAuth 2.1 + PKCE
        └───────────────┬───────────────────────┘
                        ▼
              cloudflared (Tunnel)            ← public hostname, TLS
                        │  (shared docker bridge network "cloudflared")
                        ▼
              mcp-comms-relay container
                ├─ MCP server (Streamable HTTP) at /mcp
                ├─ OAuth 2.1 AS + resource metadata
                └─ in-memory broker (peers, rooms, message queues)
```

Both agents are **MCP clients**. There is **no local stdio bridge** — that was an
earlier design; with a central dial-out relay it is unnecessary.

### Components (all authored in `nsheaps/agents`)

| Component                              | Location                                              | Purpose                                                                                           |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Relay service                          | `services/mcp-comms-relay/`                           | TS service: MCP-over-Streamable-HTTP + OAuth + broker. Image → `ghcr.io/nsheaps/mcp-comms-relay`. |
| Deploy stack                           | `services/mcp-comms-relay/deploy/docker-compose.yaml` | Droppable compose: relay + `cloudflared` + `init-secrets`.                                        |
| Connector plugin _(Phase 4, optional)_ | `plugins/mcp-comms/`                                  | Thin helper so a local Claude Code agent adds the relay as a remote MCP server (config/skill).    |

Tooling: Bun + TypeScript + `tsc`/Nx per repo convention; `@modelcontextprotocol/sdk`
(v1.x) for the MCP server (`StreamableHTTPServerTransport`, `McpServer`); `zod`
for tool input schemas.

### MCP tools (the relay protocol)

| Tool        | Input                                    | Behavior                                                                                                                           |
| ----------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `advertise` | `{ name, capabilities?, room? }`         | Register the caller as a peer in a room (default `"default"`). Returns `{ peer_id, room }`. Refreshes presence (heartbeat).        |
| `discover`  | `{ room? }`                              | List currently-advertised peers in the room: `{ peer_id, name, capabilities, last_seen, pending_handshakes }`.                     |
| `handshake` | `{ to_peer_id }` or `{ accept_peer_id }` | Initiate or accept a pairing. On mutual acceptance returns a `channel_id`.                                                         |
| `send`      | `{ channel_id, text }`                   | Enqueue a text message to the peer on that channel. Returns `{ message_id }`.                                                      |
| `receive`   | `{ channel_id?, wait_seconds? }`         | **Long-poll** (default ~25s, max ~280s to stay under the 300s tool timeout). Returns queued messages, draining the caller's inbox. |

Notes:

- Identity = OAuth subject + MCP session id. A peer entry is bound to a session;
  presence expires after a TTL if not refreshed (handles disconnects).
- `receive` is long-poll because claude.ai's model only acts when it calls a
  tool; server-initiated notifications are unreliable for driving the model.
- Payloads kept small (claude.ai caps tool results at ~150k chars).
- File sharing would later extend `send` with attachment references — **not now.**

### OAuth (MVP)

A minimal built-in **single-user** authorization server co-located in the relay:

- Endpoints: `/.well-known/oauth-protected-resource` (RFC 9728),
  `/.well-known/oauth-authorization-server` (RFC 8414), `/authorize`, `/token`,
  `/register` (DCR, RFC 7591).
- Authorization-code flow + PKCE **S256** + a single consent screen gated by one
  shared credential (the handler's). Refresh-token rotation for public clients.
- Signing/secret material fetched at runtime from 1Password via the init-secrets
  container (see Deployment). Target auth spec version **2025-11-25**.
- "Both sides with the OAuth configs" = each agent authenticates through this
  flow; claude.ai uses the connector OAuth UI, local Claude Code uses its remote-
  MCP OAuth support.

### Deployment (mirrors portainer-stacks `cloudflared` pattern)

- `cloudflared` is a **shared-network hub**, not a per-app sidecar. The relay
  joins an external bridge network named `cloudflared`; the public hostname →
  relay route is configured in the Cloudflare dashboard tunnel ingress rules.
- An `init-secrets` container (`1password/op:2`, run as root) fetches the tunnel
  token and the relay's OAuth secret from `op://heapsinfra/<deployer>--<host>--mcp-comms-relay/<field>`
  into a named volume; app containers mount it read-only.
- `restart: unless-stopped` on the relay; `depends_on init-secrets:
service_completed_successfully`; healthcheck hitting the relay's `/healthz`.
- The droppable compose ships **in `agents`** with the service. **Open item:**
  production deploy infra (Arcane auto-discovery, `OP_SERVICE_ACCOUNT_TOKEN` as a
  global var) currently lives in `nsheaps/iac` (`arcane/hosts/<host>/...`). If/when
  the handler wants this production-deployed via Arcane, add a thin
  `arcane/hosts/<host>/mcp-comms-relay/compose.yaml` in `iac` that pulls the
  `ghcr.io/nsheaps/mcp-comms-relay` image. This spec authors everything in
  `agents` per the handler's direction; the iac wiring is a follow-up.

### Security

- TLS terminated by `cloudflared`; relay listens HTTP on the internal network.
- PKCE S256 mandatory; tokens never in query string; exact redirect-URI match;
  validate `Origin` (DNS-rebinding protection).
- Single shared room + single user for MVP keeps the attack surface minimal.
- Secrets only via 1Password init-secrets; none committed.

## Acceptance Criteria

### Scenario: OAuth discovery chain is well-formed

**Given** the relay is running behind its public hostname
**When** an MCP client makes an unauthenticated request to `/mcp`
**Then** it receives `401` with a `WWW-Authenticate` header referencing
`/.well-known/oauth-protected-resource`, whose document points to AS metadata
advertising `code_challenge_methods_supported: ["S256"]` and the
authorize/token/register endpoints.

### Scenario: claude.ai can add the relay as a custom connector

**Given** the public hostname and OAuth endpoints are live
**When** the handler adds the URL as a custom connector on claude.ai and completes
the OAuth consent
**Then** the connector shows as connected and the relay's tools
(`advertise`, `discover`, `handshake`, `send`, `receive`) are available.

### Scenario: two agents advertise and discover each other

**Given** two authenticated agents (e.g. claude.ai + local Claude Code) connected
to the relay
**When** each calls `advertise` with a name in the same room
**Then** each agent's `discover` lists the other peer with name, capabilities, and
a recent `last_seen`.

### Scenario: handshake establishes a channel

**Given** peers A and B are advertised in the same room
**When** A calls `handshake({ to_peer_id: B })` and B calls
`handshake({ accept_peer_id: A })`
**Then** both receive the same `channel_id`.

### Scenario: messages flow both directions

**Given** A and B share a `channel_id`
**When** A calls `send({ channel_id, text: "hello" })` and B calls
`receive({ channel_id })`
**Then** B receives the "hello" message exactly once, and a reply from B is
likewise delivered to A's `receive`.

### Scenario: receive long-polls without busy-waiting

**Given** an empty inbox on a channel
**When** an agent calls `receive({ channel_id, wait_seconds: 25 })`
**Then** the call blocks up to ~25s and returns promptly when a message arrives,
never exceeding the connector's 300s tool timeout.

### Scenario: presence expires on disconnect

**Given** peer A advertised then disconnected without un-advertising
**When** A's presence TTL elapses
**Then** A no longer appears in B's `discover` results.

### Scenario: stack is droppable with cloudflared

**Given** the compose stack and a configured Cloudflare tunnel + 1Password item
**When** `docker compose up` runs the stack
**Then** `init-secrets` completes, `cloudflared` connects the tunnel, the relay
passes its healthcheck, and the public hostname serves the MCP endpoint.

## Phasing

- **Phase 0 — Scaffold + spec (this PR).** Spec (this doc) + `services/mcp-comms-relay/`
  skeleton (package, tsconfig, Dockerfile, `/healthz`).
- **Phase 1 — Relay core (authless).** Streamable-HTTP MCP server + in-memory
  broker + the five tools. Verified locally with the MCP SDK client (two
  sessions handshake + exchange messages). No OAuth yet.
- **Phase 2 — OAuth 2.1 layer.** PRM/AS metadata/authorize/token/register +
  PKCE S256 single-user AS. Verified: discovery 401 chain + a real claude.ai
  custom-connector add.
- **Phase 3 — Containerize + deploy.** Dockerfile → ghcr; droppable compose with
  `cloudflared` + `init-secrets`. Verified end-to-end: claude.ai ↔ local agent
  handshake + message exchange over the public tunnel.
- **Phase 4 _(optional)_ — Connector helper plugin.** `plugins/mcp-comms/` to
  make local Claude Code agents add the relay in one step.
- **Deferred:** file sharing; multi-user/multi-room; persistence (SQLite/Redis);
  Arcane production wiring in `iac`.

## References

- Research: `docs/research/mcp-comms-relay-requirements.md` (connector + OAuth
  requirements, limits, MCP SDK, sources).
- Convention research (not committed; scratch): `.claude/tmp/explore-mcp-relay-conventions.md`
  (agents repo) and the portainer-stacks `cloudflared` pattern.
- [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [claude.ai custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
