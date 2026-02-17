# Agent Team Architecture — Design Discussion

> **Status**: Draft — brainstorming and requirements gathering
> **Language**: TypeScript + Bun (all components). Exception: K8s controller (Go).
> **Date**: 2026-02-17

This document captures design topics raised during the looney-tunes team session. Each section is a discussion topic that needs further research, design, and specification before implementation.

## MVP Priority: Reliable Agent Lifecycle

> **First goal**: The ability to launch an agent, kill it, and relaunch it reliably on the same system — without stale entries, name collisions, or manual config surgery.

Before any of the features below, the foundational lifecycle must work:

1. **Launch**: Spawn an agent by name with specified permissions and framework
2. **Kill**: Cleanly terminate an agent, removing it from team config
3. **Relaunch**: Spawn the same agent name again without `-2` suffixes or stale entries
4. **Health check**: Detect when an agent's backend (tmux pane, container, process) has died
5. **Auto-cleanup**: Remove dead agents from config automatically

This is currently broken in Claude Code's agent teams system (see `.claude/behaviors/team-member-cleanup.md` for the manual workaround). The agent wrapper and management tooling must solve this before adding session restoration, Docker containers, or cross-machine capabilities.

---

## 1. Security Consultant Agent

### Concept

A specialized agent that acts as a runtime permission gate and agent configuration advisor. When an agent lacks permissions for an action, instead of blocking outright, the security consultant can:

- **Approve/deny one-time actions**: "Agent X wants to run `git push --force`. Approve?"
- **Modify agent configurations**: Add needed permissions to an agent's definition when the lack of permission is a recurring pattern
- **Defer to the user**: When uncertain, escalate to the human via the agent's interface
- **Work with the AI Agent Engineer**: Collaborate on agent modifications — security consultant handles permission changes, AI Agent Engineer handles behavioral changes

### Interface

