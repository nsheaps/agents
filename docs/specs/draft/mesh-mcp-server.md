# Mesh MCP Server PRD

## Status: Draft

**Author**: Road Runner (Researcher)
**Date**: February 2026
**Task**: #52

---

## 1. Problem Statement

Claude Code agent teams today communicate through a file-based inbox system (`~/.claude/teams/{team}/inboxes/`). Messages are JSON arrays in flat files, polled by recipients. This has fundamental limitations:

- **No real-time delivery** — agents poll for new messages, introducing latency
- **No presence awareness** — no way to know if an agent is online or reachable
- **No message delivery guarantees** — `SendMessage` silently succeeds even when the recipient doesn't exist ([team-storage-internals.md](../../research/team-storage-internals.md))
- **No grouping** — all agents share one flat namespace; no subsets or channels
- **No cross-machine support** — file-based communication requires shared filesystem
- **No external event integration** — webhooks, CI events, and external triggers can't inject messages

The mesh MCP server provides a real-time communication layer between agents, replacing or supplementing the file-based inbox with a network-capable, presence-aware, group-capable messaging system.

## 2. Vision

Each agent connects to a shared MCP server that provides:

1. **Real-time messaging** between any connected agents
2. **Presence tracking** — know which agents are online
3. **Group channels** — agents can join subsets for scoped communication
4. **Authentication** — agents must authenticate to connect
5. **Cross-network reach** — agents in different k8s clusters or machines can communicate
6. **MCP-native interface** — exposed as MCP tools/resources, consumable by any MCP-compatible client

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Mesh MCP Server                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Presence  │  │ Message  │  │ Group/Channel     │  │
│  │ Manager   │  │ Router   │  │ Manager           │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Auth     │  │ File     │  │ Hook Integration  │  │
│  │ Module   │  │ Dumper   │  │ Bridge            │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                      │
│  Transport Layer: Socket.io (primary)                │
│  + Redis Adapter (clustering)                        │
│  + Optional WebRTC data channels (P2P optimization)  │
└─────────────────────────────────────────────────────┘
         ↑              ↑              ↑
    Agent A         Agent B       Agent C (remote)
    (k8s pod)       (k8s pod)     (laptop via NAT)
```

### 3.2 Component Breakdown

| Component | Responsibility |
| :--- | :--- |
| **Auth Module** | Token-based authentication; issue/validate agent credentials |
| **Presence Manager** | Track online/offline status; heartbeat monitoring |
| **Message Router** | Route messages between agents; direct, group, and broadcast |
| **Group/Channel Manager** | Create/join/leave groups; scope messaging to subsets |
| **File Dumper** | Write received messages to a local file for hook consumption |
| **Hook Integration Bridge** | Interface between dumped files and Claude Code hooks |
| **Transport Layer** | Socket.io for reliable messaging; Redis adapter for clustering |

### 3.3 MCP Server Interface

The mesh server exposes itself as an MCP server with these tools:

```
mesh/connect         — Connect to the mesh with credentials
mesh/disconnect      — Gracefully disconnect
mesh/send            — Send message to agent or group
mesh/broadcast       — Send message to all connected agents
mesh/presence        — Query online agents
mesh/group-join      — Join a named group
mesh/group-leave     — Leave a named group
mesh/group-list      — List groups and their members
mesh/history         — Retrieve recent message history
```

And these resources:

```
mesh://presence      — Live presence list (subscribable)
mesh://messages      — Incoming message stream (subscribable)
mesh://groups        — Available groups (subscribable)
```

## 4. Topology Analysis

### 4.1 Full Mesh (Every Agent Connects to Every Other)

```
    A ──── B
    │╲   ╱│
    │  ╳  │
    │╱   ╲│
    C ──── D
