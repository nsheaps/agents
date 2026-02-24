# Agent Memory Mechanisms Research

**Author**: Road Runner (Deep Researcher)
**Date**: 2026-02-23
**Scope**: All agent memory mechanisms, sync patterns, repo structures, security, and backend separation — informing the agent-team memory spec
**Confidence**: High (50+ sources cross-referenced across code, docs, GitHub, and web)
**Informs**: Task [agent-team#116](https://github.com/nsheaps/agent-team/issues/116) and [agent-team#117](https://github.com/nsheaps/agent-team/issues/117) (Draft agent memory spec)

---

## Question

What memory mechanisms exist for AI agents? How should agent-team implement persistent memory with sync, security, and proper backend separation?

## Answer

Seven memory mechanism categories exist, ranging from Claude Code's built-in MEMORY.md (simplest) to distributed vector stores (most complex). For agent-team, the evidence suggests a **layered approach**: Claude Code's native file-based memory for individual agents, git-backed storage for team-shared knowledge, and optional MCP-based backends for semantic search. Git-backed memory is the emerging industry standard for coding agents (GitHub Copilot, Letta, GCC all use it). Redis and vector stores are best reserved for production deployments requiring real-time access or semantic retrieval at scale.

---

## 1. Memory Mechanisms Evaluated

### 1.1 Claude Code MEMORY.md (Built-in)

**Confidence**: High — official docs + working examples in codebase

Claude Code's native auto-memory system stores agent learnings as markdown files.

| Property | Detail |
| --- | --- |
| Storage | `~/.claude/projects/<project>/memory/MEMORY.md` |
| Loading | First 200 lines injected into system prompt every session |
| Format | Markdown with topic files for overflow |
| Persistence | Filesystem-based, survives sessions and compaction |
| Isolation | Complete — agents cannot read each other's memory |
| API | File-based only (Read/Write/Edit tools) |

**Three agent memory scopes** (via frontmatter `memory:` field):

| Scope | Location | Sharing | Use Case |
| --- | --- | --- | --- |
| `user` | `~/.claude/agent-memory/<agent>/` | Cross-project, same machine | Generic agent learnings |
| `project` | `.claude/agent-memory/<agent>/` | Via git (team-shared) | Project-specific, collaborative |
| `local` | `.claude/agent-memory-local/<agent>/` | None (gitignored) | Sensitive project-specific data |

**Current state in agent-team**: Only `ai-agent-eng.md` has `memory: project` set. No other agents have memory configured.

**Key limitation**: 200-line hard limit. Content beyond line 200 requires manual file read. Mitigation: use MEMORY.md as a concise index linking to topic files (`debugging.md`, `patterns.md`, etc.).

**Sources**:
- [Claude Code Memory Docs](https://code.claude.com/docs/en/memory)
- [Claude Code Sub-agents Docs](https://code.claude.com/docs/en/sub-agents)
- Working example: `~/.claude/projects/-Users-nathan-heaps-src-nsheaps-claude-utils/memory/MEMORY.md`
- [Option to disable auto-memory #23750](https://github.com/anthropics/claude-code/issues/23750)

### 1.2 Serena MCP

**Confidence**: Medium-High — GitHub repo reviewed, limited memory documentation

Serena is primarily a **coding toolkit** (semantic code understanding, symbol-level analysis), not a memory server. It has a secondary memory system at `.serena/memories/` for context persistence, but this is underdocumented and not its focus.

**Verdict**: Excellent for code-aware agent teams needing IDE-like navigation. Not suitable as a primary memory backend.

**Source**: [GitHub - oraios/serena](https://github.com/oraios/serena)

### 1.3 MCP Memory Servers

**Confidence**: High — 9 implementations analyzed

No single standardized MCP memory interface exists. Different servers implement different schemas:

| Server | Type | Storage | Concurrency | Semantic Search | Agent Identity | Best For |
| --- | --- | --- | --- | --- | --- | --- |
| Official MCP Memory | Knowledge Graph | JSONL file | No | Limited | No | Single agent, simple knowledge |
| [claude-memory-mcp](https://github.com/WhenMoon-afk/claude-memory-mcp) | Identity System | Local files | No | No | **Yes** | Agent self-knowledge, personality |
| [Mem0 (cloud)](https://docs.mem0.ai/platform/mem0-mcp) | Key-Value | Cloud/Supabase | Yes | Optional | No | Cloud-native, multi-user |
| Mem0 (OpenMemory) | Key-Value | Local | Limited | Optional | No | Local-first, private |
| [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) | Hybrid | SQLite/PostgreSQL/ChromaDB | Yes | Optional | No | Multi-agent, enterprise |
| [mcp-qdrant-memory](https://github.com/delorenj/mcp-qdrant-memory) | Graph+Vector | Qdrant | Yes | **Yes** | No | Semantic knowledge graphs |
| Neo4j MCP | Graph | Neo4j | Yes | Optional | No | Complex relationships |
| Vector Memory MCP | Vector DB | SQLite-vec | Limited | **Yes** | No | Lightweight semantic search |

**Key insight**: `claude-memory-mcp` is the only server focused on agent identity persistence (soul.md, identity-anchors, observation promotion). This maps well to agent-team's character-based agents who need persistent personality.

**Limitation for agent teams**: No agent-scoped MCP configuration exists — all teammates get the same MCP servers. Cannot give one teammate memory and another none. ([GitHub #4476](https://github.com/anthropics/claude-code/issues/4476))

### 1.4 Git-Backed Memory

**Confidence**: High — three major implementations confirmed

Git-backed memory is the emerging standard for coding agents:

**GitHub Copilot's Agentic Memory** ([source](https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/)):
- Just-in-time citation verification (memories store code references, verified on retrieval)
- 7% increase in PR merge rates, 2% improvement in code review ratings
- Cross-agent learning: discoveries by one agent become accessible to others

**Letta Context Repositories** ([source](https://www.letta.com/blog/context-repositories)):
- MemFS: folders of Markdown files with frontmatter, auto-versioned with git commits
- Progressive disclosure: agents manage what's pinned to system prompt vs archived
- Concurrent learning via git worktrees (each subagent works in separate worktree)

**Git Context Controller (GCC)** ([source](https://arxiv.org/html/2508.00031v1)):
- Three-tier file structure: main.md (global roadmap), branch-specific commit.md/log.md
- Operations: COMMIT (checkpoint), BRANCH (experiment), MERGE (synthesize), CONTEXT (retrieve)
- Each branch is a safe workspace for exploration without affecting the main plan

**Strengths**: Full version control, familiar tools, works offline, built-in conflict resolution, natural audit trail.
**Limitations**: Latency for push/pull (seconds, not milliseconds), merge conflicts for concurrent updates, not ideal for >100 updates/minute.

### 1.5 Redis / Key-Value Stores

**Confidence**: High — official Redis agent memory server + LangGraph integration documented

Redis provides the best real-time performance (<1ms latency, 100k+ ops/sec).

**Two-tier architecture** (confirmed in [Redis Agent Memory Server](https://redis.github.io/agent-memory-server/) and [LangGraph integration](https://redis.io/blog/langgraph-redis-build-smarter-ai-agents-with-memory-persistence/)):

| Tier | Purpose | Storage | TTL |
| --- | --- | --- | --- |
| Working memory | Session state, conversation context | RedisSaver (checkpoints) | Session duration |
| Long-term memory | Facts, patterns, preferences + vector embeddings | RedisStore (namespaced) | Indefinite or policy-based |

**Persistence options**: RDB snapshots (compact, risk of data loss), AOF (durable, slower), Hybrid RDB+AOF (recommended for production).

**Best for**: Real-time agent state checkpointing, cross-session persistent memories with semantic search, distributed agent teams, high-frequency updates.

### 1.6 Vector Stores

**Confidence**: High — multiple benchmarks and comparison guides

| Database | Type | Best For | Deployment |
| --- | --- | --- | --- |
| Pinecone | Serverless | Easiest to operate | Cloud only |
| Weaviate | Hybrid search | Keyword + semantic | Self-hosted or cloud |
| Qdrant | Open-source | High performance | Self-hosted or cloud |
| Chroma | Lightweight | Small/medium RAG | Embedded or standalone |
| Milvus | Distributed | Large-scale, high throughput | Self-hosted clusters |
| SQLite-vec | Lightweight | <1M embeddings, local | Embedded |
| PostgreSQL+pgvector | Hybrid | 100K–10M embeddings | Shared multi-user |

**Use cases for agents**: Cross-session context retrieval, pattern discovery, semantic deduplication, multi-agent knowledge sharing.

**When NOT to use**: Structured data (use SQL), exact matches (use keyword index), real-time updates (use Redis), small memory stores (file-based is simpler).

**Source**: [Best Vector Databases in 2026](https://www.firecrawl.dev/blog/best-vector-databases)

### 1.7 File-Based Memory (Rsync/Rclone/S3)

**Confidence**: High — mature tooling

Simple file sync with optional encryption:

| Tool | Mechanism | Best For |
| --- | --- | --- |
| rsync | Block-level incremental sync over SSH | Local-to-remote, fast incremental |
| rclone | Cloud storage sync (70+ providers) | S3/GCS/Azure, multi-provider backup |
| rclone crypt | Client-side AES-256-GCM encryption | Privacy-sensitive deployments |
| S3/GCS direct | SDK-based upload/download | Cloud-native workflows |

**Best for**: Git-backed memory with periodic cloud backup, air-gapped environments, small-medium stores (<1GB), compliance scenarios requiring encryption at rest.

---

## 2. Sync Patterns

### 2.1 Continuous (Real-Time)

| Backend | Latency | Best For |
| --- | --- | --- |
| Redis | <1ms | Session state, working memory, high-frequency updates |
| Vector store | 10-100ms | Semantic search, pattern matching |
| MCP memory server | 10-100ms | Tool-based memory operations within sessions |

Continuous sync requires an always-running backend (Redis instance, vector DB, or MCP server process).

### 2.2 GitHub Actions (Periodic/Event-Driven)

Three sync strategies:

1. **On-commit sync**: Triggered by memory file commits → validates structure → syncs to secondary backends
2. **Session-end sync**: Webhook at session close → compress session memory → push to long-term storage
3. **Scheduled sync**: Fixed schedule (6-12 hour intervals) → consolidate, archive, deduplicate

**Template** (from research):
```yaml
on:
  push:
    paths: ['.claude/memory/**']
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:
```

**Limitation**: GitHub Actions caches expire after 7 days. Use database checkpoints (Redis) or cloud storage (S3) for durable state.

**New capability**: [GitHub Agentic Workflows](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/) (`gh aw`) combine Actions with embedded AI agents. Lock file (`.lock.yml`) tracks state between runs. Could enable progressive learning across workflow runs.

### 2.3 Kubernetes (Sidecar Pattern)

**Architecture**:
```
Pod:
  - Container: agent (main)
  - Container: memory-sync (sidecar)
  - Volume: memory-pvc (shared)
```

Sidecar watches for memory file changes → syncs to remote backend (S3, Redis, git) → records audit log. Memory operations don't block agent execution.

**Storage options**: ConfigMap (static, <1MB), PersistentVolumeClaim (dynamic, recommended), external stores (S3, Redis, vector DB).

**Best for**: Production cloud-native deployments, agents requiring automatic restart/recovery, separate per-agent memory (StatefulSets).

### 2.4 Local (File-Based)

Claude Code's native approach:
- Agent writes to memory directory during session
- Files persist on local filesystem
- No automatic sync to remote — manual or hook-triggered
- Works offline, zero infrastructure

**Enhancement path**: Add git tracking to memory directories → commit on session end → push to remote.

---

## 3. Repository Structure

### 3.1 One Repo Per Agent

```
github.com/org/agent-alice-memory/
├── memory/facts.md
├── memory/session-logs/
└── memory/patterns/

github.com/org/agent-bob-memory/
├── memory/facts.md
└── ...
```

| Pros | Cons |
| --- | --- |
| Clear ownership | Harder cross-agent sharing |
| No merge conflicts | More repos to manage |
| Independent scaling | Knowledge silos |
| Easier access control | Redundant infrastructure |

**Best for**: Large teams (10+ agents), security-sensitive deployments, autonomous agents with distinct domains.

### 3.2 Centralized Org Repo

```
github.com/org/agent-team-memory/
├── agents/alice/facts.md
├── agents/bob/facts.md
├── agents/shared/cross-agent-patterns.md
└── agents/shared/team-conventions.md
```

| Pros | Cons |
| --- | --- |
| Cross-agent knowledge sharing | Merge conflicts for concurrent updates |
| Centralized discovery | One large repo (slower clone) |
| Unified team memory | All-or-nothing visibility |
| Single infrastructure | Merge bottleneck |

**Best for**: Small teams (2-6 agents), tight collaboration, shared knowledge base is critical.

### 3.3 Hybrid Federated (Recommended for agent-team)

```
github.com/org/agent-alice-memory/
├── memory/ (private to alice)
└── team-memory (submodule → org/agent-team-shared)

github.com/org/agent-team-shared/
├── patterns/
├── conventions/
└── cross-team-knowledge/
```

| Pros | Cons |
| --- | --- |
| Isolation + sharing | Submodule complexity |
| Explicit knowledge promotion | Requires workflow discipline |
| Cleaner merge workflow | Additional repos |
| Scalable to 20+ agents | Promotion is manual |

**Access control** (via CODEOWNERS):
```yaml
agents/alice/private/   @alice
agents/bob/private/     @bob
agents/*/public/        @org/agents
agents/shared/          @org/leads
```

**Best for**: Medium teams (6-20 agents), balance of collaboration and autonomy.

---

## 4. Security

### 4.1 What Data Should Be in Memory

**Safe for memory (including git-backed)**:
- Code patterns and conventions
- Architecture decisions and rationale
- Debugging solutions and common errors
- Project structure and key file locations
- Tool preferences and workflow habits
- Agent personality and communication style
- Team procedures and coordination patterns

### 4.2 What Should NOT Be in Git

**Never store in version-controlled memory**:
- API keys, tokens, passwords, secrets
- Personal identifiable information (PII)
- Private user data or communications
- Authentication credentials
- Session tokens or temporary auth state
- Internal security configurations

### 4.3 Encryption Options

| Approach | Implementation | Trade-Off |
| --- | --- | --- |
| Provider-managed (S3 SSE-S3) | AWS manages keys | Simple, no extra cost |
| Customer-managed (S3 SSE-KMS) | You manage KMS keys | Better control, $1/10k requests |
| Client-side (rclone crypt) | AES-256-GCM before upload | Full privacy, key management burden |
| Database-level | Encrypt at storage layer | Transparent to app |
| git-crypt | Transparent encryption in git | Per-file encryption, GPG keys |

**Recommendation**: For agent-team, client-side encryption (rclone crypt or git-crypt) provides the strongest guarantees — the storage provider never sees plaintext. Use provider-managed encryption as a baseline for cloud backups.

### 4.4 Agent Isolation Concerns

- Claude Code agent memory is fully isolated (Agent A cannot read Agent B's memory)
- `user` scope memory is shared across all projects on the same machine — be aware of data leakage between projects
- `project` scope memory is committed to git — all team members and CI see it
- `local` scope is gitignored — safest for sensitive project-specific data
- MCP memory servers are shared by all teammates (no agent-scoped MCP config yet)

---

## 5. Backend Separation

### 5.1 Three Backend Layers

The evidence suggests separating memory into three distinct backends:

**Memory Backend** (individual agent knowledge):
- What: Personal learnings, patterns, debugging insights, preferences
- Storage: Claude Code's native `memory:` frontmatter (file-based)
- Scope: Per-agent, isolated
- Sync: Local filesystem, optionally git-tracked for `project` scope
- Example: ai-agent-eng remembers common failure patterns across sessions

**Agent Backend** (agent identity and personality):
- What: Core identity, communication style, character traits, self-knowledge
- Storage: `claude-memory-mcp` (soul.md, identity-anchors, observation promotion) or file-based
- Scope: Per-agent, persistent across projects
- Sync: `user` scope for cross-project identity, or dedicated identity repo
- Example: Road Runner's evidence-obsessed methodology persists across teams

**Team Backend** (shared knowledge and coordination):
- What: Cross-agent patterns, team conventions, shared findings, project architecture
- Storage: Git-backed shared repo, or MCP knowledge graph, or database-backed memory
- Scope: Team-wide, version-controlled
- Sync: Git push/pull or continuous via MCP server
- Example: Team learns that "all PRs must pass Prettier" — shared across all agents

### 5.2 Integration Architecture

```
┌─────────────────────────────────────────┐
│             Agent Session               │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ Memory   │  │ Agent    │  │ Team  │ │
│  │ Backend  │  │ Backend  │  │ Backend│ │
│  │ (native) │  │ (MCP/    │  │ (git/ │ │
│  │          │  │  files)  │  │  MCP) │ │
│  └────┬─────┘  └────┬─────┘  └───┬───┘ │
│       │              │             │     │
└───────┼──────────────┼─────────────┼─────┘
        │              │             │
   ~/.claude/     ~/.claude/    .claude/tmp/
   agent-memory/  agent-memory/ or shared repo
   <agent>/       <agent>/
   (isolated)     (identity)    (team-shared)
```

### 5.3 Decision Matrix

| Requirement | Memory Backend | Agent Backend | Team Backend |
| --- | --- | --- | --- |
| **What's stored** | Task learnings, patterns | Identity, personality | Shared knowledge |
| **Isolation** | Per-agent (strict) | Per-agent (strict) | Team-wide (shared) |
| **Persistence** | Across sessions | Across projects | Across sessions |
| **Sync needed** | Optional | Optional | Required |
| **Recommended backend** | Claude Code native | claude-memory-mcp or files | Git repo or MCP server |
| **Git-tracked** | Optional (`project` scope) | No (use `user` scope) | Yes (shared repo) |

---

## 6. Comparative Analysis

### 6.1 Full Decision Matrix

| Requirement | MEMORY.md | MCP Server | Git-Backed | Redis | Vector Store | File Sync |
| --- | --- | --- | --- | --- | --- | --- |
| Real-time sync | No | Yes | No | **Yes** | Medium | No |
| Semantic search | No | Some | No | Yes | **Yes** | No |
| Offline capable | **Yes** | No | **Yes** | No | No | **Yes** |
| Version control | No | No | **Yes** | No | No | Partial |
| Multi-agent safe | No | Varies | Via branches | **Yes** | **Yes** | No |
| Operational complexity | **None** | Low-Medium | Low | Medium | Medium | Low |
| Cost | **Free** | Free-$$ | **Free** | $30-200/mo | $30-500/mo | $5-50/mo |
| Latency | Instant (local) | 10-100ms | 0.5-5s | **<1ms** | 10-100ms | 1-10s |

### 6.2 Recommended Architecture for agent-team

**Phase 1 (Now)**: Claude Code native only
- Enable `memory: project` for all agents (not just ai-agent-eng)
- Use `.claude/tmp/` and `docs/research/` for team-shared knowledge
- Git-track project-scoped agent memory for team visibility

**Phase 2 (Soon)**: Add git-backed team memory
- Create shared memory repo or directory for team-wide knowledge
- Implement session-end commit hook for memory persistence
- Add memory validation in CI (structure checks, stale citation detection)

**Phase 3 (Later)**: Optional MCP integration
- Add `claude-memory-mcp` for agent identity persistence (if character preservation matters)
- Evaluate mcp-memory-service or Qdrant for semantic search over team knowledge
- Consider Redis for real-time cross-agent coordination if latency matters

### 6.3 Performance Hierarchy

**Latency (fastest to slowest)**:
1. Redis: <1ms
2. Vector search: 10-100ms
3. MCP memory server: 10-100ms
4. File sync: 1-10s
5. Git push/pull: 0.5-5s
6. GitHub Actions: 5-30s

### 6.4 Cost Analysis (10 agents, 1GB memory each)

| Backend | Monthly Cost | Notes |
| --- | --- | --- |
| MEMORY.md (native) | **$0** | Local filesystem only |
| Git (GitHub) | **$0** | Free for public repos |
| S3 (encrypted) | ~$0.25 | 10GB @ $0.023/GB |
| Redis Cloud | $30-100 | Depends on instance size |
| Vector store (Qdrant) | $30-100 | Self-hosted or cloud |
| MCP memory server | **$0** | Self-hosted, local process |

---

## 7. Open Questions

1. **Agent-scoped MCP config**: Currently all teammates share MCP servers. If/when [#4476](https://github.com/anthropics/claude-code/issues/4476) lands, agent-specific memory backends become possible.
2. **Memory consolidation**: No standard protocol for merging duplicate memories or resolving contradictions across agents.
3. **Embedding quality**: How well do general-purpose embeddings work for coding-specific agent memory? No clear benchmarks.
4. **Memory retention curves**: How much of what agents learn is useful long-term? No research on optimal memory window sizes.
5. **Cross-session transfer**: When agent-team moves to a new project, how should team memory carry over? Repo submodules? MCP server?
6. **Privacy/PII**: No standard MCP memory encryption or access control. Agents must self-police what they write to memory.

---

## 8. Recommendations

### Priority 1: Enable Native Memory for All Agents

Configure `memory: project` for team-shared agents and `memory: user` for generic agents. This is zero-infrastructure and provides immediate persistence benefits.

| Agent | Recommended Scope | Rationale |
| --- | --- | --- |
| ai-agent-eng | `project` (already set) | Failure patterns are project-specific |
| deep-researcher | `user` | Research methodology applies across projects |
| software-eng | `project` | Code patterns are project-specific |
| docs-writer | `project` | Doc conventions are project-specific |
| quality-assurance | `project` | Quality standards are project-specific |
| ops-eng | `user` | Infra patterns apply across projects |
| project-manager | `project` | Task coordination is project-specific |

### Priority 2: Git-Track Team Memory

Add git tracking for `.claude/agent-memory/` directories. This enables:
- Team visibility into what agents learn
- Version history for memory changes
- Code review for important knowledge updates
- Rollback if bad memories are recorded

### Priority 3: Evaluate Identity Persistence

If character preservation matters (Looney Tunes personas maintaining personality across sessions), evaluate `claude-memory-mcp` for the agent backend layer. This provides:
- `soul.md`: Core identity truths
- `identity-anchors.md`: Patterns grown from observations
- Observation promotion algorithm (frequency × diversity × recency)

### Priority 4: Team Knowledge Sharing

Design a mechanism for agents to promote individual learnings to team-shared knowledge. Options:
- Dedicated `shared/` directory in agent memory with PR-based promotion
- MCP knowledge graph server for structured team knowledge
- Manual promotion via team lead review

### Human Decisions Required

| Decision | Why | Who |
| --- | --- | --- |
| Memory scope per agent | Affects sharing and persistence behavior | Spec author + team lead |
| Git-track agent memory? | Puts agent learnings in version control | Repo owner |
| Team memory repo structure | Centralized vs federated vs hybrid | Architect |
| Identity persistence needed? | Whether character traits should persist | Product owner |
| Cloud backup required? | Disaster recovery and multi-machine sync | Ops owner |

---

## Sources

### Official Documentation
- [Claude Code Memory Docs](https://code.claude.com/docs/en/memory)
- [Claude Code Sub-agents Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-11-25)

### Git-Backed Memory
- [Building an agentic memory system for GitHub Copilot](https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/)
- [Introducing Context Repositories: Git-based Memory for Coding Agents (Letta)](https://www.letta.com/blog/context-repositories)
- [Git Context Controller: Manage the Context of LLM-based Agents like Git](https://arxiv.org/html/2508.00031v1)

### MCP Memory Implementations
- [Official MCP Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [claude-memory-mcp (Agent Identity)](https://github.com/WhenMoon-afk/claude-memory-mcp)
- [mcp-memory-service (Enterprise)](https://github.com/doobidoo/mcp-memory-service)
- [Mem0 MCP](https://docs.mem0.ai/platform/mem0-mcp)
- [mcp-qdrant-memory (Hybrid)](https://github.com/delorenj/mcp-qdrant-memory)
- [Serena MCP](https://github.com/oraios/serena)

### Redis and Key-Value
- [Redis Agent Memory Server](https://redis.github.io/agent-memory-server/)
- [LangGraph & Redis: Build smarter AI agents with memory & persistence](https://redis.io/blog/langgraph-redis-build-smarter-ai-agents-with-memory-persistence/)

### Vector Stores
- [Best Vector Databases in 2026](https://www.firecrawl.dev/blog/best-vector-databases)
- [Qdrant MCP Server](https://github.com/qdrant/mcp-server-qdrant)

### Architecture and Coordination
- [Architectures for Multi-Agent Systems](https://galileo.ai/blog/architectures-for-multi-agent-systems)
- [Centralized vs Distributed Agent Collaboration](https://www.auxiliobits.com/blog/agent-collaboration-models-centralized-vs-distributed-architectures/)
- [Using Git Worktrees for Multi-Feature Development with AI Agents](https://www.nrmitchi.com/2025/10/using-git-worktrees-for-multi-feature-development-with-ai-agents/)

### Community and Deep Dives
- [Claude Code's Memory Evolution (Yuanchang)](https://yuanchang.org/en/posts/claude-code-auto-memory-and-hooks/)
- [The Architecture of Persistent Memory for Claude Code (DEV Community)](https://dev.to/suede/the-architecture-of-persistent-memory-for-claude-code-17d)
- [How Claude's Memory and MCP Work (Mintlify)](https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work)
- [MCP Server Performance Benchmark](https://www.tmdevlab.com/mcp-server-performance-benchmark.html)

### GitHub Issues
- [Option to disable auto-memory #23750](https://github.com/anthropics/claude-code/issues/23750)
- [Enable Persistent Memory and Learning for Specialized Agents #4588](https://github.com/anthropics/claude-code/issues/4588)
- [Agent-Scoped MCP Configuration #4476](https://github.com/anthropics/claude-code/issues/4476)

### Sub-agent Research Files
- `.claude/tmp/memory-md-research.md` — MEMORY.md system analysis (505 lines)
- `.claude/tmp/mcp-memory-research.md` — MCP memory servers analysis (604 lines)
- `.claude/tmp/memory-sync-backends-research.md` — Sync backends analysis (1690 lines)