- Uses the agent's own interface (not a separate UI) to present approve/deny decisions
- Potentially uses [A2A (Agent-to-Agent) protocol](https://google.github.io/A2A/) for structured inter-agent permission requests
- Could implement a "permission escalation chain": agent → security consultant → user

### Design Questions

1. How does the security consultant intercept permission requests? Hook into `PreToolUse`?
2. What's the approval scope? Per-action, per-session, permanent?
3. How are one-time approvals tracked and expired?
4. What's the trust model? Can the security consultant grant permissions the user hasn't pre-approved?
5. How does this interact with Claude Code's existing permission modes (default, bypass, delegate)?

### References

- Claude Code permission modes: https://code.claude.com/docs/en/permissions
- A2A protocol: https://google.github.io/A2A/
- Existing `PreToolUse` hooks for permission gating

---

## 2. Per-Agent Tool Set Configuration

### Concept

Agent management tool sets should be optionally enabled/disabled per agent. Not every agent needs the full set of team management capabilities.

### Tool Categories

| Category         | Tools                                     | Who Needs It                           |
| :--------------- | :---------------------------------------- | :------------------------------------- |
| Team management  | TeamCreate, TeamRemoveMember, TeamCleanup | Orchestrators, team leads              |
| Task management  | TaskCreate, TaskUpdate, TaskList          | PMs, team leads, coordinators          |
| Messaging        | SendMessage (all types)                   | All agents                             |
| Agent spawning   | Task (with team_name)                     | Orchestrators, nested orchestrators    |
| Shutdown control | SendMessage (shutdown_request)            | Team leads only                        |
| File system      | Read, Write, Edit, Glob, Grep             | Most agents (configurable)             |
| Execution        | Bash                                      | Engineers, ops (restricted for others) |

### Why This Matters

- Giving every agent the full tool set creates unnecessary complexity
- Risk of agents accidentally creating teams or spawning teammates
- Larger context from irrelevant tool descriptions
- Some agents (leaf workers) should be sandboxed to their specific tools

### Design

Tool sets defined in agent configuration:

```yaml
# In .agent.yaml or agent frontmatter
tools:
  - messaging # SendMessage
  - tasks # TaskCreate, TaskUpdate, TaskList
  # - team-management  # TeamCreate, etc. — disabled for this agent
  # - spawning         # Task with team_name — disabled
```

---

## 3. Docker Container Execution Backend

### Concept

Use the agent tool abstraction to launch agents (of any framework) in Docker containers, potentially with framework-specific container images per agent.

### Architecture

```
Agent Definition (.agent.yaml)
  ├── framework: claude-code | openai-codex | custom
  ├── container:
  │     image: ghcr.io/nsheaps/agent-images/claude-code:latest
  │     dockerfile: ./agents/engineer/Dockerfile  # or pre-built
  │     resources:
  │       memory: 2Gi
  │       cpu: 1
  │     volumes:
  │       - ./workspace:/workspace
  │       - ~/.claude:/home/agent/.claude:ro
  │     env:
  │       CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"
  └── workspace:
        path: /workspace
        git:
          repo: git@github.com:nsheaps/agent-team.git
          branch: main
```

### Execution Modes

1. **Local Docker**: `docker run` with mounted volumes, port forwarding for mesh MCP
2. **Docker Compose**: Multi-agent stack with shared network, Redis, mesh server
3. **Kubernetes**: Helm chart deployment with controller managing agent pods
4. **Bare process**: Direct binary execution (current tmux/in-process mode)

### Per-Agent Containers

Each agent can have its own container image tailored to its framework and tools:

- Engineer: full dev environment (Node, Bun, Git, build tools)
- Researcher: lightweight with web access tools
- Ops: Docker-in-Docker, kubectl, Helm
- QA: test runners, linters, coverage tools

### Design Questions

1. How does the mesh MCP server connect to containerized agents? Sidecar pattern?
2. How are agent credentials (API keys, tokens) passed securely to containers?
3. How does the orchestrator spawn/manage containers? Direct Docker API? K8s operator?
4. Can agents hot-reload their container without losing session state?

---

## 4. Agent Definition Code Structure

### Concept

Define agents in code — not just markdown files, but structured definitions that include settings, container configuration, workspace setup, and tool access.

### Proposed Structure

```
agents/
├── engineer/
│   ├── agent.yaml          # Agent definition (role, tools, permissions)
│   ├── Dockerfile           # Container image for this agent
│   ├── prompt.md            # System prompt (current .claude/agents/*.md content)
│   ├── persona.md           # Public-facing identity
│   ├── behaviors/           # Agent-specific behaviors (overrides)
│   └── workspace/
│       ├── .claude/         # Agent-specific Claude Code config
│       └── setup.sh         # Workspace initialization script
├── researcher/
│   ├── agent.yaml
│   ├── Dockerfile
│   ├── prompt.md
│   └── ...
└── shared/
    ├── base.Dockerfile      # Base image all agents extend
    ├── behaviors/           # Shared behaviors
    └── types/               # TypeScript types for agent definitions
```

### agent.yaml Schema

```yaml
name: software-engineer
character: Bugs Bunny
role: Software Engineer
framework: claude-code
model: claude-opus-4-6

tools:
  - messaging
  - tasks
  - filesystem
  - execution

permissions:
  mode: bypassPermissions # or default, delegate
  allowed:
    - "git *"
    - "bun *"
    - "npm *"
  denied:
    - "rm -rf /"

container:
  image: ghcr.io/nsheaps/agents/engineer:latest
  dockerfile: ./Dockerfile
  resources:
    memory: 2Gi
    cpu: 1

workspace:
  repos:
    - git@github.com:nsheaps/agent-team.git
    - git@github.com:nsheaps/mcp.git
  mounts:
    - ~/.claude:/home/agent/.claude:ro

mesh:
  connect: true
  groups: [engineering, all]

session:
  persist: true
  backend: local # or s3
```

---

## 5. Session Save/Restore

### Concept

When an agent finishes, it saves its state. On next interaction, the agent resumes with context from previous sessions — even if not resuming that specific session. This enables:

- Mobility across machines
- Continuity across team sessions
- Per-agent persistent memory

### What Gets Saved

| Data                    | Location                                   | Format                              |
| :---------------------- | :----------------------------------------- | :---------------------------------- |
| Conversation transcript | `sessions/{agent-id}/{session-id}.jsonl`   | JSONL                               |
| Agent memory/notes      | `sessions/{agent-id}/memory.md`            | Markdown                            |
| Task state              | `sessions/{agent-id}/tasks.json`           | JSON                                |
| Team context            | `sessions/{agent-id}/team-context.json`    | JSON                                |
| Working directory state | `sessions/{agent-id}/workspace-state.json` | JSON (modified files, branch, etc.) |

### Backends

1. **Local filesystem**: `~/.agent-team/sessions/` — default, fast, single-machine
2. **S3-compatible**: `s3://bucket/team-name/sessions/` — cross-machine, team-shared

### Restore Flow

```
1. Agent spawned with agent-id
2. Check session store for previous sessions with this agent-id
3. Load most recent memory.md into system prompt context
4. Optionally load task state and team context
5. Agent has awareness of previous work without resuming exact session
```

### Per-Agent Persistent Memory

Each agent maintains its own memory file (like Claude Code's auto-memory but per-agent):

- What they learned about the codebase
- Patterns they've observed
- Preferences and working style notes
- Key decisions and their rationale

This memory persists across sessions and is loaded on every spawn.

### Design Questions

1. How much context can realistically be loaded from previous sessions without blowing context limits?
2. Should memory be summarized/compressed between sessions?
3. How to handle memory conflicts when multiple sessions run the same agent concurrently?
4. Should the user be able to edit agent memory between sessions?
5. Encryption for S3 backend — at-rest and in-transit?

---

## 6. A2A Protocol Integration

### Concept

Use Google's [Agent-to-Agent (A2A) protocol](https://google.github.io/A2A/) as a standardized way for agents to communicate, especially for:

- Permission escalation (agent → security consultant → user)
- Cross-framework agent communication (Claude Code agent ↔ OpenAI Codex agent)
- Structured task delegation between agents

### Relationship to Mesh MCP

The mesh MCP server handles real-time communication within a team. A2A could provide:

- A higher-level protocol for structured interactions (not just messages)
- Cross-team and cross-framework compatibility
- Standardized agent discovery and capability advertisement

### Research Needed

- A2A protocol maturity and adoption
- How A2A maps to the existing SendMessage/Task primitives
- Whether A2A replaces or complements the mesh MCP server
- Performance characteristics for real-time team communication

---

## 7. Agent CLI as I/O Proxy

### Concept

The `agent` CLI is not just a launcher — it's a runtime I/O proxy that sits between the user and the underlying agent framework (Claude Code, Codex, etc.). It wraps the framework binary, intercepts all inputs and outputs, and can modify them in transit.

### Architecture

```
User ←→ agent CLI (proxy) ←→ claude / codex / custom framework
              │
              ├── Input interception: shell emulation, prompt injection
              ├── Output monitoring: all responses pass through
              └── Tool manipulation: strip/replace tool definitions at runtime
```

### Key Capabilities

1. **Wraps any agent framework**: The proxy calls the underlying binary (`claude`, `codex`, etc.) and mediates all communication
2. **Input/shell emulation**: Provides a consistent input interface regardless of the underlying framework
3. **Full I/O monitoring**: Every input and output passes through the proxy — enables logging, auditing, cost tracking
4. **Runtime tool stripping**: Can remove tool definitions from the prompt before they reach the framework — this is a proxy capability, not just a config toggle
5. **Tool replacement**: Can substitute tool definitions at runtime (e.g., replace a real GitHub tool with a dry-run mock)

### Why This Matters

Tool stripping and replacement as a proxy feature means:

- Agents can be sandboxed at the I/O level, not just via framework permissions
- Tool sets can be modified without restarting the agent
- The same agent definition can run with different tool sets based on runtime context
- Cross-framework compatibility: proxy handles tool translation between Claude Code and Codex

### Design Questions

1. How does the proxy handle streaming responses from the framework?
2. What's the latency overhead of proxying all I/O?
3. How does tool stripping interact with the framework's own tool validation?
4. Can the proxy inject tools that the framework doesn't natively support (via MCP bridging)?

### References

- Agent wrapper spec: `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md`
- Per-agent tool sets: Section 2 of this document

---

## 8. Relationship to Existing PRDs

| PRD             | Location                                                | Relationship                                        |
| :-------------- | :------------------------------------------------------ | :-------------------------------------------------- |
| Mesh MCP Server | `docs/specs/draft/mesh-mcp-server.md`                   | Section 3 (containers) and 5 (sessions) extend this |
| Agent Wrapper   | `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md` | Section 4 (agent.yaml) replaces/extends this        |
| MCP Tooling     | `~/src/nsheaps/mcp/docs/specs/draft/mcp-tooling.md`     | Section 6 (A2A) may complement this                 |
| 14-Phase Plan   | Elmer Fudd's plan (in team lead context)                | All sections feed into phase refinement             |

---

## 9. Next Steps

1. Research A2A protocol in depth (Road Runner)
2. Prototype agent.yaml schema as TypeScript types (Bugs Bunny)
3. Design security consultant agent definition (AI Agent Engineer + team lead)
4. Evaluate session serialization formats and S3 SDK options
5. Integrate these topics into the 14-phase plan (Elmer Fudd)
