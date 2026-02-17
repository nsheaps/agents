# Gemini Code: Agent Platform Research Report

**Source**: Google Developer Documentation, GitHub, Google Blog
**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #44 (Orchestration Platforms Survey)

---

## 1. What It Is

Google's coding agent ecosystem consists of **three distinct products**:

### Gemini CLI
- **Type**: Open-source terminal AI agent
- **Maker**: Google (google-gemini on GitHub)
- **Maturity**: Production-ready, active development
- **Model**: Gemini 2.5 Pro with 1M-token context window
- **Free tier**: 60 requests/minute, 1,000 requests/day
- **Repo**: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)

### Gemini Code Assist
- **Type**: IDE-native AI coding assistant (VS Code, IntelliJ)
- **Maturity**: GA; Agent Mode stable in IntelliJ, preview in VS Code
- **Key change**: Deprecated Tool Calling API; migrating to MCP by March 2026

### Jules
- **Type**: Autonomous, asynchronous coding agent
- **Maturity**: Out of public beta (2025)
- **Model**: Gemini 3 Pro
- **Execution**: Clones repo into secure Google Cloud VM, works independently
- **Pricing**: 15-300 tasks/day depending on tier
- **Site**: [jules.google](https://jules.google)

| Product | Mode | Context | Best For |
|:--------|:-----|:--------|:---------|
| Gemini CLI | Sync/Interactive | Terminal + MCP | Developer workflows, scripting |
| Code Assist | Sync/Interactive | IDE | In-IDE coding, multi-file refactoring |
| Jules | Async/Autonomous | Google Cloud VM | Background automation, batch operations |

## 2. Architecture and Design Patterns

### Gemini CLI: ReAct Loop

Classic Reason-and-Act loop with explicit Thought preservation:

```
Observation → Thought → Action → Observation → ...
```

Architecture layers:
1. **Authentication**: OAuth, API keys, Vertex AI
2. **Tool system**: Built-in (file I/O, shell, web, grep) + extensible via MCP servers
3. **Conversation engine**: Stateful with checkpointing and token caching
4. **Context system**: GEMINI.md file for persistent project guidance (equivalent to CLAUDE.md)

### Code Assist: Plan-Approval Workflow

1. User sends prompt → Gemini API with available tools
2. API determines: answer directly OR request tool use
3. For file-modifying actions: explicit permission required
4. For complex projects: high-level plan presented for approval
5. Checkpointing: save/rollback progress

### Jules: Async VM Execution

1. Clone repo into secure Google Cloud VM
2. Analyze full codebase context with Gemini 3 Pro
3. Develop implementation strategy
4. Generate code diff for review
5. Create pull request upon approval

Jules extension for Gemini CLI enables delegation: `/julius` command to spawn async background tasks.

## 3. Agent Communication Model

### Current: Experimental Sub-Agents

Sub-agents exist but are **experimental** (not production):
- Specialized agents with own system prompt, persona, and restricted tool set
- Operate within main session context
- Tool calls execute **sequentially by default** (no native parallel execution)

### Community Orchestration

**Maestro-Gemini** ([github.com/josstei/maestro-gemini](https://github.com/josstei/maestro-gemini)):
- 12 specialized subagents with TechLead orchestrator
- 4-phase workflow: Design → Plan → Execute → Complete
- Parallel dispatch via shell scripts (workaround for sequential limitation)

**Prompt-Based Orchestration**: Multi-agent via composition with task queues, shared context areas, logging.

**Strategist-Specialist Model**: Dynamic routing — strategist spins off specialists on demand.

### Enterprise: ADK Multi-Agent

Google's **Agent Development Kit** (ADK) provides:
- Workflow agents: Sequential, Parallel, Loop patterns
- LLM-driven dynamic routing
- Modular composition of specialized agents
- Python and TypeScript

## 4. Task Management

| Product | Approach |
|:--------|:---------|
| Gemini CLI | Implicit — ReAct loop state in conversation history; `/memory` for long-term context |
| Code Assist | Plan-based — agent generates plan, user approves, agent executes with checkpointing |
| Jules | Explicit — `/jules-tools` CLI for task lifecycle, async queue with status tracking |

## 5. Unique Features

### Thought Signatures (Gemini 3+)

Encrypted reasoning state preservation across tool calls. Solves "reasoning drift" — agents losing context about WHY they asked for information when results return. Signatures pass through conversation history to maintain exact train of thought.

No equivalent in Claude Code.

### Async Execution (Jules)

Background VM-based agent that works independently. Developer delegates task and continues working. No direct Claude Code equivalent — Claude Code sessions are synchronous.

### Checkpointing and Rollback

Code Assist can save progress and roll back. Better error recovery than Claude Code's git-based approach.

### MCP-First Architecture

Gemini is migrating entirely to MCP (replacing Tool Calling API by March 2026). Standardized provider-agnostic tool integration.

### Google Integration

Native Google Search, Vertex AI, Cloud Logging, Cloud Storage. Not available in Claude Code.

## 6. Comparison to Claude Code Agent Teams

| Dimension | Claude Code | Gemini |
|:----------|:-----------|:-------|
| **Native subagents** | Yes (parallel execution) | Experimental only |
| **Execution model** | Autonomous, parallel | Sequential, user-guided |
| **Communication** | SendMessage + file-based inbox | No native inter-agent messaging |
| **Spawn model** | Fire-and-forget (tmux/in-process) | No native spawn model |
| **Task management** | Built-in task list with dependencies | Implicit (CLI) or plan-based (IDE) |
| **Recovery** | Git-based | Checkpointing + rollback |
| **Supervision** | Low (junior dev autonomy) | High (ongoing approval) |
| **Async execution** | Not available | Jules (background VMs) |
| **Reasoning preservation** | Context window only | Thought Signatures (encrypted) |
| **MCP integration** | Yes | Yes (migrating fully) |
| **Multi-model** | Single provider | Single provider (Google only) |

**Key gap in Gemini**: No native multi-agent communication or team coordination. Community tools (Maestro) fill this gap but aren't official.

**Key gap in Claude Code**: No async/background execution model equivalent to Jules. No explicit reasoning preservation mechanism like Thought Signatures.

## 7. Lessons for Our Approach

### MCP as the Standardization Layer

Both Gemini CLI and Claude Code integrate MCP. Gemini is going all-in (deprecating alternatives). Provider-agnostic orchestration built on MCP ensures longevity.

### Reasoning State Preservation

Thought Signatures address a real problem — multi-step agent chains lose reasoning context after tool calls. Our orchestration should consider explicit reasoning state passing between agents.

### Sync + Async Hybrid

The Gemini CLI + Jules pattern (interactive agent delegates to background agent) is valuable. Our agent-team architecture should support both execution modes.

### Composable Agent Primitives

ADK's workflow agents (Sequential, Parallel, Loop) and role-based composition are more structured than Claude Code's fire-and-forget model. Worth considering for the agent-team project.

### Checkpointing for Multi-Agent Workflows

Each agent should produce reviewable artifacts at phase boundaries. Human approval gates between phases reduce risk in multi-agent workflows.

## 8. Links and Sources

### Official Documentation
- [Gemini CLI Documentation](https://developers.google.com/gemini-code-assist/docs/gemini-cli)
- [Gemini CLI GitHub](https://github.com/google-gemini/gemini-cli)
- [Agent Mode Overview](https://developers.google.com/gemini-code-assist/docs/agent-mode)
- [Gemini Code Assist Release Notes](https://developers.google.com/gemini-code-assist/resources/release-notes)
- [Thought Signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)
- [Agent Development Kit](https://google.github.io/adk-docs/)

### Jules
- [Jules Official](https://jules.google)
- [Jules Tools CLI](https://developers.googleblog.com/en/meet-jules-tools-a-command-line-companion-for-googles-async-coding-agent/)
- [Jules GitHub Extension](https://github.com/gemini-cli-extensions/jules)

### Multi-Agent
- [Maestro-Gemini](https://github.com/josstei/maestro-gemini) — Community multi-agent platform
- [Gemini CLI Multi-Agent Discussion](https://github.com/google-gemini/gemini-cli/discussions/7637)
- [Building Multi-Agent Systems with ADK](https://medium.com/google-cloud/building-a-multi-agent-assistant-with-gemini-and-the-agent-development-kit-cc448d0cfa1b)

### Comparisons
- [Gemini vs Claude Code 2026](https://www.educative.io/blog/claude-code-vs-gemini-code-assist)
- [Claude Code vs Gemini CLI](https://shipyard.build/blog/claude-code-vs-gemini-cli-who-is-winning-in-january-2026/)