```

| Metric | Value |
| :--- | :--- |
| **Connections** | N×(N-1)/2 |
| **5 agents** | 10 connections |
| **10 agents** | 45 connections |
| **50 agents** | 1,225 connections |
| **Latency** | Lowest (direct P2P) |
| **SPOF** | None (fully decentralized) |
| **NAT traversal** | Required per connection pair |
| **Bandwidth** | O(N²) for broadcasts |
| **Service discovery** | Each agent must know all others |

**Verdict**: Impractical beyond ~10 agents. Connection count explodes quadratically. NAT traversal required for every pair. No central point of coordination.

### 4.2 Hub-and-Spoke (Every Agent Connects to Central Server)

```
        Server
       ╱  │  ╲
      A   B   C
      │       │
      D       E
```

| Metric | Value |
| :--- | :--- |
| **Connections** | N (one per agent) |
| **5 agents** | 5 connections |
| **10 agents** | 10 connections |
| **50 agents** | 50 connections |
| **Latency** | Low (1 hop through server) |
| **SPOF** | Server is single point of failure |
| **NAT traversal** | Only agent→server (simpler) |
| **Bandwidth** | O(N) for broadcasts |
| **Service discovery** | Central — server knows all agents |

**Verdict**: Scales linearly. Single NAT traversal path. Central presence tracking. Server is SPOF but can be HA with clustering.

### 4.3 Hybrid: Hub-and-Spoke with Optional P2P

```
        Server
       ╱  │  ╲
      A   B   C    ← All agents connect to server
      │ ↔ │        ← A and B also have direct P2P
      D       E
```

| Metric | Value |
| :--- | :--- |
| **Connections** | N (server) + selective P2P pairs |
| **Latency** | Lowest for P2P pairs, low for server-routed |
| **SPOF** | Server is SPOF for non-P2P communication |
| **Complexity** | Highest — two communication paths |

**Verdict**: Best of both worlds but highest complexity. Use for latency-critical pairs only.

### 4.4 Recommendation: Hub-and-Spoke with HA Server

**Primary topology**: Hub-and-spoke via Socket.io server with Redis adapter for horizontal scaling.

**Rationale**:

1. **Linear scaling** — N connections for N agents, not N²
2. **Simple NAT traversal** — agents connect outbound to server; no STUN/TURN needed for standard deployments
3. **Central presence** — server naturally tracks who's online
4. **Group management** — Socket.io rooms provide free grouping
5. **HA via Redis** — multiple server instances coordinate via Redis Pub/Sub; no SPOF
6. **K8s-native** — standard Deployment + Service + Ingress pattern
7. **Remote access** — agents outside the cluster connect via Ingress (standard HTTPS)

**When to add WebRTC P2P**: Only if latency between specific agent pairs becomes a bottleneck (e.g., tight feedback loops between lead and a specialist agent). This is an optimization, not a starting requirement.

## 5. Authentication

### 5.1 Token-Based Auth

```
┌─────────┐    1. Request token    ┌──────────────┐
│  Agent   │ ──────────────────→   │  Auth Service │
│          │    (agent-id, team)   │              │
│          │ ←──────────────────   │              │
│          │    2. JWT token       └──────────────┘
│          │
│          │    3. Connect with token
│          │ ──────────────────→   ┌──────────────┐
│          │                       │  Mesh Server  │
│          │ ←──────────────────   │              │
│          │    4. Connected       └──────────────┘
└─────────┘
```

**Token contents** (JWT claims):

```json
{
  "sub": "agent-id",
  "team": "team-name",
  "groups": ["default", "researchers"],
  "iat": 1771213849,
  "exp": 1771217449,
  "permissions": ["send", "receive", "presence"]
}
```

### 5.2 Auth Modes

| Mode | Description | Use Case |
| :--- | :--- | :--- |
| **Team token** | Shared secret per team; all agents in a team use same token | Simple local teams |
| **Agent token** | Per-agent JWT issued by auth service | Production, multi-team |
| **mTLS** | Mutual TLS with agent certificates | K8s service mesh (Istio/Linkerd) |

### 5.3 Group Membership

Agents don't need to join all groups. Authentication scopes which groups an agent may join:

```
Agent "researcher" → groups: ["default", "research-pool"]
Agent "writer"     → groups: ["default", "docs-team"]
Agent "lead"       → groups: ["default", "research-pool", "docs-team", "admin"]
```

Group join is validated against the token's `groups` claim. Agents can only receive messages from groups they've joined.

## 6. Kubernetes + Remote Architecture

### 6.1 In-Cluster (Low Latency)

```
┌─────────────────────────────────────────┐
│           Kubernetes Cluster             │
│                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐    │
│  │Agent A │  │Agent B │  │Agent C │    │
│  │  Pod   │  │  Pod   │  │  Pod   │    │
│  └───┬────┘  └───┬────┘  └───┬────┘    │
│      │           │           │          │
│      └─────┬─────┘───────────┘          │
│            │                             │
│      ┌─────┴─────┐                      │
│      │Mesh Server│ ← ClusterIP Service  │
│      │   Pods    │                      │
│      └─────┬─────┘                      │
│            │                             │
│      ┌─────┴─────┐                      │
│      │   Redis   │ ← StatefulSet        │
│      └───────────┘                      │
└─────────────────────────────────────────┘
```

- Agents connect via k8s Service DNS (`mesh-server.namespace.svc.cluster.local`)
- No NAT traversal needed — pod-to-service routing is flat
- Latency: <1ms within cluster
- Socket.io with Redis adapter across server replicas

### 6.2 Remote Agents Connecting In

```
┌──────────────┐         ┌─────────────────────────┐
│ Remote Agent │         │   Kubernetes Cluster     │
│ (laptop/VM)  │         │                          │
│              │  HTTPS  │  ┌─────────────────┐    │
│  Socket.io   │────────→│  │ Ingress (nginx) │    │
│  client      │         │  │ + sticky session│    │
│              │         │  └────────┬────────┘    │
└──────────────┘         │           │              │
                         │    ┌──────┴──────┐      │
                         │    │ Mesh Server │      │
                         │    │   Pods      │      │
                         │    └─────────────┘      │
                         └─────────────────────────┘
