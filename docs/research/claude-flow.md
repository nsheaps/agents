# Research: Claude-Flow

**Source**: https://github.com/ruvnet/claude-flow
**Author**: Reuven Cohen (ruvnet)
**Research date**: 2026-02-16
**Researcher**: Tweety Bird (Docs Writer)

---

## 1. What Is Claude-Flow?

Claude-Flow (also "Ruflo v3") is an open-source multi-agent orchestration platform that extends Claude Code with enterprise-grade swarm intelligence. It enables coordinating 60+ specialized agents working on complex software engineering tasks through hierarchical or mesh topologies, consensus algorithms, persistent vector memory, and self-optimizing routing.

> "Transforms complex, multi-step processes into manageable, automated workflows that leverage the collective intelligence of specialized agents."

**Key stats** (from README and npm):

- 14.1k GitHub stars
- ~500,000 total downloads, ~100,000 monthly active users across 80+ countries
- 84.8% SWE-Bench solve rate
- 250,000+ lines of TypeScript and WASM code (v3 rebuild)

**Installation**:

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/claude-flow@main/scripts/install.sh | bash
```

Requires Node.js 20+, npm 9+, and Claude Code pre-installed.

### Problem It Solves

Single-agent Claude Code sessions have inherent limitations: one assistant per session, no persistent learning between tasks, no fault tolerance, and no way to coordinate parallel specialized agents. Claude-Flow addresses these by providing:

- Multi-agent coordination with configurable topologies
- Persistent memory that survives context compaction
- Consensus algorithms for group decision-making
- Intelligent routing and task assignment
- Cost optimization through caching and multi-provider support

---

## 2. Architecture and Design Patterns

### Dual-Layer Model

Claude-Flow operates as a dual-layer system:

| Layer                              | Role                                                                  |
| :--------------------------------- | :-------------------------------------------------------------------- |
| **Orchestrator** (Claude-Flow)     | Tracks state, stores memory, coordinates agents, learns from patterns |
| **Executors** (Claude Code agents) | Write code, run commands, implement solutions                         |

The orchestrator learns from work performed by executors through cross-learning.

### Request Flow

1. Requests enter through CLI or MCP interfaces with security validation
2. An intelligent router directs tasks using Q-Learning and Mixture of Experts (MoE) agent selection
3. Tasks are assigned to appropriate agents based on specialization
4. Agents execute with parallel, sequential, adaptive, balanced, or stream-chained strategies
5. Results persist to memory; patterns are learned for future optimization

### Three Topology Options

1. **Hierarchical** — Queen-led coordination with specialized workers, organized in tree structure. Best for structured workflows.
2. **Mesh** — Peer-to-peer, fault-tolerant without central leadership. Best for autonomous, distributed work.
3. **Adaptive** — Dynamic switching between hierarchical and mesh based on workload. Best for variable demands.

### Agent Classification

64 agents organized into specialized roles:

- **3 Queen Types**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
- **8 Worker Types**: developer, tester, analyzer, reviewer, security, database, frontend, backend specialists
- Each agent has defined priorities, pre/post-execution hooks, capability tracking, and message metrics

### Key Design Patterns

| Pattern                        | Description                                                                        |
| :----------------------------- | :--------------------------------------------------------------------------------- |
| **Hive-Mind Swarm**            | Collective intelligence through aggregation and Byzantine fault tolerance          |
| **Blackboard Pattern**         | Shared state board with TTL-based hints (1800s default), non-blocking coordination |
| **Producer-Consumer Chaining** | Stream-JSON for real-time agent-to-agent output piping (40-60% faster than files)  |
| **Queen-Led Hierarchies**      | Central coordinator prevents drift, maintains authoritative state                  |
| **Artifact-Centric Design**    | Lightweight manifests (id, kind, tags, checksum) instead of copying large content  |

---

## 3. Comparison to Native Claude Code Agent Teams

### Architectural Similarity

A [comparison gist by the author](https://gist.github.com/ruvnet/18dc8d060194017b989d1f8993919ee4) claims **92% architectural similarity** to Claude Code's TeammateTool:

| Aspect           | Claude-Flow                                 | Native Agent Teams                   |
| :--------------- | :------------------------------------------ | :----------------------------------- |
| Team Abstraction | "Swarm"                                     | "Team"                               |
| Topologies       | Hierarchical, mesh, adaptive                | Hierarchical, mesh                   |
| Agent Roles      | Coordinator, coder, tester, reviewer, etc.  | Identical role patterns              |
| Messaging        | Direct send, broadcast, priority            | Direct send, broadcast               |
| Consensus        | Raft, Byzantine, Gossip, Paxos              | Simple voting via messaging          |
| Execution        | In-process or tmux-based                    | In-process or tmux-based             |
| File Persistence | Optional (`.swarm/memory.db`)               | Required (`~/.claude/teams/`)        |
| Memory           | HNSW-indexed vector DB, survives compaction | Context-window bound, no persistence |

### Where Claude-Flow Goes Further

- **Persistent memory**: HNSW vector database survives context compaction; native teams lose context
- **Consensus algorithms**: Raft, Byzantine FT, Gossip, Paxos vs. simple majority-based messaging
- **Agent count**: 60+ pre-built vs. manual configuration
- **Self-optimization**: RuVector neural architecture with <0.05ms adaptation
- **Multi-provider**: Claude, GPT, Gemini, Cohere, local models with automatic failover
- **Cost optimization**: 30-50% token reduction via pattern caching; 85% potential savings via routing

### Where Native Teams Excel

- **Simpler setup**: Built into Claude Code, no external dependencies
- **Better UX**: Native IDE integration, tmux pane management
- **Lighter weight**: No additional infrastructure (SQLite, WASM, vector DB)
- **Production stability**: Anthropic-maintained, consistent behavior
- **Faster for small teams**: 2-5 agents with quick parallel work

### Community Assessment

From a [real-world bake-off](https://medium.com/@derekcashmore/claude-code-agent-teams-vs-claude-flow-a-real-world-bake-off-97e24f6ca9b9):

> "Claude-Flow is the tool for maximum depth, control, and extensibility. Agent Teams feels like Anthropic's effort to make agentic workflows mainstream and accessible."

---

## 4. Features Beyond Native Agent Teams

### Intelligence Layer (RuVector)

- **SONA** (Self-Optimizing Neural Architecture): Learns from successful patterns with <0.05ms adaptation latency
- **ReasoningBank**: Persistent pattern storage with semantic search
- **HNSW Vector Search**: 150-12,500x speedup in memory retrieval
- **Multiple RL Algorithms**: Q-Learning for routing, MoE for agent selection

### Agent Booster (WebAssembly)

Handles simple code transforms (variable-to-const, etc.) in <1ms without LLM calls. 352x speedup for routine operations, reducing API costs and latency.

### Stream-JSON Chaining

Real-time agent-to-agent output piping without intermediate file storage. Downstream agents begin processing immediately upon upstream completion. **40-60% faster** than file-based handoffs.

### MCP Integration

175+ MCP tools for orchestration, memory, topology optimization, and reporting. Installed via:

```bash
claude mcp add ruflo -- npx -y ruflo@latest mcp start
```

### Token Optimizer

30-50% API cost reduction through compression, caching, and intelligent context pruning. 95% cache hit rate for common operations.

### Multi-Provider Support

Provider-agnostic agent definitions with automatic failover between Claude, GPT, Gemini, Cohere, and local models. This aligns directly with our agent-team project's provider-agnostic vision (see `docs/specs/draft/agent-team-project.md`).

---

## 5. Communication and Task Management

### Agent Communication

Three communication channels:

1. **Blackboard Pattern**: Agents write hints to `shared_state` with configurable TTLs. Lightweight, non-blocking.
2. **Direct Messaging**: Agent-to-agent send, broadcast, priority-based handling with acknowledgments.
3. **Stream-JSON Chaining**: Real-time output piping for pipeline architectures.

### Memory Architecture

12-table SQLite schema (`.swarm/memory.db`):

| Table                 | Purpose                           |
| :-------------------- | :-------------------------------- |
| `shared_state`        | Current swarm state and hints     |
| `events`              | Audit trail of all transitions    |
| `workflow_state`      | Active workflow information       |
| `patterns`            | Learned successful patterns       |
| `consensus_state`     | Voting records and decisions      |
| `performance_metrics` | Agent and swarm metrics           |
| `artifacts`           | Artifact manifests and references |
| (5 more)              | Checkpoints, learning, telemetry  |

### Task Management

- Tasks define explicit dependencies, execution strategy, resource requirements, and success criteria
- **OODA Cycle** mapping: Observe (query events) -> Orient (build minimal bundle) -> Decide (consensus vote) -> Act (execute, record)
- Checkpoint-based state management with recovery capability
- Minimal context bundles (kilobytes, not megabytes) injected at `PreToolUse`

### Persistence

- SQLite with write-ahead logging for reliability
- HNSW indexing for semantic search across patterns
- Artifact-centric design: store lightweight manifests, reference by ID across agents
- Memory survives context compaction (unlike native agent teams)

---

## 6. Lessons for Our Orchestration Approach

### Patterns Worth Adopting

1. **Artifact-centric communication** — Our current approach of saving reports to `.claude/tmp/` files is already artifact-centric. Claude-Flow formalizes this with manifests (id, kind, tags, checksum). We could add lightweight metadata to our shared files.

2. **Minimal context bundles** — Claude-Flow injects only top-5 relevant artifacts at `PreToolUse`. Our agents currently read all `.claude/docs/` at session start. A more selective approach could reduce context overhead.

3. **OODA cycle for task execution** — Claude-Flow maps Observe/Orient/Decide/Act to workflow stages. Our orchestrator could formalize this pattern for task assignment and coordination.

4. **Stream-based handoffs** — Claude-Flow's stream-JSON chaining eliminates file I/O bottleneck. While we can't implement this with native agent teams (we use SendMessage + files), it's a pattern to consider for the standalone agent-team project.

5. **Event audit trail** — Claude-Flow records every transition as an event. Our Coach role already observes failures, but a structured event log would enable better post-mortem analysis.

### Anti-Patterns to Avoid

1. **Over-engineering consensus** — Claude-Flow implements Raft, Byzantine FT, Gossip, and Paxos. For teams of 8 agents, this is overkill. Our simple messaging + team-lead coordination is appropriate for our scale.

2. **Excessive agent count** — 64 agents creates coordination overhead. Our 8-agent roster with clear role boundaries is more manageable and easier to debug.

3. **Complex memory infrastructure** — HNSW vector DB, ReasoningBank, and 12-table SQLite schemas add significant complexity. Our file-based approach (`.claude/tmp/`, task list) is simpler and sufficient for our needs.

4. **Alpha instability** — Claude-Flow v3 has known critical bugs (installation failures, broken memory, TypeError on task queries). Our approach of building on stable native features is lower risk.

### Integration Ideas

1. **MCP server for team memory** — Claude-Flow exposes memory as MCP tools. We could build a lightweight MCP server that provides persistent team state across sessions without the full Claude-Flow stack.

2. **Provider-agnostic agent definitions** — Claude-Flow's multi-provider support validates our agent-team project's vision. Their approach of provider-agnostic agent configs is directly applicable.

3. **Topology concepts** — While we use a fixed hierarchy today, the concept of adaptive topology (switching between hierarchical and mesh based on workload) is worth considering as the team grows.

---

## 7. Performance Claims (Unverified)

These metrics are from the project's own documentation and should be treated as claims, not independently verified benchmarks:

| Metric                  | Claim                             |
| :---------------------- | :-------------------------------- |
| Task execution speed    | 2.8-4.4x faster than single agent |
| SWE-Bench solve rate    | 84.8%                             |
| Stream-JSON vs file I/O | 40-60% faster                     |
| Agent Booster (WASM)    | 352x speedup for simple edits     |
| HNSW vector search      | 150-12,500x speedup               |
| Token optimization      | 30-50% API cost reduction         |
| Multi-provider routing  | 85% potential cost savings        |
| SONA adaptation latency | <0.05ms                           |

---

## 8. Open Questions

1. **Real-world reliability**: The project is in alpha (v3.1.0-alpha.13). Multiple GitHub issues report critical bugs. How stable is it for production use?
2. **Benchmarking methodology**: The 84.8% SWE-Bench claim and speed metrics lack methodology details. Are these reproducible?
3. **Adoption depth**: 14.1k stars and 500k downloads are impressive, but how many users run multi-agent swarms in production vs. using it as a curiosity?
4. **Native teams convergence**: As Anthropic improves native agent teams, will Claude-Flow's value proposition shrink? Or will it remain the "power user" tool?
5. **ReasoningBank performance**: 10-45 seconds per embedding operation is noted as a known limitation. How does this affect real-world workflow speed?

---

## Sources

### Primary

- [GitHub: ruvnet/claude-flow](https://github.com/ruvnet/claude-flow)
- [npm: claude-flow](https://www.npmjs.com/package/claude-flow)
- [Official website: claude-flow.ruv.io](https://claude-flow.ruv.io/)

### Architecture and Design

- [Workflow Orchestration Wiki](https://github.com/ruvnet/claude-flow/wiki/Workflow-Orchestration)
- [Agent System Overview Wiki](https://github.com/ruvnet/claude-flow/wiki/Agent-System-Overview)
- [Architectural Comparison Gist](https://gist.github.com/ruvnet/18dc8d060194017b989d1f8993919ee4) — Claude Flow V3 vs Claude Code TeammateTool
- [Advanced Coordination Playbook](https://gist.github.com/ruvnet/9b066e77dd2980bfdcc5adf3bc082281)

### Community and Reviews

- [Agent Teams vs Claude-Flow: Real-World Bake-Off](https://medium.com/@derekcashmore/claude-code-agent-teams-vs-claude-flow-a-real-world-bake-off-97e24f6ca9b9) — Derek Cashmore
- [From Tasks to Swarms: Agent Teams in Claude Code](https://alexop.dev/posts/from-tasks-to-swarms-in-claude-code/)
- [How to Set Up Claude Code Agent Teams](https://darasoba.medium.com/how-to-set-up-and-use-claude-code-agent-teams-and-actually-get-great-results-9a34f8648f6d)

### Related Projects

- [GitHub: ruvnet/agentic-flow](https://github.com/ruvnet/agentic-flow) — Cloud deployment of Claude agents
- [GitHub: bobmatnyc/claude-pm](https://github.com/bobmatnyc/claude-pm) — Subprocess orchestration
- [GitHub: ananddtyagi/claude-code-marketplace](https://github.com/ananddtyagi/claude-code-marketplace)

### Known Issues

- [Issue #1082: Opus 4.6 Native Agent Teams — 28 Ways Claude-Flow Becomes Indispensable](https://github.com/ruvnet/claude-flow/issues/1082)
- [Issue #1098: Claude Agent Teams Integration](https://github.com/ruvnet/claude-flow/issues/1098)
- [Issue #958: Performance Issues in V3](https://github.com/ruvnet/claude-flow/issues/958)
- [Issue #559: V2.0.0-alpha.83 Critical Fixes](https://github.com/ruvnet/claude-flow/issues/559)
