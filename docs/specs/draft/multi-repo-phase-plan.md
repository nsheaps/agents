# Multi-Repo Phase Plan: Agent Lifecycle + Mesh MCP + MCP Tooling

**Author**: Elmer Fudd (Project Manager)
**Date**: 2026-02-17
**Task**: #94
**Revision**: 2 — incorporates architecture design doc + MVP priority shift
**Status**: Draft — awaiting team lead review

---

## Context & Inputs

This plan synthesizes these source documents:

1. **Agent Team Architecture** — `agent-team/docs/specs/draft/agent-team-architecture.md` (7 design topics)
2. **Mesh MCP Server PRD** — `agent-team/docs/specs/draft/mesh-mcp-server.md`
3. **Agent Wrapper PRD** — `agent/docs/specs/draft/agent-wrapper.md`
4. **MCP Tooling PRD** — `mcp/docs/specs/draft/mcp-tooling.md`
5. **Engineering Review** — `agent-team/.claude/tmp/mesh-mcp-engineering-review.md` (Bugs Bunny, Task #87)
6. **Team Member Cleanup Behavior** — `agent-team/.claude/behaviors/team-member-cleanup.md`

### Key Decisions

- **Language**: TypeScript + Bun for all components. Exception: K8s controller = Go. (Task #90)
- **Two-process architecture**: Remote mesh server + local MCP stdio client are separate components.
- **Socket.io**: Separated as its own reusable package.
- **MVP PRIORITY**: Agent lifecycle (launch/kill/relaunch) is the FIRST goal. Before mesh, before Docker, before cross-machine.

### Repos Involved

| Repo | Purpose | Primary work |
|:-----|:--------|:-------------|
| `nsheaps/agent` | Agent launcher wrapper | **Phase 1 MVP**: lifecycle management, config composition, launch command |
| `nsheaps/agent-team` | Agent team orchestration | Agent definitions, agent.yaml schema, personas, team docs, specs |
| `nsheaps/mcp` | MCP tooling CLI + packages | Socket.io package, mesh server, mesh client, inspector, gateway, daemon, CLI |

---

## Tier 1: Agent Lifecycle (FIRST PRIORITY)

> "The ability to launch an agent, kill it, and relaunch it reliably on the same system — without stale entries, name collisions, or manual config surgery."

### Phase 1: Agent Lifecycle MVP

**Repo**: `nsheaps/agent`
**Goal**: Reliable agent launch, kill, relaunch, health check, and auto-cleanup. Solves the stale entry problem documented in `.claude/behaviors/team-member-cleanup.md`.
**Depends on**: Nothing — this is the foundation

| Task | Description |
|:-----|:------------|
| 1.1 | Initialize `nsheaps/agent` repo with Bun, tsconfig, eslint, prettier, CI |
| 1.2 | Define `agent launch` CLI: spawn an agent by name with specified permissions and framework |
| 1.3 | Implement backend detection: identify running backends (tmux panes, processes) |
| 1.4 | Implement `agent kill <name>`: cleanly terminate an agent AND remove from team config |
| 1.5 | Implement health check: detect when an agent's backend (tmux pane, process) has died |
| 1.6 | Implement auto-cleanup: on launch, detect and remove stale entries for the same agent name |
| 1.7 | Implement `agent list`: show agents with live/dead status (cross-reference tmux panes vs team config) |
| 1.8 | Implement `agent relaunch <name>`: kill + launch in one command, no `-2` suffix |
| 1.9 | Integration tests: launch → kill → relaunch cycle without stale entries |
| 1.10 | Integration tests: agent crash (kill tmux pane externally) → health check detects → cleanup removes stale entry |

**Missing tools this replaces** (from team-member-cleanup.md):

| Missing Tool | Phase 1 Solution |
|:---|:---|
| `TeamRemoveMember` | `agent kill` removes from config |
| `TeamListMembers` | `agent list` with live/dead status |
| `TeamCleanup` | Auto-cleanup on `agent launch` + `agent list --cleanup` |
| Graceful crash handling | Health check polling + auto-cleanup |

**Exit criteria**: Can reliably launch, kill, and relaunch agents by name. No stale entries. No `-2` suffixes. Crash recovery works.

---

### Phase 2: Agent Definition Schema + Per-Agent Tool Sets

**Repo**: `nsheaps/agent-team` (schema definition) + `nsheaps/agent` (implementation)
**Goal**: Structured agent definitions with configurable tool sets. Move from markdown-only agent files to code-level definitions.
**Depends on**: Phase 1

| Task | Description |
|:-----|:------------|
| 2.1 | Define `agent.yaml` TypeScript types (schema from architecture doc §4) |
| 2.2 | Implement YAML parser + validator for agent.yaml files |
| 2.3 | Define tool set categories (per architecture doc §2): messaging, tasks, team-management, spawning, filesystem, execution |
| 2.4 | Implement per-agent tool set configuration in `agent launch` |
| 2.5 | Create agent directory structure template (architecture doc §4): `agents/{name}/agent.yaml`, `prompt.md`, `persona.md`, `behaviors/` |
| 2.6 | Migrate existing agent-team markdown agents to new structure |
| 2.7 | Update `agent launch` to read agent.yaml and assemble full config (profile + tools + permissions + mesh groups) |
| 2.8 | Tests for schema validation, tool set filtering |

**Agent.yaml schema** (from architecture doc):

```yaml
name: software-engineer
character: Bugs Bunny
role: Software Engineer
framework: claude-code
model: claude-opus-4-6
tools: [messaging, tasks, filesystem, execution]
permissions:
  mode: bypassPermissions
  allowed: ["git *", "bun *"]
mesh:
  connect: true
  groups: [engineering, all]
session:
  persist: true
  backend: local
```

**Exit criteria**: Agents defined in structured YAML. Tool sets configurable per agent. `agent launch engineer` reads `agents/engineer/agent.yaml` and applies tool restrictions.

---

## Tier 2: MCP Foundation + Mesh Communication

### Phase 3: MCP Monorepo Foundation

**Repo**: `nsheaps/mcp`
**Goal**: Set up the nx monorepo with Bun, shared tooling, and CI.
**Depends on**: Nothing (can start in parallel with Phase 1)

| Task | Description |
|:-----|:------------|
| 3.1 | Initialize nx workspace with Bun as package manager |
| 3.2 | Configure shared tsconfig, eslint, prettier |
| 3.3 | Set up CI (GitHub Actions: lint, typecheck, test) |
| 3.4 | Create `packages/` directory structure |
| 3.5 | Configure release-it for monorepo publishing |
| 3.6 | Add mise.toml for tool versions (bun, node) |

**Exit criteria**: `bun install`, `bun run lint`, `bun run typecheck` all pass. CI green.

---

### Phase 4: Socket.io Transport Package

**Repo**: `nsheaps/mcp` → `packages/socketio-transport`
**Goal**: Standalone, reusable Socket.io wrapper with no MCP dependency.
**Depends on**: Phase 3

| Task | Description |
|:-----|:------------|
| 4.1 | Create `packages/socketio-transport` with package.json |
| 4.2 | Define message envelope types (from mesh PRD §9.1) |
| 4.3 | Implement server wrapper: create server, handle connections, room management |
| 4.4 | Implement client wrapper: connect, reconnect with backoff, heartbeat monitoring |
| 4.5 | Implement message serialization/deserialization |
| 4.6 | Add event emitter interface for connection lifecycle |
| 4.7 | Unit tests for all components |
| 4.8 | Export as package (`@nsheaps/socketio-transport`) |

**Exit criteria**: Package builds, tests pass. Can create a server and client that exchange typed messages.

---

### Phase 5: Mesh Server + Client MVP

**Repo**: `nsheaps/mcp` → `packages/mesh-server` + `packages/mesh-client`
**Goal**: Working real-time agent-to-agent messaging via the two-process architecture.
**Depends on**: Phase 4

**Two-process architecture:**

```
┌──────────────────────────────────┐
│     REMOTE: Mesh Server           │
│  Socket.io server + presence      │
│  No auth, no Redis, no groups     │
└───────────────┬──────────────────┘
                │ Socket.io (WSS)
┌───────────────┴──────────────────┐
│     LOCAL: Mesh MCP Client        │
│  MCP stdio server per-agent       │
│  3 tools: connect, send, presence │
└──────────────────────────────────┘
         ↑
    Agent (Claude Code)
```

#### 5A: Mesh Server

| Task | Description |
|:-----|:------------|
| 5A.1 | Create `packages/mesh-server` using `socketio-transport` |
| 5A.2 | Implement connection handler: register agent, assign ID |
| 5A.3 | Implement presence manager: online/offline via connect/disconnect |
| 5A.4 | Implement direct message routing with delivery ack |
| 5A.5 | Implement message deduplication (rolling window, per mesh PRD §9.3) |
| 5A.6 | CLI entry point: `bun run mesh-server --port 3456` |
| 5A.7 | Structured logging (JSON), unit + integration tests |

#### 5B: Mesh MCP Client

| Task | Description |
|:-----|:------------|
| 5B.1 | Create `packages/mesh-client` using `@modelcontextprotocol/sdk` |
| 5B.2 | Implement `mesh/connect` tool |
| 5B.3 | Implement `mesh/send` tool |
| 5B.4 | Implement `mesh/presence` tool |
| 5B.5 | Handle incoming messages: buffer + expose via MCP notification |
| 5B.6 | CLI entry point: `bun run mesh-client --server ws://localhost:3456 --agent-id my-agent` |
| 5B.7 | Unit + integration tests |

#### 5C: End-to-End Integration

| Task | Description |
|:-----|:------------|
| 5C.1 | E2E test: two mesh clients exchange messages through mesh server |
| 5C.2 | E2E test: presence updates on connect/disconnect |
| 5C.3 | E2E test: message delivery failure when recipient offline |
| 5C.4 | Add E2E runner to CI |

**Exit criteria**: Two agents can message each other in real-time via MCP tools. Automated E2E tests pass in CI.

---

### Phase 6: Mesh Production Features

**Repo**: `nsheaps/mcp` → mesh packages
**Goal**: Groups, auth, and Claude Code integration via file dumper.
**Depends on**: Phase 5

These three sub-phases can run **in parallel**:

#### 6A: Groups

| Task | Description |
|:-----|:------------|
| 6A.1 | Group manager in mesh-server (Socket.io rooms) |
| 6A.2 | `mesh/group-join`, `mesh/group-leave`, `mesh/group-list` tools |
| 6A.3 | Group broadcasts via `mesh/send` with `group` parameter |
| 6A.4 | Tests |

#### 6B: Authentication

| Task | Description |
|:-----|:------------|
| 6B.1 | JWT token generation (team token mode) |
| 6B.2 | Auth middleware on Socket.io connection |
| 6B.3 | Scope groups + messaging to token claims |
| 6B.4 | Rate limiting per agent (mesh PRD §12.3) |
| 6B.5 | Tests |

#### 6C: File Dumper + Hook Bridge

| Task | Description |
|:-----|:------------|
| 6C.0 | **BLOCKER**: Research Claude Code hook type for message injection (PRD open question #1) |
| 6C.1 | File dumper: write to `~/.claude/mesh/{agent}.jsonl` |
| 6C.2 | Trigger file: touch `~/.claude/mesh/{agent}.trigger` |
| 6C.3 | Hook bridge script for Claude Code |
| 6C.4 | E2E test: agent receives mesh message in conversation |

**Exit criteria**: Groups, auth, and file-based Claude Code integration all working.

---

## Tier 3: Session Management + MCP CLI

### Phase 7: Session Save/Restore + Per-Agent Memory

**Repo**: `nsheaps/agent`
**Goal**: Agents persist state across sessions. Memory carries forward.
**Depends on**: Phase 2 (agent.yaml with `session.persist` field)

| Task | Description |
|:-----|:------------|
| 7.1 | Define session data format: transcript, memory, tasks, team context, workspace state (architecture doc §5) |
| 7.2 | Implement local filesystem backend: `~/.agent-team/sessions/{agent-id}/` |
| 7.3 | Implement session save on agent shutdown (hook into `agent kill`) |
| 7.4 | Implement session restore on `agent launch`: load memory.md into system prompt |
| 7.5 | Implement per-agent persistent memory file (`memory.md`) updated during session |
| 7.6 | Implement memory summarization/compression between sessions (prevent context overflow) |
| 7.7 | Add `session.persist` and `session.backend` to agent.yaml schema |
| 7.8 | Tests: shutdown → save → relaunch → memory present |

**Future (not this phase):**
- S3-compatible backend for cross-machine sessions
- Memory conflict resolution for concurrent sessions

**Exit criteria**: Agent shutdown saves memory. Agent relaunch loads previous memory into context. Memory grows incrementally across sessions.

---

### Phase 8: MCP CLI MVP

**Repo**: `nsheaps/mcp` → `packages/mcp-cli`
**Goal**: Basic MCP server management commands.
**Depends on**: Phase 3

| Task | Description |
|:-----|:------------|
| 8.1 | Create `packages/mcp-cli` with CLI framework |
| 8.2 | `mcp list-installed` — discover installed MCP servers across clients |
| 8.3 | `mcp install <server>` — install for a specified client |
| 8.4 | `mcp uninstall <server>` — remove config |
| 8.5 | `mcp doctor` — basic health checks |
| 8.6 | Client auto-detection (Claude Code, Cursor, etc.) |
| 8.7 | Tests |

**Exit criteria**: `mcp install github --client claude-code` works correctly.

---

## Tier 4: Container + Infrastructure

### Phase 9: Docker Container Execution Backend

**Repo**: `nsheaps/agent`
**Goal**: Launch agents in Docker containers with framework-specific images.
**Depends on**: Phase 2 (agent.yaml with `container` field)

| Task | Description |
|:-----|:------------|
| 9.1 | Add `container` section to agent.yaml schema (image, dockerfile, resources, volumes, env) |
| 9.2 | Implement `agent launch --backend docker`: build/pull image, `docker run` with mounted volumes |
| 9.3 | Create base Dockerfile for Claude Code agents |
| 9.4 | Implement per-agent Dockerfiles (engineer, researcher, ops per architecture doc §3) |
| 9.5 | Port forwarding for mesh MCP client inside container |
| 9.6 | Credential passing (API keys via Docker secrets or env) |
| 9.7 | `agent kill` support for container backend (docker stop + config cleanup) |
| 9.8 | Tests: full lifecycle in Docker |

**Exit criteria**: `agent launch engineer --backend docker` runs engineer agent in a container with proper tools, volumes, and mesh connectivity.

---

### Phase 10: Redis Clustering for Mesh

**Repo**: `nsheaps/mcp` → `packages/mesh-server`
**Goal**: Horizontal scaling of mesh server.
**Depends on**: Phase 6

| Task | Description |
|:-----|:------------|
| 10.1 | Add Redis adapter to Socket.io server |
| 10.2 | Configure sharded adapter for Redis 7.0+ |
| 10.3 | Sticky session documentation for Ingress |
| 10.4 | Cross-server message delivery tests |
| 10.5 | Document message ordering limitation across servers |
| 10.6 | Load test |

**Exit criteria**: Mesh server runs as 2+ replicas coordinated via Redis.

---

### Phase 11: Kubernetes Deployment

**Repo**: `nsheaps/mcp` (manifests in `deploy/`)
**Goal**: K8s manifests for all server components.
**Depends on**: Phase 10, Phase 9

| Task | Description |
|:-----|:------------|
| 11.1 | Helm chart or kustomize base for mesh server (Deployment + Service + Ingress) |
| 11.2 | Redis StatefulSet manifests |
| 11.3 | Gateway manifests (Deployment + Service) |
| 11.4 | Daemon manifests (DaemonSet or StatefulSet) |
| 11.5 | ConfigMap/Secret templates for auth |
| 11.6 | Test in local k8s (kind or minikube) |

**Exit criteria**: `kubectl apply` deploys functional stack in a k8s cluster.

---

## Tier 5: Advanced Features

### Phase 12: Inspector, Gateway, Daemon

**Repo**: `nsheaps/mcp`
**Depends on**: Phase 8 (MCP CLI)

#### 12A: Inspector

| Task | Description |
|:-----|:------------|
| 12A.1 | MCP inspection proxy |
| 12A.2 | Web UI: tools, resources, live calls |
| 12A.3 | `mcp server inspect <server>` CLI |

#### 12B: Gateway

| Task | Description |
|:-----|:------------|
| 12B.1 | MCP proxy with auth, policy, audit logging |
| 12B.2 | Tool allowlist/blocklist enforcement |
| 12B.3 | Rate limiting |

#### 12C: Daemon

| Task | Description |
|:-----|:------------|
| 12C.1 | `mcp run-once -- <command>` singleton process manager |
| 12C.2 | Multiplexer via streaming HTTP |
| 12C.3 | Ephemeral + persistent modes |

---

### Phase 13: Security Consultant Agent

**Repo**: `nsheaps/agent-team` (definition) + `nsheaps/agent` (implementation)
**Goal**: Specialized agent that gates runtime permissions and advises on agent configuration.
**Depends on**: Phase 2 (agent.yaml), Phase 6B (auth), Phase 6C (hooks)

| Task | Description |
|:-----|:------------|
| 13.1 | Design security consultant agent definition (agent.yaml + prompt.md) |
| 13.2 | Implement `PreToolUse` hook interception for permission requests |
| 13.3 | Implement approval scope: per-action, per-session, permanent |
| 13.4 | Implement permission escalation chain: agent → security consultant → user |
| 13.5 | Integrate with per-agent tool set configuration (Phase 2) |
| 13.6 | Define trust model: what can the consultant approve without user involvement? |
| 13.7 | Tests for permission escalation flows |

**Design questions to resolve before implementation:**
- How does the consultant intercept permission requests? (PreToolUse hook?)
- Approval scope tracking and expiration
- Interaction with Claude Code's existing permission modes

**Exit criteria**: Permission requests route through security consultant. Consultant can approve/deny/escalate. Approvals are scoped and tracked.

---

### Phase 14: A2A Protocol Integration

**Repo**: `nsheaps/mcp` or `nsheaps/agent`
**Goal**: Integrate Google's A2A protocol for cross-framework agent communication.
**Depends on**: Phase 5 (mesh working), requires research first

| Task | Description |
|:-----|:------------|
| 14.0 | **Research**: A2A protocol maturity, adoption, mapping to existing primitives |
| 14.1 | Design A2A ↔ mesh MCP bridge |
| 14.2 | Implement A2A agent discovery and capability advertisement |
| 14.3 | Implement structured task delegation via A2A |
| 14.4 | Cross-framework test: Claude Code agent ↔ non-Claude agent via A2A |

**Exit criteria**: Agents using different frameworks can communicate via A2A through the mesh.

---

### Phase 15: Session S3 Backend + Cross-Machine

**Repo**: `nsheaps/agent`
**Goal**: Session persistence to S3 for cross-machine agent mobility.
**Depends on**: Phase 7 (local session save/restore)

| Task | Description |
|:-----|:------------|
| 15.1 | Implement S3-compatible backend for session storage |
| 15.2 | Session upload on agent shutdown, download on launch |
| 15.3 | Memory conflict resolution for concurrent sessions |
| 15.4 | Encryption at-rest and in-transit |
| 15.5 | Tests: save on machine A, restore on machine B |

**Exit criteria**: Agent can be killed on one machine and relaunched on another with full memory.

---

### Phase 16: K8s Controller (Go)

**Repo**: `nsheaps/agent` or new `nsheaps/agent-controller`
**Language**: **Go** (controller-runtime / kubebuilder)
**Depends on**: Phase 2 (agent.yaml), Phase 11 (k8s deployment)

| Task | Description |
|:-----|:------------|
| 16.1 | Define Agent CRD |
| 16.2 | Scaffold controller with kubebuilder |
| 16.3 | Implement reconciler: create/update/delete agent pods |
| 16.4 | Integration with mesh server (auto-register, inject auth) |
| 16.5 | Team-level CRD for agent group management |
| 16.6 | Tests with envtest |

**Exit criteria**: `kubectl apply -f agent.yaml` launches a fully configured agent pod.

---

## Architecture: Two-Process Mesh Design

Per the engineering review's critical finding:

```
┌─────────────────────────────────────────┐
│         REMOTE: Mesh Server              │
│  (Deployment, one or more instances)     │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ Socket.io    │  │ Presence Manager│  │
│  │ Server       │  │                 │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ Message      │  │ Auth Module     │  │
│  │ Router       │  │ (JWT)           │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ Group/Channel│  │ Redis Adapter   │  │
│  │ Manager      │  │ (Phase 10+)     │  │
│  └──────────────┘  └─────────────────┘  │
└────────────────────┬────────────────────┘
                     │ Socket.io (WSS)
┌────────────────────┴────────────────────┐
│         LOCAL: Mesh MCP Client           │
│  (Runs per-agent, MCP stdio server)      │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ MCP Stdio    │  │ Socket.io       │  │
│  │ Interface    │  │ Client          │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ File Dumper  │  │ Hook Bridge     │  │
│  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────┘
         ↑
    Agent (Claude Code)
```

### Package Structure (nsheaps/mcp monorepo)

```
nsheaps/mcp/
├── packages/
│   ├── socketio-transport/     ← Phase 4: reusable Socket.io wrapper
│   ├── mesh-server/            ← Phase 5A: remote mesh server
│   ├── mesh-client/            ← Phase 5B: local MCP stdio client
│   ├── mcp-cli/                ← Phase 8: CLI tool
│   ├── inspector/              ← Phase 12A
│   ├── gateway/                ← Phase 12B
│   └── daemon/                 ← Phase 12C
```

### Agent Definition Structure (nsheaps/agent-team)

```
agents/
├── engineer/
│   ├── agent.yaml
│   ├── Dockerfile
│   ├── prompt.md
│   ├── persona.md
│   └── behaviors/
├── researcher/
│   └── ...
└── shared/
    ├── base.Dockerfile
    ├── behaviors/
    └── types/
```

---

## Dependency Graph

```
Phase 1 (agent lifecycle MVP) ← FIRST PRIORITY
  └── Phase 2 (agent.yaml schema + tool sets)
        ├── Phase 7 (session save/restore + memory)
        │     └── Phase 15 (S3 backend, cross-machine)
        ├── Phase 9 (Docker container backend)
        │     └── Phase 11 (k8s deployment)
        │           └── Phase 16 (k8s controller, Go)
        └── Phase 13 (security consultant agent)

Phase 3 (mcp monorepo foundation) [parallel with Phase 1]
  ├── Phase 4 (socketio-transport)
  │     └── Phase 5 (mesh server + client MVP)
  │           └── Phase 6 (groups + auth + file dumper)
  │                 ├── Phase 10 (Redis clustering)
  │                 │     └── Phase 11 (k8s deployment)
  │                 └── Phase 14 (A2A protocol)
  │
  └── Phase 8 (MCP CLI MVP)
        └── Phase 12 (inspector + gateway + daemon)
```

## Parallel Tracks

| Track | Phases | Start Condition |
|:------|:-------|:----------------|
| **Agent lifecycle** (primary) | 1 → 2 → 7 → 9 → 15 | Immediately |
| **Mesh communication** | 3 → 4 → 5 → 6 → 10 | Parallel with Phase 1 |
| **MCP tooling** | 3 → 8 → 12 | After Phase 3 |
| **Security** | 13 | After Phases 2 + 6 |
| **A2A** | 14 | After Phase 5 + research |
| **K8s** | 11 → 16 | After Phases 9 + 10 |

---

## Blockers & Risks

| Risk | Impact | Mitigation |
|:-----|:-------|:-----------|
| **Claude Code hook type for message injection** (PRD open question #1) | Blocks Phase 6C | Research before 6C starts; mesh MVP works without hooks |
| **Team config file format stability** | Phase 1 depends on understanding `config.json` structure | team-member-cleanup.md documents the current format |
| **Socket.io vs raw WebSockets** (engineering review §3.2) | Architecture choice for Phase 4 | Start with Socket.io; abstracted behind `socketio-transport` package |
| **agent.yaml schema churn** | Phases 7, 9, 13 all extend the schema | Define extension points in Phase 2; accept churn as normal for draft |
| **A2A protocol maturity** | May not be ready for production | Phase 14 is late-stage and research-gated |
| **Memory context overflow** | Loading too much session history into agent context | Phase 7 includes summarization/compression |

---

## Design Topics Integration Map

Shows where each architecture doc topic lands in the phase plan:

| Architecture Doc Topic | Primary Phase | Secondary Phases |
|:---|:---|:---|
| **Security consultant agent** | Phase 13 | Phase 2 (tool sets enable restriction) |
| **Per-agent tool set configuration** | Phase 2 | Phase 13 (security consultant enforces) |
| **Docker container execution backend** | Phase 9 | Phase 11 (k8s), Phase 16 (controller) |
| **Agent definition code structure** | Phase 2 | All subsequent phases extend agent.yaml |
| **Session save/restore** | Phase 7 (local) | Phase 15 (S3/cross-machine) |
| **Per-agent persistent memory** | Phase 7 | — |
| **A2A protocol integration** | Phase 14 | Phase 13 (permission escalation could use A2A) |

---

## Open Questions for Team Lead

1. **Phase 1 scope**: Should `agent launch` support both tmux and in-process backends from day 1, or tmux-only for MVP?
2. **Agent definition location**: Should agents live in `nsheaps/agent-team/agents/` or `nsheaps/agent/agents/`? The architecture doc implies agent-team, but the launcher is in agent.
3. **Phase 3 timing**: Start the mcp monorepo in parallel with Phase 1, or wait until lifecycle is proven?
4. **Phase 6C blocker**: Should Road Runner research the Claude Code hook type question now?
5. **Helm vs Kustomize**: Preference for Phase 11 k8s manifests?

---

## References

- [Agent Team Architecture](agent-team-architecture.md) — 7 design topics
- [Mesh MCP Server PRD](mesh-mcp-server.md) — real-time agent communication
- [Agent Wrapper PRD](https://github.com/nsheaps/agent/blob/main/docs/specs/draft/agent-wrapper.md)
- [MCP Tooling PRD](https://github.com/nsheaps/mcp/blob/main/docs/specs/draft/mcp-tooling.md)
- [Engineering Review](../../.claude/tmp/mesh-mcp-engineering-review.md) (Task #87)
- [Team Member Cleanup Behavior](../../.claude/behaviors/team-member-cleanup.md)
- [A2A Protocol](https://google.github.io/A2A/)
- Language Decision — Task #90 (TypeScript/Bun for all, Go for K8s controller only)