```

- Remote agents connect via Ingress with sticky sessions
- Standard HTTPS/WSS — no STUN/TURN required
- Socket.io handles reconnection on network interruptions
- Authentication via JWT token in connection handshake

### 6.3 Cross-Cluster

```
┌─────────────────┐         ┌─────────────────┐
│   Cluster A     │         │   Cluster B     │
│                 │         │                 │
│  Agents + Mesh  │  HTTPS  │  Agents + Mesh  │
│  Server (Redis) │←───────→│  Server (Redis) │
│                 │         │                 │
└─────────────────┘         └─────────────────┘
```

**Option A: Shared Redis** — Both clusters' mesh server instances connect to a shared Redis (e.g., ElastiCache, Cloud Memorystore). Socket.io Redis adapter handles cross-cluster message routing transparently.

**Option B: Federation** — Each cluster runs its own mesh server. A federation bridge relays messages between clusters. More complex but no shared infrastructure.

**Recommendation**: Option A (shared Redis) for simplicity in early versions. Federation for multi-region deployments later.

## 7. Presence System

### 7.1 Presence States

```
CONNECTING → ONLINE → IDLE → OFFLINE
                ↑       │
                └───────┘ (activity detected)
```

| State | Meaning | Detection |
| :--- | :--- | :--- |
| **CONNECTING** | Agent is establishing connection | Socket.io `connecting` event |
| **ONLINE** | Agent is connected and active | Heartbeat + recent message activity |
| **IDLE** | Agent is connected but inactive | Heartbeat OK, no messages for N seconds |
| **OFFLINE** | Agent is disconnected | Socket.io `disconnect` event or heartbeat timeout |

### 7.2 Heartbeat

- Socket.io provides built-in ping/pong at the Engine.IO level
- Default: `pingInterval: 25000ms`, `pingTimeout: 5000ms`
- If pong not received within timeout → agent marked OFFLINE
- Configurable per deployment (tighter for latency-sensitive, looser for remote)

### 7.3 Presence Broadcast

When an agent's presence changes, the server broadcasts to all connected agents in the same groups:

```json
{
  "type": "presence",
  "agentId": "researcher-1",
  "state": "online",
  "groups": ["default", "research-pool"],
  "timestamp": "2026-02-16T12:00:00Z"
}
```

## 8. Message Flow

### 8.1 Agent-to-Agent (Direct)

```
Agent A                  Mesh Server               Agent B
   │                         │                        │
   │  mesh/send              │                        │
   │  {to: "B", msg: "..."}│                        │
   │────────────────────────→│                        │
   │                         │  Socket.io emit        │
   │                         │  to B's socket         │
   │                         │───────────────────────→│
   │                         │                        │
   │                         │  File Dumper writes    │
   │                         │  to B's inbox file     │
   │                         │                        │
   │                         │  Hook fires            │
   │                         │  (PreToolUse or        │
   │                         │   Notification)        │
   │                         │───────────────────────→│
   │                         │                        │
   │  ack: delivered         │                        │
   │←────────────────────────│                        │
