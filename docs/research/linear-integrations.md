# Linear Integrations for Agent Teams: Research Report

**Source**: Linear Developer Documentation, GitHub, community implementations
**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #44 (Orchestration Platforms Survey)

---

## 1. What It Is

Linear has explicitly built for AI agents in 2026, providing a complete stack for agent-driven project management. The ecosystem includes three official integration layers and multiple community implementations.

- **Maker**: Linear (linear.app)
- **Maturity**: Production — official Agent API, MCP Server, and Webhooks all GA
- **Key change in 2026**: Linear moved from "project management tool" to "agent coordination platform"

## 2. Architecture: Three Integration Layers

### 2.1 Official Agent API

**Documentation**: [linear.app/docs/agents-in-linear](https://linear.app/docs/agents-in-linear)

Agents operate as "app users" in the workspace:
- Can be @-mentioned in comments
- Issue assignment triggers delegation (agent acts, human remains responsible)
- Create and reply to comments
- Collaborate on projects and documents
- Workspace-level or team-level guidance directives
- **Limitations**: Cannot sign in, no admin functionality, cannot manage users

Agent management:
- Install via Integrations Directory
- Configure team-level guidance (overrides workspace guidance)
- Suspend agents via Settings > Administration > Members
- Track agent actions in activity timeline

### 2.2 Official MCP Server

**Documentation**: [linear.app/docs/mcp](https://linear.app/docs/mcp)

32+ tools covering the full Linear API:

| Category | Capabilities |
|:---------|:-------------|
| Issues | Find, create, update |
| Projects | Full management |
| Comments | Add, edit |
| Attachments | Manage |
| Cycles | Management |
| Labels | Management |

**Authentication**:
- OAuth 2.1 with dynamic client registration
- Direct API key via Authorization headers
- Hosted at `https://mcp.linear.app/mcp` (HTTP) and `https://mcp.linear.app/sse` (SSE)

**Supported clients**: Claude, Cursor, Codex, Jules, VS Code, v0, Windsurf, Zed, and 100+ MCP-compatible clients.

### 2.3 Webhooks

**Documentation**: [linear.app/developers/webhooks](https://linear.app/developers/webhooks)

Event-driven automation supporting:
- Issues (created, updated, deleted)
- Comments (created, updated)
- Attachments, Documents, Projects, Cycles, Labels, Users
- Emoji reactions, Issue SLAs

Delivery: HTTP POST with automatic retry (1 min, 1 hour, 6 hours), signature verification.

## 3. Integration Patterns

### Pattern A: Issue-Driven Agent Spawning

```
Linear Issue Created (webhook)
  ↓
n8n/Zapier/Pipedream Workflow
  ↓
Spawn Claude Code Agent Team
  ↓
Lead agent reads issue via Linear MCP
  ↓
Teammates execute in parallel
  ↓
Linear MCP updates issue with PR/results
```

### Pattern B: Agent Self-Coordination via Linear

```
Lead Agent (in tmux pane)
  ├── Reads Linear issues to discover work
  ├── Spawns teammates for each issue
  ├── Updates Linear via MCP (status/comments)
  └── Teammates communicate via Linear comments
```

### Pattern C: Cursor + Linear (Reference Implementation)

**Documentation**: [linear.app/integrations/cursor](https://linear.app/integrations/cursor)

1. Assign Linear issue to Cursor
2. Cursor cloud agent executes the task
3. Agent creates PR automatically
4. Linear issue updated with status and PR link
5. Progress trackable in: Linear UI, Cursor web app, IDE

This solves "context fragmentation" — teams no longer context-switch between project management and code execution.

## 4. Community MCP Implementations

| Project | Repo | Focus |
|:--------|:-----|:------|
| mcp-linear (TacticLaunch) | [tacticlaunch/mcp-linear](https://github.com/tacticlaunch/mcp-linear) | Natural language issue interaction |
| linear-mcp-integration (Touchlab) | [touchlab/linear-mcp-integration](https://github.com/touchlab/linear-mcp-integration) | Alternative integration layer |

## 5. Why Linear Built for Agents

**Source**: [The New Stack](https://thenewstack.io/why-linear-built-an-api-for-agents/)

Linear's rationale:
1. **Context fragmentation is pain**: Developers context-switch between tools
2. **Agents need structured data**: Linear provides issue schema, status, assignees as agent input
3. **Feedback loops**: Agents need to close loops (read issue → execute → update issue)
4. **2026 prediction**: Gartner predicts 40% of enterprise apps will have task-specific agents by 2026
5. **Standardization**: MCP server avoids vendor lock-in

## 6. Comparison to Claude Code Agent Teams

| Dimension | Linear Integration | Claude Code Task System |
|:----------|:------------------|:-----------------------|
| **Task storage** | Database-backed, persistent | File-based (`~/.claude/tasks/`) |
| **Visibility** | Web UI, mobile, API | CLI only (Ctrl+T) |
| **Dependencies** | Custom fields, project hierarchy | `blockedBy` / `blocks` fields |
| **External events** | Webhooks trigger workflows | No external event system |
| **Agent identity** | App users in workspace | Named agents in team config |
| **Communication** | Comments, @-mentions | SendMessage tool |
| **History** | Full activity timeline | Conversation history |
| **Multi-project** | Native | One team per session |

### Complementary Strengths

Linear and Claude Code Agent Teams solve different layers:
- **Linear**: External task coordination, cross-team visibility, persistent history
- **Claude Code Tasks**: In-session coordination, dependency tracking, real-time status

A production workflow could use both:
```
Linear (source of truth, external visibility)
  ↓ Issue created → webhook fires
  ↓
claude-team orchestrator spawns agents
  ↓ Internal task list tracks execution
  ↓ Agents read issue context via MCP
  ↓ Agents create PR
  ↓ Agents update Linear via MCP
  ↓
Linear (updated with results)
```

## 7. Lessons for Our Approach

### MCP Server is the Standard Integration Point

Linear's official MCP server validates MCP as the agent integration standard. Any tool that wants agent integration is building an MCP server. Our architecture should prioritize MCP compatibility.

### Webhooks Enable Event-Driven Agent Spawning

Linear webhooks + automation platforms (n8n, Zapier) = trigger agent teams from external events. Our `claude-team` script could accept webhook payloads as input.

### Agent API Pattern for Workspace Presence

Linear's "agent as app user" pattern gives agents identity in the workspace. Worth considering for our agent-team project — agents should have visible presence in external systems.

### Feedback Loop Closure is Critical

The most valuable pattern: agents read context from Linear, execute work, update Linear with results. This closes the loop between task management and execution. Our architecture should formalize this pattern.

### What NOT to Copy

- Linear-specific auth patterns (we need provider-agnostic)
- Tight coupling to Linear's data model
- Cursor-specific integration patterns (we're CLI-focused)

## 8. Links and Sources

### Official Documentation
- [Linear Agent API](https://linear.app/docs/agents-in-linear)
- [Linear MCP Server](https://linear.app/docs/mcp)
- [Linear Webhooks](https://linear.app/developers/webhooks)
- [Linear + Cursor Integration](https://linear.app/integrations/cursor)
- [How Cursor Integrated with Linear for Agents](https://linear.app/now/how-cursor-integrated-with-linear-for-agents)

### Community
- [mcp-linear (TacticLaunch)](https://github.com/tacticlaunch/mcp-linear)
- [linear-mcp-integration (Touchlab)](https://github.com/touchlab/linear-mcp-integration)
- [Composio Linear MCP](https://mcp.composio.dev/linear)

### Articles
- [Why Linear Built an API For Agents](https://thenewstack.io/why-linear-built-an-api-for-agents/)
- [How to set up the Linear MCP server](https://www.builder.io/blog/linear-mcp-server)
