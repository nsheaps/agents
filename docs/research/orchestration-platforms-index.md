# Agent Orchestration Platforms Survey — Index

**Date**: February 2026
**Task**: #44 (Deep Research: Agent Orchestration Platforms Survey)
**Researcher**: Road Runner (Researcher)

---

## Purpose

Comprehensive survey of the agent orchestration landscape in February 2026, covering commercial platforms, open-source frameworks, community tools, and integration patterns. Each platform has an individual research report with architecture details, comparisons to Claude Code Agent Teams, and lessons for our provider-agnostic agent-team project.

---

## Platform Reports (Task #44)

### Commercial / Major Platforms

| Report | Platform | Key Finding |
|:-------|:---------|:------------|
| [openai-codex.md](openai-codex.md) | OpenAI Codex | MCP-first service design; dual-layer OS+policy security; 30-min autonomy windows |
| [gemini-code.md](gemini-code.md) | Google Gemini Code (CLI + Code Assist + Jules) | Thought Signatures for reasoning preservation; async VM execution; MCP-first migration |
| [openhands.md](openhands.md) | OpenHands (All Hands AI) | Event-sourced immutable state; type-safe Pydantic actions; pluggable workspaces; 67.9k stars |

### Orchestration Frameworks

| Report | Framework | Key Finding |
|:-------|:----------|:------------|
| [enterprise-frameworks.md](enterprise-frameworks.md) | LangGraph, CrewAI, AutoGen | Three complementary approaches: graph state machines, role-based teams, conversation-driven |
| [community-orchestration-tools.md](community-orchestration-tools.md) | 18+ Claude Code orchestrators | Claude Flow (14.1k★), Oh My Claude Code (6.4k★); stage-based pipelines validated |

### Infrastructure & Integration

| Report | Topic | Key Finding |
|:-------|:------|:------------|
| [tmux-orchestration-tools.md](tmux-orchestration-tools.md) | tmux-based agent orchestration (10+ tools) | Three patterns: named sessions, web dashboards, IDE control planes |
| [linear-integrations.md](linear-integrations.md) | Linear Agent API + MCP Server + Webhooks | Event-driven agent spawning; feedback loop closure; task coordination layer |

---

## Related Research (Prior Tasks)

| Report | Task | Topic |
|:-------|:-----|:------|
| [systemprompt-playbooks.md](systemprompt-playbooks.md) | #41 | SystemPrompt.io: deterministic self-repairing playbooks, A2A protocol, hub-and-spoke |
| [opencode-agent-teams-porting.md](opencode-agent-teams-porting.md) | #37 | OpenCode: porting Claude Code agent teams to Go-based alternative |
| [claude-flow.md](claude-flow.md) | #38 | Claude Flow: self-optimizing orchestration, RuVector, knowledge graphs |
| [language-comparison.md](language-comparison.md) | #45 | bunx vs Rust vs Go for agent/MCP tooling |
| [team-storage-internals.md](team-storage-internals.md) | #39 | Claude Code internal team/task file storage format |

---

## Cross-Cutting Themes

### 1. MCP as Universal Integration Layer

Every major platform is adopting MCP. Codex exposes itself as an MCP server. Gemini is deprecating its Tool Calling API in favor of MCP. LangGraph/CrewAI/AutoGen all have MCP adapters. Linear provides an official MCP server. This validates our PRD's MCP-as-abstraction-layer approach.

### 2. Three Orchestration Philosophies

| Philosophy | Platforms | Trade-off |
|:-----------|:----------|:----------|
| **Hierarchical/Supervisor** | Codex (PM agent), LangGraph (supervisor), Claude Code (team-lead) | Maximum control, single point of failure |
| **Peer-to-Peer/Autonomous** | CrewAI (delegation), Claude Code Teams (SendMessage) | Maximum autonomy, harder to coordinate |
| **Conversation-Driven** | AutoGen (group chat), Gemini CLI (ReAct) | Natural flow, less predictable |

### 3. State Management Spectrum

| Approach | Platforms | Best For |
|:---------|:----------|:---------|
| **Event-sourced immutable** | OpenHands | Deterministic replay, pause/resume |
| **Centralized mutable** | LangGraph (StateGraph) | Complex shared state, race prevention |
| **Distributed per-agent** | CrewAI, Claude Code Teams | Agent autonomy, simple implementation |
| **Message passing** | AutoGen | Conversational workflows |
| **Thread ID handoffs** | Codex | Stateful multi-agent handoffs |

### 4. Security Models

| Model | Platforms |
|:------|:---------|
| **OS-enforced sandbox + policy** | Codex (Seatbelt/Landlock + approval) |
| **Docker container isolation** | OpenHands |
| **Policy-only approval** | Claude Code |
| **Git worktree isolation** | Community tools (reshashi, ccswarm) |

### 5. Async / Background Execution

Only Jules (Google) offers true async background VM execution. All other platforms are synchronous/interactive. This is a gap in the ecosystem — our agent-team project should consider async support.

### 6. Token Optimization

Community tools have innovated here: model-aware routing (Opus for complex, Sonnet for routine), session caching (ccswarm: 93% reduction), and ecomode patterns. Enterprise frameworks lag on this dimension.

---

## Architectural Recommendations Summary

Based on the full survey, key patterns for our agent-team project:

1. **MCP-first**: Agent interfaces should be MCP servers, not tight coupling
2. **Event-sourced state**: Adopt immutable event logs for pause/resume and replay
3. **Type-safe contracts**: Pydantic-style validation for agent actions
4. **Pluggable workspaces**: Local, remote, and container execution from same agent code
5. **Explicit handoff protocol**: Thread IDs or named contexts for state preservation
6. **Dual-layer security**: OS sandbox + configurable policy (not policy-only)
7. **Observability from day one**: Traces, audit logs, execution timelines
8. **Support multiple orchestration patterns**: Supervisor, peer-to-peer, conversation-driven
9. **Human-in-the-loop gates**: Pause points, approval workflows, audit trails
10. **Token awareness**: Model routing, session caching, cost tracking per agent

---

## What NOT to Copy

- Vendor-locked model selection (Codex → GPT only, Gemini → Google only)
- Docker-only sandboxing (limits CLI integration)
- Over-specialization (60+ agents is unwieldy; 32-40 proven practical)
- Blocking sub-agent delegation (enable true parallelism)
- Implicit task management (formalize task state machines)