```

### 8.2 Group Broadcast

```
Agent A                  Mesh Server               Agents B, C, D
   │                         │                        │
   │  mesh/send              │                        │
   │  {group: "workers",     │                        │
   │   msg: "..."}          │                        │
   │────────────────────────→│                        │
   │                         │  Socket.io             │
   │                         │  io.to("workers")      │
   │                         │  .emit(msg)            │
   │                         │───────────────────────→│ (B)
   │                         │───────────────────────→│ (C)
   │                         │───────────────────────→│ (D)
   │                         │                        │
   │  ack: delivered to 3    │                        │
   │←────────────────────────│                        │
```

### 8.3 Claude Code Integration (File Dump + Hook)

The critical integration point: how messages get into an agent's Claude Code conversation context.

```
Mesh Server                     Agent's Local Filesystem        Claude Code
     │                                │                            │
     │  Incoming message              │                            │
     │  for Agent B                   │                            │
     │                                │                            │
     │  1. Write to inbox file        │                            │
     │  ───────────────────────────→  │                            │
     │  ~/.claude/mesh/{agent}.jsonl  │                            │
     │                                │                            │
     │  2. Touch trigger file         │                            │
     │  ───────────────────────────→  │                            │
     │  ~/.claude/mesh/{agent}.trigger│                            │
     │                                │                            │
     │                                │  3. Hook fires             │
     │                                │  (Notification hook)       │
     │                                │  ────────────────────────→ │
     │                                │                            │
     │                                │  4. Hook script reads      │
     │                                │  inbox file, injects       │
     │                                │  as system-reminder        │
     │                                │  ────────────────────────→ │
     │                                │                            │
     │                                │  5. Agent processes        │
     │                                │  message in context        │
     │                                │                            │
```

**File format** (JSONL for append-only efficiency):

```jsonl
{"id":"msg-001","from":"lead","to":"researcher","group":null,"text":"Please review the topology section","timestamp":"2026-02-16T12:00:00Z","read":false}
{"id":"msg-002","from":"writer","group":"docs-team","text":"I've updated the architecture diagrams","timestamp":"2026-02-16T12:01:00Z","read":false}
```

**Hook script** (`mesh-inbox-hook.sh`):

```bash
#!/usr/bin/env bash
# Notification hook — reads unread messages from mesh inbox
INBOX="$HOME/.claude/mesh/${CLAUDE_CODE_AGENT_NAME}.jsonl"
if [ -f "$INBOX" ]; then
  # Read unread messages, mark as read, output to stderr for injection
  # (Implementation detail — exact hook API TBD based on hook type)
