# Mesh MCP Server — Engineering Review

**Reviewer**: Bugs Bunny (Software Engineer)
**Date**: 2026-02-17
**PRD**: `docs/specs/draft/mesh-mcp-server.md`
**Task**: #87

---

## 1. MVP Recommendation

The PRD's Phase 1 (section 14) is still too wide for a true MVP. I'd cut further:

### Minimal MVP (Week 1)

1. **Socket.io server** — no auth, no Redis, single instance
2. **Direct messaging only** — no groups, no broadcast
3. **Simple presence** — online/offline via Socket.io connect/disconnect events
4. **MCP stdio client wrapper** — local MCP server that agents connect to; it bridges to the remote Socket.io server
5. **3 MCP tools only**: `mesh/connect`, `mesh/send`, `mesh/presence`

This gets real-time agent-to-agent messaging working with presence. Everything else layers on top.

### Why cut groups from MVP?

Groups add auth complexity (which groups can an agent join?), UI complexity (listing, joining, leaving), and message routing complexity (fan-out). Direct messaging proves the architecture. Groups are Phase 1.5.

### Why cut File Dumper from MVP?

The File Dumper has a fundamental architecture gap (see section 2 below). It's better to get messaging working over MCP tools first, then add the file bridge.

---

## 2. Missing from Implementation Perspective

### Critical Gap: File Dumper Architecture

**This is the biggest problem in the PRD.**

Section 8.3 shows the mesh server writing to the agent's local filesystem (`~/.claude/mesh/{agent}.jsonl`). But if the mesh server is a network service (in k8s or on another machine), it **cannot write to each agent's local filesystem**.

The PRD is ambiguous about the deployment model:

- Is the mesh MCP server a **remote network service** that agents connect to via Streamable HTTP?
- Or is it a **local stdio MCP server** that each agent runs alongside itself, which then connects to the remote Socket.io server?

**It must be the second model** (local stdio MCP server + remote Socket.io backend) for the File Dumper to work. The architecture should be:

```
Agent
  → local MCP stdio server (runs as sidecar)
    → Socket.io client (connects to remote server)
    → File Dumper (writes to local filesystem)
    → Hook Bridge (triggers Claude Code hooks)
```

This is a two-process architecture:

1. **Mesh server** (remote) — Socket.io + Redis, handles routing/presence/auth
2. **Mesh client** (local, MCP stdio) — bridges between MCP tools and Socket.io, writes files locally

The PRD conflates these two components. They need to be designed and built separately.

### Other Missing Pieces

| Missing                                                                              | Impact                 | Priority |
| :----------------------------------------------------------------------------------- | :--------------------- | :------- |
| **Codebase structure** (directories, modules, build system)                          | Can't start coding     | High     |
| **Error handling strategy** (reconnection behavior, message retry, partial failures) | Unreliable in practice | High     |
| **Testing strategy** (unit, integration, e2e for real-time messaging)                | Can't validate         | High     |
| **Configuration file format** (server config, client config)                         | Need before deployment | Medium   |
| **Graceful shutdown** (drain connections, flush pending messages)                    | Data loss risk         | Medium   |
| **Logging/observability** for MVP (not just Phase 2)                                 | Can't debug            | Medium   |
| **CLI interface** (how to start the server, how to connect)                          | UX                     | Medium   |
| **MCP server registration** (how does an agent discover and connect to the mesh?)    | Integration gap        | Medium   |

### Open Question #1 is MVP-Critical

The PRD lists hook type for message injection as open question #1. This determines the entire Claude Code integration model. We need to research and answer this **before** building the File Dumper or Hook Bridge. Without this, we can build the Socket.io layer but can't integrate with Claude Code.

---

## 3. Technical Concerns with Socket.io + Redis

### 3.1 Language Conflict

**Section 10.3 says TypeScript/Bun. The language comparison recommends Go (38/40 vs 25/40 for Bun/TS).**

The rationale in 10.3 is "Socket.io is TypeScript-native" and "same stack as nsheaps/mcp." But:

- The Go MCP SDK is production-ready (v1.3.0, Google co-maintained)
- Go has excellent WebSocket libraries (gorilla/websocket, nhooyr/websocket)
- Go is the recommended language for MCP servers per our own research
- If we build this in TS and everything else in Go, we have two tech stacks to maintain

**Recommendation**: Build in Go. Use a Go Socket.io client library or switch to raw WebSockets with a thin compatibility layer. Socket.io's value (reconnection, rooms, heartbeat) can be replicated with ~200 lines of Go code on top of gorilla/websocket. Or use the `googollee/go-socket.io` library.

Alternatively, if the team decides TS for rapid prototyping, accept the rewrite cost later.

