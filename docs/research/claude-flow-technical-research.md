> **Note (2026-02-23):** `delegate` permission mode was removed in Claude Code v2.1.50. The replacement is `bypassPermissions`. This document reflects findings at the time of writing.

# Claude-Flow Technical Implementation Research

**Research Date**: February 16, 2026  
**Project**: Claude-Flow (ruvnet)  
**Repository**: https://github.com/ruvnet/claude-flow  
**npm Package**: https://www.npmjs.com/package/claude-flow

---

## Executive Summary

Claude-Flow is the leading open-source agent orchestration platform for Claude, built as a complete rebuild (v3) with 250,000+ lines of TypeScript and WASM code. It enables deployment of intelligent multi-agent swarms with enterprise-grade architecture, distributed consensus coordination, and persistent memory systems. The platform integrates with Claude Code through native MCP (Model Context Protocol) support and recently added support for Claude Code's experimental Agent Teams feature.

**Key Stats**:

- 14.1k GitHub stars
- ~500,000 downloads, ~100,000 monthly active users across 80+ countries
- 60+ specialized pre-built agents
- 175+ MCP tools available
- 84.8% SWE-Bench solve rate with 10-20x faster swarm spawning vs predecessors

---

## Project Structure

### Monorepo Architecture (v3)

Claude-Flow uses a monorepo structure with the main packages organized under `v3/`:

```
ruvnet/claude-flow/
├── v3/@claude-flow/
│   ├── cli/              # CLI entry point with 26 commands
│   ├── memory/           # Vector database & knowledge graphs
│   ├── swarm/            # Multi-agent coordination
│   ├── mcp/              # MCP server implementation
│   ├── browser/          # Web UI components
│   ├── guidance/         # Workflow guidance & templates
│   └── ...other-packages/
├── CLAUDE.md             # Configuration templates
├── README.md
└── [additional-config-files]
```