fi
```

## 9. Message Format

### 9.1 Envelope

All messages through the mesh use this envelope:

```json
{
  "id": "uuid-v4",
  "type": "message",
  "from": "agent-id",
  "to": "agent-id | null",
  "group": "group-name | null",
  "text": "message content",
  "metadata": {},
  "timestamp": "ISO-8601",
  "ttl": 300
}
```

| Field | Required | Description |
| :--- | :--- | :--- |
| `id` | Yes | Unique message ID (UUID v4) |
| `type` | Yes | `message`, `presence`, `ack`, `system` |
| `from` | Yes | Sender agent ID |
| `to` | No | Recipient agent ID (null for group/broadcast) |
| `group` | No | Target group (null for direct messages) |
| `text` | Yes | Message content (plain text or JSON string) |
| `metadata` | No | Arbitrary key-value pairs |
| `timestamp` | Yes | ISO 8601 timestamp |
| `ttl` | No | Time-to-live in seconds (default: 300) |

### 9.2 Delivery Semantics

| Message Type | Guarantee | Implementation |
| :--- | :--- | :--- |
| **Direct message** | At-least-once | Socket.io ack + retry on timeout |
| **Group broadcast** | At-most-once | Socket.io room emit (fire-and-forget) |
| **Presence update** | At-most-once | Periodic reconciliation corrects drift |
| **System message** | At-least-once | Ack required |

### 9.3 Message Deduplication

Recipients maintain a rolling window of seen message IDs (last 1000 or 5 minutes). Duplicate deliveries are silently dropped. This prevents double-processing from at-least-once retry semantics.

## 10. Technology Choices

### 10.1 Transport: Socket.io over WebSocket

**Why Socket.io over raw WebSocket**:

- Automatic reconnection with exponential backoff
- Session recovery (restore missed messages on reconnect)
- Built-in rooms for group messaging
- Heartbeat and dead connection detection
- HTTP long-polling fallback for restricted networks
- Message ordering guaranteed

**Why not WebRTC data channels as primary**:

- Requires STUN/TURN infrastructure for NAT traversal
- Connection setup complexity (signaling server, ICE negotiation)
- Full mesh doesn't scale beyond ~10 agents
- SFU topology adds same complexity as Socket.io server
- No built-in reconnection or session recovery

**When to consider WebRTC**: P2P optimization for latency-critical agent pairs within the same network. This would be a future enhancement layered on top of the Socket.io hub, not a replacement.

### 10.2 Clustering: Redis Adapter

- Socket.io Redis adapter for cross-server message coordination
- Redis Pub/Sub is stateless (no persistence overhead)
- Sharded adapter for Redis 7.0+ provides better scalability
- Each server instance handles local connections; Redis distributes broadcasts
- Sticky sessions on Ingress ensure agents reconnect to same server

### 10.3 Implementation Language: TypeScript (Bun)

Aligned with [mcp-tooling PRD](../../../mcp/docs/specs/draft/mcp-tooling.md) technology decision:

- MCP TypeScript SDK is the reference implementation
- Socket.io is TypeScript-native
- Bun provides fast startup and runtime
- Same stack as other nsheaps/mcp components

### 10.4 MCP Interface: Streamable HTTP

The mesh server exposes its MCP tools/resources via Streamable HTTP transport:

- Agents call `mesh/send`, `mesh/presence`, etc. as MCP tool calls
- Server pushes incoming messages via SSE stream
- Session management via `MCP-Session-Id` header
- Compatible with any MCP client (Claude Code, Cursor, Codex, etc.)

## 11. Scalability Characteristics

| Metric | Value | Notes |
| :--- | :--- | :--- |
| **Agents per server** | 10,000-30,000 | Socket.io with OS tuning |
| **Message throughput** | 3,000-10,000 msgs/sec | Per server instance |
| **Horizontal scaling** | Add server replicas | Redis adapter coordinates |
| **Connection overhead** | 30-100 KB per agent | Socket.io connection state |
| **Message latency (in-cluster)** | <5ms | Pod-to-pod via k8s service |
| **Message latency (remote)** | 50-200ms | Depends on network path |
| **Reconnection time** | 1-5 seconds | Socket.io exponential backoff |

**Practical team sizes** this architecture supports:

| Team Size | Server Instances | Redis | Notes |
| :--- | :--- | :--- | :--- |
| 1-10 agents | 1 | Optional | Single server, no clustering needed |
| 10-100 agents | 1-2 | Recommended | Clustering for HA |
| 100-1,000 agents | 3-5 | Required | Full clustering, sticky sessions |
| 1,000+ agents | 5+ | Required (sharded) | Enterprise scale |

## 12. Security Model

### 12.1 Transport Security

| Layer | Mechanism |
| :--- | :--- |
| **In-cluster** | K8s network policy + optional mTLS (Istio/Linkerd) |
| **Remote** | WSS (WebSocket over TLS) via Ingress |
| **Auth** | JWT token validated on connection |
| **Message** | No message-level encryption (transport-level TLS is sufficient) |

### 12.2 Authorization

```
Agent connects with JWT
  → Server validates signature
  → Server checks expiry
  → Server extracts team + groups
  → Agent can only:
    - Send to agents in same team
    - Join groups listed in token
    - See presence of same-team agents