### 3.2 Socket.io is Heavyweight

Socket.io brings:

- Custom protocol on top of WebSocket (Engine.IO layer)
- HTTP long-polling fallback (unnecessary for agent-to-agent)
- Protocol version compatibility concerns (v3 ↔ v4 breaking changes)
- Client library required (can't use raw WebSocket clients)

For agent communication, we don't need browser compatibility or HTTP fallback. Raw WebSockets with a thin reconnection layer would be lighter and more portable across languages.

### 3.3 Redis Adapter Adds Ops Complexity

Even for "simple" clustering, Redis adds:

- Another service to deploy, monitor, and maintain
- Connection management (Redis connection pools, reconnection)
- Memory management (Redis eviction policies)
- Network partition handling (what happens when mesh server loses Redis?)

**For MVP**: Skip Redis entirely. Single server instance. Add Redis when horizontal scaling is actually needed.

### 3.4 Sticky Sessions Anti-Pattern

The PRD requires sticky sessions on Ingress for Socket.io clustering. Sticky sessions:

- Complicate load balancer configuration
- Prevent even load distribution
- Create hot spots if one server gets all the "chatty" agents
- Make rolling deployments harder

Socket.io's Redis adapter was designed to avoid the need for sticky sessions — but in practice, sticky sessions are still recommended due to the Engine.IO HTTP upgrade handshake. This is a known pain point.

### 3.5 Message Ordering

The PRD claims "message ordering guaranteed" (section 10.1). This is only true for messages between the same sender/receiver pair on the same Socket.io server. Cross-server messages via Redis adapter do NOT have ordering guarantees. The PRD should document this limitation.

---

## 4. Complexity Estimates

| Component                        | Complexity  | Estimate | Dependencies     | Notes                                   |
| :------------------------------- | :---------- | :------- | :--------------- | :-------------------------------------- |
| **Socket.io server** (or raw WS) | Low         | 1-2 days | None             | Basic server setup, connection handling |
| **Presence Manager**             | Low-Medium  | 1-2 days | Server           | Socket.io events + state map            |
| **Direct Message Router**        | Medium      | 2-3 days | Server, Presence | Routing, ack/retry, dedup               |
| **Group Manager**                | Low         | 1 day    | Server           | Socket.io rooms handle most of it       |
| **Auth Module (JWT)**            | Medium      | 2 days   | None             | Token gen/validate, middleware          |
| **MCP tool interface**           | Medium-High | 3-4 days | Router, Presence | MCP SDK integration, tool definitions   |
| **MCP stdio client**             | Medium-High | 3-4 days | MCP tools        | Local client bridging to remote server  |
| **File Dumper**                  | Medium      | 2 days   | Client           | Write JSONL, manage trigger files       |
| **Hook Bridge**                  | High        | 3-5 days | File Dumper      | Depends on Claude Code hook research    |
| **Redis Adapter**                | Low         | 1 day    | Server           | Mostly config, Socket.io adapter        |
| **K8s manifests**                | Low-Medium  | 1-2 days | All              | Deployment, Service, Ingress            |

### Total Estimates

| Scope                                                        | Estimate    |
| :----------------------------------------------------------- | :---------- |
| **Minimal MVP** (server + direct msg + presence + MCP tools) | 1.5-2 weeks |
| **Phase 1** (MVP + groups + auth + file dumper)              | 3-4 weeks   |
| **Phase 2** (Redis + k8s + history + rate limiting)          | 2-3 weeks   |

---

## 5. Recommended Build Order

1. **Research**: Answer open question #1 (hook type) — blocks File Dumper design
2. **Resolve**: Language decision (Go vs TS) — blocks everything
3. **Build**: Socket.io/WS server with presence (no auth)
4. **Build**: Direct message routing with acks
5. **Build**: MCP tool definitions (mesh/connect, mesh/send, mesh/presence)
6. **Build**: MCP stdio client wrapper
7. **Test**: End-to-end: two agents messaging via mesh MCP tools
8. **Build**: JWT auth module
9. **Build**: Group manager
10. **Build**: File dumper + hook bridge (requires research from step 1)
11. **Build**: Redis adapter
12. **Ship**: Phase 1 complete

---

## 6. Questions for Team Lead

1. **Language**: Should I plan for Go or TS? The PRD says TS, our research says Go. This needs a decision before implementation.
2. **Two-process split**: Does the team agree with separating mesh-server (remote) from mesh-client (local MCP stdio)? The PRD doesn't make this distinction.
3. **Socket.io vs raw WebSockets**: Given Go recommendation and no need for browser compat, should we use raw WebSockets instead?
4. **Hook research**: Should Road Runner investigate open question #1 (hook type) before I start building the File Dumper?