**Sources**: [GitHub Structure](https://github.com/ruvnet/claude-flow), [Monorepo Packages](https://github.com/ruvnet/claude-flow/v3/@claude-flow)

### Key Source Files

- **@claude-flow/cli**: Main CLI entry point with 26 available commands
  - Location: `v3/@claude-flow/cli/`
  - Partially migrated to TypeScript (ongoing conversion from JavaScript)
  - Key CLI commands: `workflow`, `config`, `swarm`, `health check`, `diagnostic report`
  - Example files: `src/cli/simple-commands/swarm.js`, `src/cli/simple-commands/config.js`

- **@claude-flow/mcp**: MCP (Model Context Protocol) server
  - Full MCP 2025-11-25 specification compliance
  - Exposes 175+ tools to Claude Code
  - Provides orchestration, memory, and swarm management APIs

- **@claude-flow/memory**: Vector database and knowledge systems
  - HNSW (Hierarchical Navigable Small World) vector search
  - Knowledge graphs with PageRank and community detection
  - Semantic search with ReasoningBank pattern storage
  - SQLite persistence with write-ahead logging

- **@claude-flow/swarm**: Multi-agent coordination
  - Consensus algorithms: Raft, Byzantine Fault Tolerance, Gossip protocols
  - Topology options: mesh, hierarchical, ring, star
  - Q-Learning router with 8 expert modules for intelligent agent selection

- **CLAUDE.md**: Configuration and context templates
  - CLAUDE.md TypeScript template for TypeScript projects
  - CLAUDE.md Medium Team template for team orchestration
  - CLAUDE-optimized template for performance-tuned workflows

**Sources**: [CLI Architecture](https://github.com/ruvnet/claude-flow/wiki/CLAUDE-MD-TypeScript), [MCP Integration](https://code.claude.com/docs/en/mcp), [Package Structure](https://github.com/ruvnet/claude-flow)

---

## Installation and Setup Process

### Basic Installation

```bash
# Quick install with shell script
curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/claude-flow@main/scripts/install.sh | bash

# Or full setup with MCP server and diagnostics
curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/claude-flow@main/scripts/install.sh | bash --full
```

### npm Package Installation

```bash
# Global installation
npm install -g claude-flow@alpha

# Or specific packages
npm install @claude-flow/cli @claude-flow/memory @claude-flow/swarm

# Or monolithic package
npm install ruflo@v3alpha
```

### Prerequisites

- Node.js 20+ required
- npm 9+ (or pnpm/bun as alternatives)
- Claude Code installed globally: `npm install -g @anthropic-ai/claude-code`
- Optional: Skip permission checks for faster setup: `claude --dangerously-skip-permissions`

### MCP Server Setup

Add the ruflo MCP server to Claude Code:

```bash
claude mcp add ruflo -- npx -y ruflo@latest mcp start
```

This enables direct access to all 175+ ruflo MCP tools within Claude Code sessions.

### Project Initialization

```bash
npx claude-flow@v3alpha init
```

**Sources**: [Installation Guide](https://github.com/ruvnet/claude-flow/wiki/Installation-Guide), [npm Package Page](https://www.npmjs.com/package/claude-flow), [Quick Start](https://github.com/ruvnet/claude-flow/wiki/Quick-Start)

---

## CLI Interface and Commands

### Available Commands

Claude-Flow CLI provides 26 commands across several categories:

**Workflow Management**:

- `claude-flow workflow create` - Create new workflows
- `claude-flow workflow execute` - Execute defined workflows
- `claude-flow workflow status` - Check workflow status

**Agent & Swarm Management**:

- `claude-flow swarm` - Configure and manage agent swarms
- Agent deployment and coordination commands
- Topology selection (mesh, hierarchical, ring, star)

**Configuration**:

- `claude-flow config` - Manage configuration
- `claude-flow init` - Initialize projects

**Diagnostics**:

- `claude-flow health check` - Verify system health
- `claude-flow diagnostic report` - Generate diagnostic reports
- Error troubleshooting utilities

**Automation**:

- Various automation hooks and triggers
- GitHub integration commands
- CI/CD pipeline hooks

### Command Execution Pattern

```bash
# Example: Create and execute a workflow
claude-flow workflow create --name "code-review" --agents reviewer,tester,security-auditor
claude-flow workflow execute --workflow "code-review" --input-file workflow-config.json
```

**Sources**: [Automation Commands](https://github.com/ruvnet/claude-flow/wiki/Automation-Commands), [CLI Architecture](https://github.com/ruvnet/claude-flow/wiki/CLAUDE-MD-TypeScript)

---

## How Claude-Flow Launches and Manages Instances

### Multi-Instance Launch Strategy

Claude-Flow enables three patterns for launching Claude instances:

#### 1. Interactive + Headless Worker Pattern

```bash
# Main interactive session
claude [project-context]

# Parallel headless Codex workers for background tasks
claude -p "Analyze src/auth/ for security issues" --session-id "task-1" &
claude -p "Write unit tests for src/api/" --session-id "task-2" &
claude -p "Optimize database queries in src/db/" --session-id "task-3" &
wait
```

#### 2. Agent Teams Integration (v3.1.0-alpha.13+)

Claude-Flow v3.1.0-alpha.13 integrates with Claude Code's experimental Agent Teams feature:

- Single team lead spawns and orchestrates multiple Claude instances
- Parallel execution with independent context windows
- Direct agent-to-agent communication
- Shared memory and consensus coordination

#### 3. Subagent Task Delegation

When an agent runs as the main thread with `claude --agent`, it can spawn subagents:

- Each subagent runs in its own context window
- Custom system prompts per subagent
- Specific tool access restrictions
- Independent permission boundaries

### Process Management

**MCP Server Coordination**:

- Central MCP server manages process lifecycle
- Handles inter-agent communication
- Routes tool calls and memory queries
- Manages consensus algorithms for coordination

**Session Management**:

- Session IDs track parallel execution
- Persistent memory across sessions (survives context compaction)
- Automatic process cleanup and error recovery

### Execution Model

**Orchrestrator Pattern**: Claude-Flow acts as orchestrator (tracking state, storing memory) while agents act as executors, creating a clear separation of concerns.

**Subprocess Management Features**:

- Spawn up to 50 agents per swarm (maximum)
- Prevent circular dependencies in task graphs
- Automatic resource allocation and load balancing
- Stream-json chaining for real-time agent output piping

**Sources**: [Agent Teams Integration](https://github.com/ruvnet/claude-flow/issues/1098), [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents), [Subprocess Orchestration](https://github.com/bobmatnyc/claude-pm)

---

## Configuration Format

### Supported Configuration Formats

Claude-Flow supports multiple configuration formats:

#### JSON Format

- Primary format for CLI workflow definitions
- Stream-json chaining for agent-to-agent piping
- Structured with stages, agents, and execution strategy

#### YAML Format

- Alternative workflow definition format
- Human-readable configuration
- Support for parallel/sequential execution strategies

#### Example Workflow Structure

```json
{
  "name": "code-review-workflow",
  "description": "Comprehensive code review with multiple agents",
  "stages": [
    {
      "name": "security-analysis",
      "agents": ["security-auditor", "security-architect"],
      "strategy": "parallel"
    },
    {
      "name": "testing",
      "agents": ["tester", "performance-engineer"],
      "strategy": "parallel"
    },
    {
      "name": "review",
      "agents": ["reviewer", "coder"],
      "strategy": "sequential"
    }
  ]
}
```

### Configuration File Locations

**Project-Level**:

- `.claude-flow/config.json` or `.claude-flow/config.yaml`
- `claude-flow.config.js` (JavaScript config)

**CLAUDE.md Templates**:

- CLAUDE.md - Project configuration context
- CLAUDE-optimized - Performance-tuned configuration

### Configuration Scope

**Global Configuration**:

- Stored in `~/.claude-flow/` directory
- User-wide settings and defaults
- Authentication credentials

**Project Configuration**:

- Stored in project root `.claude-flow/` directory
- Project-specific agent definitions
- Workflow templates
- Memory database location

**Sources**: [Workflow Orchestration](https://github.com/ruvnet/claude-flow/wiki/Workflow-Orchestration), [API Reference](https://github.com/ruvnet/claude-flow/wiki/API-Reference), [JSON-driven Workflows](https://github.com/catlog22/Claude-Code-Workflow)

---

## Integration Points with Claude Code

### MCP Protocol Integration

**Native MCP Support**:

- Claude-Flow exposes 175+ MCP tools
- Installed via: `claude mcp add ruflo -- npx -y ruflo@latest mcp start`
- Full MCP 2025-11-25 specification compliance
- AIDefence security protocols for threat detection

**Available MCP Tools**:

- Workflow creation and execution
- Agent orchestration
- Memory queries and semantic search
- Consensus operations
- Task status tracking
- Performance monitoring

### Agent Teams Integration

**Native Support for Experimental Agent Teams**:

- Requires: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable
- Claude Flow v3.1.0-alpha.13+ introduces full integration
- Team lead spawns and manages multiple Claude instances
- Parallel execution with shared memory coordination

**Example Agent Teams Launch** (via Claude-Flow):

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude \
  --continue --dangerously-skip-permissions \
  --teammate-mode tmux \
  --permission-mode delegate \
  --settings '{"hooks":{"SessionStart":[...],"Stop":[...]}}'
```

### Subprocess Management

**Headless Execution**:

- Spawn background Claude workers via subprocess
- Session-based tracking and coordination
- Memory shared through central vector database
- Automatic cleanup on task completion

### Memory System Integration

**Persistent Memory Features**:

- HNSW-indexed vector database accessible across sessions
- Shared knowledge layer survives context compaction
- Per-agent scoped memory with cross-agent knowledge transfer
- ReasoningBank pattern storage for semantic search

**Sources**: [Connect Claude Code to MCP](https://code.claude.com/docs/en/mcp), [Orchestrate Agent Teams](https://code.claude.com/docs/en/agent-teams), [Agent Teams vs Claude-Flow Comparison](https://medium.com/@derekcashmore/claude-code-agent-teams-vs-claude-flow-a-real-world-bake-off-97e24f6ca9b9)

---

## Claude Code Agent Teams vs Native Agent Teams

### Architectural Comparison

| Feature                | Claude-Flow                                        | Native Agent Teams                         |
| ---------------------- | -------------------------------------------------- | ------------------------------------------ |
| **Memory Persistence** | HNSW-indexed vector DB survives context compaction | Context window bound, no persistent memory |
| **Knowledge Sharing**  | Semantic search with ReasoningBank indexing        | Direct communication only                  |
| **Agent Count**        | 60+ pre-built specialized agents                   | Limited by manual configuration            |
| **Consensus**          | Raft, Byzantine FT, Gossip protocols               | Direct consensus via messaging             |
| **Research Depth**     | Academic-backed with extensive documentation       | Production-focused, cleaner UX             |
| **Configuration**      | JSON/YAML workflows with detailed orchestration    | Native settings.json integration           |
| **Cost Optimization**  | 30-50% token reduction via pattern caching         | Standard token usage                       |
| **Status**             | Alpha release (v3.1.0-alpha.13+)                   | Experimental, disabled by default          |

### Best Use Cases

**Claude-Flow Excels At**:

- Complex multi-stage workflows with persistent learning
- Research tasks requiring deep semantic memory
- Large-scale swarm coordination (50+ agents)
- Cost-optimized long-running projects
- Enterprise deployments with audit requirements

**Native Agent Teams Excels At**:

- Quick parallel research and debugging
- Cross-layer coordination (frontend/backend/tests)
- New module development with independent ownership
- Simpler workflows with 2-5 agents
- Interactive debugging with immediate feedback

### Community Consensus

Research depth: Claude-Flow provided academic rigor with more extensive output; Agent Teams produced solid results but noticeably thinner. Claude-Flow is positioned as "the tool for maximum depth, control, and extensibility," while Agent Teams feels like Anthropic's effort to make agentic workflows mainstream and accessible.

**Sources**: [Opus 4.6 Native Agent Teams](https://github.com/ruvnet/claude-flow/issues/1082), [Agent Teams vs Claude-Flow Bake-Off](https://medium.com/@derekcashmore/claude-code-agent-teams-vs-claude-flow-a-real-world-bake-off-97e24f6ca9b9), [Architectural Comparison Gist](https://gist.github.com/ruvnet/18dc8d060194017b989d1f8993919ee4), [Agent Teams Guide](https://claudefa.st/blog/guide/agents/agent-teams)

---

## Intelligence and Optimization Systems

### SONA Self-Optimization Layer

**RuVector Intelligence Features**:

- SONA self-optimization achieving <0.05ms adaptation time
- HNSW vector search: 150x-12,500x faster retrieval
- ReasoningBank pattern storage for semantic knowledge
- Flash Attention mechanisms for 2.49-7.47x speedup
- Nine reinforcement learning algorithms for continuous improvement

### Agent Booster (WASM Component)

**Performance Acceleration**:

- Handles simple code transforms without LLM calls
- 352x speedup for tasks like variable-to-const conversions
- Reduces token usage and API calls
- Runs at native speed with WebAssembly compilation

### Token Optimization

**Cost Reduction Strategies**:

- 30-50% API cost reduction through pattern retrieval
- 95% cache hit rate for common operations
- Optimal batching strategies
- Automatic failover between providers

### Memory System Performance

- Vector database: ~61µs search latency
- Knowledge graphs: PageRank and community detection
- Per-agent scoped memory with cross-agent knowledge transfer
- SQLite persistence with write-ahead logging for reliability

**Known Limitation**: ReasoningBank embedding computation can be slow (10-45 seconds per operation). Recommendation is to use ReasoningBank selectively for high-value knowledge and use basic mode for fast, frequent operations.

**Sources**: [GitHub - ruvnet/claude-flow](https://github.com/ruvnet/claude-flow), [Claude Flow Official](https://claude-flow.ruv.io/), [Troubleshooting Guide](https://github.com/ruvnet/claude-flow/wiki/Troubleshooting)

---

## Community Reception and Adoption

### Adoption Metrics (2026)

- **14.1k GitHub stars** - Strong repository visibility
- **~500,000 total downloads** - Significant install base
- **~100,000 monthly active users** - Sustained engagement
- **80+ countries** - Global adoption
- **84.8% SWE-Bench solve rate** - Strong performance benchmark
- **10-20x faster swarm spawning** - Significant performance improvement

### Developer Community

- Active GitHub Discussions for general support
- 391 pull requests tracked (indicates active contribution)
- Continuous releases and alpha versions
- Multiple wiki pages and documentation

### Market Position

Claude-Flow is positioned as "**ranked #1 in agent-based frameworks**" for Claude-based development, representing the leading solution in its category for open-source agent orchestration.

### Recent Community Developments

**V3 Complete Rebuild Initiative**:

- Issue #945: "🚀 Claude Flow V3: A Complete Rebuild for Multi-Agent Orchestration"
- Issue #927: "🚀 Claude-Flow V3 Complete Implementation: 15-Agent Concurrent Swarm"
- Demonstrates active community engagement around major releases

**Agent Teams Integration (Feb 2026)**:

- Issue #1082: "Opus 4.6 Just Shipped Native Agent Teams — Here's 28 Ways Claude-Flow Becomes Indispensable"
- Indicates community excitement about native integration capabilities

**Sources**: [GitHub Repository](https://github.com/ruvnet/claude-flow), [GitHub Discussions](https://github.com/ruvnet/claude-flow/discussions/categories/general), [GitHub Releases](https://github.com/ruvnet/claude-flow/releases), [Medium - Agent Teams Comparison](https://medium.com/@derekcashmore/claude-code-agent-teams-vs-claude-flow-a-real-world-bake-off-97e24f6ca9b9)

---

## Known Limitations and Issues

### Performance Limitations

1. **ReasoningBank Embedding Latency**: 10-45 seconds per operation
   - Recommendation: Use selectively for high-value knowledge
   - Use basic mode for fast, frequent operations

2. **Agent Swarm Limits**: Maximum 50 agents per swarm
   - Resource constraint for very large deployments
   - Circular dependency prevention requires careful orchestration

### Reported Issues and Bugs

**Critical Issues (Fixed in v2.0.0-alpha.83)**:

- Installation failures on macOS with Node.js v24.3.0
- MCP process proliferation causing VS Code port forwarding issues
- Memory system functionality broken
- API errors with tool_use IDs
- GitHub init creating helper files without .sh extension

**User-Reported Challenges**:

- TypeError when querying task status: "Cannot read properties of undefined (reading 'join')"
- Various command paths leading to errors or pending task queues
- Non-interactive execution challenges in certain configurations

### Diagnostic Tools Available

```bash
claude-flow health check      # Quick system health verification
claude-flow diagnostic report # Comprehensive troubleshooting report
```

**Sources**: [Troubleshooting Wiki](https://github.com/ruvnet/claude-flow/wiki/Troubleshooting), [v2.0.0-alpha.83 Fixes](https://github.com/ruvnet/claude-flow/issues/559), [GitHub Issues - Still Broken](https://github.com/ruvnet/claude-flow/issues/958)

---

## Security Features

### Built-in Security Protocols

**AIDefence Security Module** (CVE-hardened):

- Prompt injection protection
- Input validation
- Path traversal prevention
- Command injection blocking
- Safe credential handling
- TokenGenerator for secure authentication
- PasswordHasher for credential storage

### Agent-Level Security

**Specialized Security Agents**:

- Security-Auditor: Code security analysis
- Security-Architect: System architecture review
- Automatic vulnerability detection

### Access Control

- Per-agent scoped memory boundaries
- Cross-agent knowledge transfer with access controls
- Role-based task assignment
- Credential isolation

**Sources**: [GitHub - ruvnet/claude-flow](https://github.com/ruvnet/claude-flow), [npm - claude-flow](https://www.npmjs.com/package/claude-flow)

---

## Multi-Provider Support

### Supported Providers

Claude-Flow abstracts provider selection, supporting seamless switching between:

- **Claude** (primary, all features)
- **GPT** (OpenAI)
- **Gemini** (Google)
- **Cohere**
- **Ollama** (local models)

### Features

- Automatic failover between providers
- Provider-agnostic agent definitions
- Consistent API across providers
- Token optimization per provider

This is foundational to the planned "agent-team" project's vision of provider-agnostic orchestration using MCP as abstraction.

**Sources**: [GitHub - ruvnet/claude-flow](https://github.com/ruvnet/claude-flow), [GitHub - ruvnet/agentic-flow](https://github.com/ruvnet/agentic-flow)

---

## Comparison to Claude-Utils Agent-Team Vision

### Alignment Points

**Shared Goals**:

- Multi-instance orchestration and coordination
- Memory persistence across sessions
- MCP as abstraction for tool access
- Support for both independent and nested agent patterns
- Context preservation through specialization

**Differences in Approach**:

- Claude-Flow: Full-featured platform with 60+ agents, vector DB, consensus algorithms
- Claude-Utils Agent-Team: Minimal, focused on orchestration infrastructure
- Claude-Flow: Open-source but opinionated (specific agents, patterns)
- Claude-Utils: Building blocks for custom orchestration

### Key Insights for Agent-Team Architecture

1. **Memory Persistence is Critical**: Claude-Flow's HNSW vector DB survives context compaction - this is essential for long-running agent teams

2. **Session Management Complexity**: Tracking parallel execution requires careful subprocess lifecycle management and coordination

3. **MCP Integration Points**: Both systems use MCP for tool access - understanding Claude-Flow's MCP server design informs agent-team's architecture

4. **Configuration Flexibility**: JSON/YAML workflows with clear execution strategies (parallel/sequential) provide good patterns for declarative orchestration

5. **Subprocess vs Native Teams Trade-offs**:
   - Subprocess model: More flexible, better memory persistence, but heavier
   - Native Teams: Lighter weight, better UX, but limited persistence

**Sources**: Project Memory from `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/tmp/`

---

## References

### Official Documentation & Repositories

- [GitHub Repository](https://github.com/ruvnet/claude-flow)
- [npm Package](https://www.npmjs.com/package/claude-flow)
- [Official Website](https://claude-flow.ruv.io/)
- [Installation Guide Wiki](https://github.com/ruvnet/claude-flow/wiki/Installation-Guide)
- [Quick Start Guide](https://github.com/ruvnet/claude-flow/wiki/Quick-Start)
- [Workflow Orchestration Wiki](https://github.com/ruvnet/claude-flow/wiki/Workflow-Orchestration)
- [API Reference](https://github.com/ruvnet/claude-flow/wiki/API-Reference)
- [Troubleshooting Guide](https://github.com/ruvnet/claude-flow/wiki/Troubleshooting)

### Integration & Technical Deep Dives

- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [Sub-Agents Guide](https://code.claude.com/docs/en/sub-agents)
- [Architectural Comparison Gist](https://gist.github.com/ruvnet/18dc8d060194017b989d1f8993919ee4)

### Community & Reviews

- [Agent Teams vs Claude-Flow: Real-World Bake-Off](https://medium.com/@derekcashmore/claude-code-agent-teams-vs-claude-flow-a-real-world-bake-off-97e24f6ca9b9)
- [Claude Code Agent Teams Setup Guide](https://www.sitepoint.com/anthropic-claude-code-agent-teams/)
- [How to Set Up Claude Code Agent Teams](https://darasoba.medium.com/how-to-set-up-and-use-claude-code-agent-teams-and-actually-get-great-results-9a34f8648f6d)
- [Agent Teams: Managing Real Engineering Squad](https://theexcitedengineer.substack.com/p/claude-agent-teams-why-ai-coding)
- [From Tasks to Swarms: Agent Teams in Claude Code](https://alexop.dev/posts/from-tasks-to-swarms-in-claude-code/)

### Related Projects

- [GitHub - ruvnet/agentic-flow](https://github.com/ruvnet/agentic-flow)
- [GitHub - bobmatnyc/claude-pm](https://github.com/bobmatnyc/claude-pm)
- [GitHub - ChrisWiles/claude-code-showcase](https://github.com/ChrisWiles/claude-code-showcase)

### Relevant GitHub Issues

- [Issue #1082: Opus 4.6 Native Agent Teams — 28 Ways Claude-Flow Becomes Indispensable](https://github.com/ruvnet/claude-flow/issues/1082)
- [Issue #1098: Claude Agent Teams Integration](https://github.com/ruvnet/claude-flow/issues/1098)
- [Issue #945: Claude Flow V3 Complete Rebuild](https://github.com/ruvnet/claude-flow/issues/945)
- [Issue #927: Claude-Flow V3 Complete Implementation](https://github.com/ruvnet/claude-flow/issues/927)
- [Issue #559: V2.0.0-alpha.83 Critical Fixes](https://github.com/ruvnet/claude-flow/issues/559)
- [Issue #958: Performance Issues in V3](https://github.com/ruvnet/claude-flow/issues/958)

---

## Research Methodology

This research was conducted through:

1. GitHub repository analysis (structure, documentation, issues, releases)
2. npm package page examination
3. Web search for community discussions, blog posts, and reviews
4. Comparative analysis with Claude Code native agent teams
5. Documentation review from official wikis and guides

**Coverage**: Project structure, installation, CLI commands, launch mechanisms, configuration formats, MCP integration, memory systems, performance optimizations, security features, community reception, known limitations, and architectural comparisons.

**Last Updated**: February 16, 2026