```

### 12.3 Rate Limiting

| Action | Default Limit | Rationale |
| :--- | :--- | :--- |
| **Messages per second** | 100/agent | Prevent runaway agent flooding |
| **Group broadcasts per minute** | 30/agent | Broadcasts are expensive (fan-out) |
| **Connections per team** | 100 | Prevent resource exhaustion |

## 13. Relationship to Existing Systems

### 13.1 Claude Code Agent Teams (File-Based)

The mesh MCP server **complements**, not replaces, the existing file-based system:

| Capability | File-Based Inbox | Mesh MCP Server |
| :--- | :--- | :--- |
| **Real-time** | No (polling) | Yes (push) |
| **Presence** | No | Yes |
| **Groups** | No | Yes |
| **Cross-machine** | No (shared filesystem) | Yes (network) |
| **Delivery guarantee** | Write-to-file | At-least-once with ack |
| **Claude Code native** | Yes (SendMessage tool) | Via MCP tools |
| **No infrastructure** | Yes | Requires server + Redis |

**Migration path**: The File Dumper component writes messages to the local filesystem in a format compatible with Claude Code hooks, preserving backward compatibility.

### 13.2 nsheaps/mcp P2P Component

The mesh MCP server implements the P2P communication component described in the [mcp-tooling PRD](../../../mcp/docs/specs/draft/mcp-tooling.md) (Section 8):

> `mcp p2p proxy <connection-info>` — Stdio server that connects via WebRTC to remote endpoints

The mesh server can serve as the signaling and coordination layer for the `mcp p2p proxy`, providing the WebRTC signaling exchange if P2P optimization is enabled.

### 13.3 Linear Integration

Per the [linear-integrations research](../../research/linear-integrations.md), the mesh server enables Pattern A (Issue-Driven Agent Spawning):

```
Linear webhook → Automation platform → Mesh MCP Server
  → Route to appropriate agent group
  → Agent receives via mesh/send tool
