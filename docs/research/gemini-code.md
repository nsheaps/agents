# Gemini Code: Agent Platform Research Report

**Source**: Google Developer Documentation, GitHub, Google Blog
**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #44 (Orchestration Platforms Survey)

---

## 1. What It Is

Google's coding agent ecosystem consists of **three distinct products**:

### Gemini CLI

- **Type**: Open-source terminal AI agent[^1]
- **Maker**: Google (google-gemini on GitHub)[^2]
- **Maturity**: Production-ready, active development
- **Model**: Gemini 2.5 Pro with 1M-token context window[^1]
- **Free tier**: 60 requests/minute, 1,000 requests/day[^1]
- **Repo**: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)[^2]

### Gemini Code Assist

- **Type**: IDE-native AI coding assistant (VS Code, IntelliJ)[^3]
- **Maturity**: GA; Agent Mode stable in IntelliJ, preview in VS Code[^4]
- **Key change**: Deprecated Tool Calling API; migrating to MCP by March 2026[^4]

### Jules

- **Type**: Autonomous, asynchronous coding agent[^5]
- **Maturity**: Out of public beta (2025)
- **Model**: Gemini 3 Pro[^5]
- **Execution**: Clones repo into secure Google Cloud VM, works independently[^5]
- **Pricing**: 15-300 tasks/day depending on tier
- **Site**: [jules.google](https://jules.google)[^5]

| Product     | Mode             | Context         | Best For                                |
| :---------- | :--------------- | :-------------- | :-------------------------------------- |
| Gemini CLI  | Sync/Interactive | Terminal + MCP  | Developer workflows, scripting          |
| Code Assist | Sync/Interactive | IDE             | In-IDE coding, multi-file refactoring   |
| Jules       | Async/Autonomous | Google Cloud VM | Background automation, batch operations |

## 2. Architecture and Design Patterns

### Gemini CLI: ReAct Loop

Classic Reason-and-Act loop with explicit Thought preservation:[^1]

```
Observation → Thought → Action → Observation → ...
```

Architecture layers:

1. **Authentication**: OAuth, API keys, Vertex AI[^1]
2. **Tool system**: Built-in (file I/O, shell, web, grep) + extensible via MCP servers[^1]
3. **Conversation engine**: Stateful with checkpointing and token caching
4. **Context system**: GEMINI.md file for persistent project guidance (equivalent to CLAUDE.md)[^1]

### Code Assist: Plan-Approval Workflow

1. User sends prompt → Gemini API with available tools[^3]
2. API determines: answer directly OR request tool use
3. For file-modifying actions: explicit permission required
4. For complex projects: high-level plan presented for approval
5. Checkpointing: save/rollback progress[^3]

### Jules: Async VM Execution

1. Clone repo into secure Google Cloud VM[^5]
2. Analyze full codebase context with Gemini 3 Pro
3. Develop implementation strategy
4. Generate code diff for review
5. Create pull request upon approval

Jules extension for Gemini CLI enables delegation: `/julius` command to spawn async background tasks.[^6]

## 3. Agent Communication Model

### Current: Experimental Sub-Agents

Sub-agents exist but are **experimental** (not production):[^8]

- Specialized agents with own system prompt, persona, and restricted tool set
- Operate within main session context
- Tool calls execute **sequentially by default** (no native parallel execution)

### Community Orchestration

**Maestro-Gemini** ([github.com/josstei/maestro-gemini](https://github.com/josstei/maestro-gemini)):[^9]

- 12 specialized subagents with TechLead orchestrator
- 4-phase workflow: Design → Plan → Execute → Complete
- Parallel dispatch via shell scripts (workaround for sequential limitation)

**Prompt-Based Orchestration**: Multi-agent via composition with task queues, shared context areas, logging.[^8]

**Strategist-Specialist Model**: Dynamic routing — strategist spins off specialists on demand.

### Enterprise: ADK Multi-Agent

Google's **Agent Development Kit** (ADK) provides:[^7]

- Workflow agents: Sequential, Parallel, Loop patterns
- LLM-driven dynamic routing
- Modular composition of specialized agents
- Python and TypeScript

## 4. Task Management

| Product     | Approach                                                                               |
| :---------- | :------------------------------------------------------------------------------------- |
| Gemini CLI  | Implicit — ReAct loop state in conversation history; `/memory` for long-term context   |
| Code Assist | Plan-based — agent generates plan, user approves, agent executes with checkpointing    |
| Jules       | Explicit — `/jules-tools` CLI for task lifecycle, async queue with status tracking[^6] |

## 5. Unique Features

### Thought Signatures (Gemini 3+)

Encrypted reasoning state preservation across tool calls.[^11] Solves "reasoning drift" — agents losing context about WHY they asked for information when results return. Signatures pass through conversation history to maintain exact train of thought.

No equivalent in Claude Code.

### Async Execution (Jules)

Background VM-based agent that works independently.[^5] Developer delegates task and continues working. No direct Claude Code equivalent — Claude Code sessions are synchronous.

### Checkpointing and Rollback

Code Assist can save progress and roll back.[^3] Better error recovery than Claude Code's git-based approach.

### MCP-First Architecture

Gemini is migrating entirely to MCP (replacing Tool Calling API by March 2026).[^4] Standardized provider-agnostic tool integration.

### Google Integration

Native Google Search, Vertex AI, Cloud Logging, Cloud Storage.[^1] Not available in Claude Code.

## 6. Comparison to Claude Code Agent Teams

| Dimension                  | Claude Code                          | Gemini                             |
| :------------------------- | :----------------------------------- | :--------------------------------- |
| **Native subagents**       | Yes (parallel execution)             | Experimental only                  |
| **Execution model**        | Autonomous, parallel                 | Sequential, user-guided            |
| **Communication**          | SendMessage + file-based inbox       | No native inter-agent messaging    |
| **Spawn model**            | Fire-and-forget (tmux/in-process)    | No native spawn model              |
| **Task management**        | Built-in task list with dependencies | Implicit (CLI) or plan-based (IDE) |
| **Recovery**               | Git-based                            | Checkpointing + rollback           |
| **Supervision**            | Low (junior dev autonomy)            | High (ongoing approval)            |
| **Async execution**        | Not available                        | Jules (background VMs)             |
| **Reasoning preservation** | Context window only                  | Thought Signatures (encrypted)     |
| **MCP integration**        | Yes                                  | Yes (migrating fully)              |
| **Multi-model**            | Single provider                      | Single provider (Google only)      |

**Key gap in Gemini**: No native multi-agent communication or team coordination. Community tools (Maestro) fill this gap but aren't official.[^8][^9]

**Key gap in Claude Code**: No async/background execution model equivalent to Jules.[^5] No explicit reasoning preservation mechanism like Thought Signatures.[^11]

## 7. Lessons for Our Approach

### MCP as the Standardization Layer

Both Gemini CLI and Claude Code integrate MCP. Gemini is going all-in (deprecating alternatives).[^4] Provider-agnostic orchestration built on MCP ensures longevity.

### Reasoning State Preservation

Thought Signatures address a real problem — multi-step agent chains lose reasoning context after tool calls.[^11] Our orchestration should consider explicit reasoning state passing between agents.

### Sync + Async Hybrid

The Gemini CLI + Jules pattern (interactive agent delegates to background agent) is valuable.[^5][^6] Our agent-team architecture should support both execution modes.

### Composable Agent Primitives

ADK's workflow agents (Sequential, Parallel, Loop) and role-based composition are more structured than Claude Code's fire-and-forget model.[^7] Worth considering for the agent-team project.

### Checkpointing for Multi-Agent Workflows

Each agent should produce reviewable artifacts at phase boundaries. Human approval gates between phases reduce risk in multi-agent workflows.[^3]

## References

[^1]: https://developers.google.com/gemini-code-assist/docs/gemini-cli

[^2]: https://github.com/google-gemini/gemini-cli

[^3]: https://developers.google.com/gemini-code-assist/docs/agent-mode

[^4]: https://developers.google.com/gemini-code-assist/resources/release-notes

[^5]: https://jules.google

[^6]: https://developers.googleblog.com/en/meet-jules-tools-a-command-line-companion-for-googles-async-coding-agent/

[^7]: https://google.github.io/adk-docs/

[^8]: https://github.com/google-gemini/gemini-cli/discussions/7637

[^9]: https://github.com/josstei/maestro-gemini

[^10]: https://medium.com/google-cloud/building-a-multi-agent-assistant-with-gemini-and-the-agent-development-kit-cc448d0cfa1b

[^11]: https://ai.google.dev/gemini-api/docs/thought-signatures

[^12]: https://www.educative.io/blog/claude-code-vs-gemini-code-assist

[^13]: https://shipyard.build/blog/claude-code-vs-gemini-cli-who-is-winning-in-january-2026/

[^14]: https://github.com/gemini-cli-extensions/jules