```

## 14. MVP Scope

### Phase 1: Core Messaging (MVP)

- Socket.io server with authentication
- Direct messaging between agents
- Group join/leave/send
- Presence tracking (online/offline)
- File dumper for Claude Code hook integration
- MCP tool interface (`mesh/send`, `mesh/presence`, `mesh/group-*`)
- Single-server deployment (no clustering)

### Phase 2: Production Readiness

- Redis adapter for horizontal scaling
- Kubernetes Deployment + Ingress with sticky sessions
- JWT auth with configurable token issuance
- Message history (last N messages per group)
- Rate limiting
- Observability (connection metrics, message counts, latency)

### Phase 3: Advanced Features

- WebRTC P2P optimization for latency-critical pairs
- Cross-cluster federation
- Message persistence (Redis Streams or PostgreSQL)
- MCP sampling integration (server requests LLM help for routing decisions)
- Webhook ingestion (external events → mesh messages)

## 15. Open Questions

1. **Hook type for message injection**: Which Claude Code hook is best for injecting mesh messages into conversation context? `Notification` hook? `PreToolUse`? `UserPromptSubmit`? Need to test which provides the smoothest injection without interrupting agent workflow.

2. **File dump format**: JSONL (append-only) vs JSON array (compatible with existing inbox format)? JSONL is more efficient for append but requires different parsing.

3. **Auth service deployment**: Should the auth service be part of the mesh server or a separate component? Separate enables SSO integration but adds deployment complexity.

4. **Message persistence**: Should messages survive server restart? Redis Streams provide durable storage with minimal complexity. PostgreSQL for full persistence. Or keep it ephemeral (messages are ephemeral coordination signals, not durable state)?

5. **Backward compatibility**: Should the mesh server also write to the existing `~/.claude/teams/{team}/inboxes/` format for backward compatibility with the `SendMessage` tool? Or is the File Dumper + hook approach sufficient?

6. **MCP transport for agent connections**: Should agents connect to the mesh server via MCP Streamable HTTP (using mesh tools), or directly via Socket.io client? Streamable HTTP is MCP-native but adds HTTP overhead. Direct Socket.io is lower latency but requires a non-MCP client library.

7. **Group auto-discovery**: Should groups be pre-defined in team configuration, or can agents create groups dynamically? Dynamic is more flexible but harder to secure.

8. **Message size limits**: What's the maximum message size? Socket.io supports large messages but MCP tool responses have practical limits. Propose 64 KB as default, configurable.

## 16. References

### Research

- WebRTC Mesh Research — Data channels, topologies, NAT traversal, k8s patterns (conducted during looney-tunes session, Feb 2026; original report in claude-utils `.claude/tmp/`)
- Socket.io Patterns Research — Rooms, clustering, delivery guarantees, k8s deployment (conducted during looney-tunes session, Feb 2026; original report in claude-utils `.claude/tmp/`)
- MCP Transport Research — Official transports, Streamable HTTP, custom transports, WebSocket SEP (conducted during looney-tunes session, Feb 2026; original report in claude-utils `.claude/tmp/`)
- [Team Storage Internals](../../research/team-storage-internals.md) — Current file-based inbox format
- [Orchestration Platforms Survey](../../research/orchestration-platforms-index.md) — Industry landscape

### Specifications

- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [SEP-1287: WebSocket Transport for MCP](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1287)
- [Socket.IO v4 Documentation](https://socket.io/docs/v4/)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)

### Related PRDs

- [MCP Tooling PRD](../../../mcp/docs/specs/draft/mcp-tooling.md) — P2P communication component
- [Marketplace Structure PRD](marketplace-structure.md) — Agent distribution
- [E2E Testing PRD](e2e-testing.md) — Testing infrastructure

### Architecture References

- [RFC 8831: WebRTC Data Channels](https://datatracker.ietf.org/doc/html/rfc8831)
- [STUNner: K8s-native STUN/TURN](https://webrtc.ventures/2025/06/how-to-deploy-stunner-as-a-webrtc-stun-turn-server-on-kubernetes/)
- [node-datachannel](https://github.com/murat-dogan/node-datachannel) — Node.js WebRTC library
- [werift-webrtc](https://github.com/shinyoshiaki/werift-webrtc) — Pure TypeScript WebRTC
