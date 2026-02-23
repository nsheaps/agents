# Agent Team Architecture — Design Discussion

> **Status**: Draft — brainstorming and requirements gathering
> **Language**: TypeScript + Bun (all components). Exception: K8s controller (Go).
> **Date**: 2026-02-17

This document captures design topics raised during the looney-tunes team session. Each section is a discussion topic that needs further research, design, and specification before implementation.

## MVP Priority: Reliable Agent Lifecycle

> **First goal**: The ability to launch an agent, kill it, and relaunch it reliably on the same system — without stale entries, name collisions, or manual config surgery.

Before any of the features below, the foundational lifecycle must work:

1. **Launch**: Spawn an agent by name with specified permissions and framework
2. **Kill**: Cleanly terminate an agent, removing it from team config — **implemented** (`killAgent` kills tmux pane via `tmuxPaneId`, then removes config entry; `f2fe867`)
3. **Relaunch**: Spawn the same agent name again without `-2` suffixes or stale entries
4. **Health check**: Detect when an agent's backend (tmux pane, container, process) has died — **implemented** (`listAgents` reports RUNNING/DEAD/UNKNOWN based on `isTmuxPaneAlive`; `f2fe867`)
5. **Auto-cleanup**: Remove dead agents from config automatically — **implemented** (`cleanupStaleEntries` checks pane liveness and removes dead entries; `f2fe867`)

### TeamMember Extensions

The `TeamMember` interface in `src/lifecycle.ts` extends Claude Code's base config with fields set at spawn time:

| Field        | Type      | Purpose                                                                                                  | Added in  |
| :----------- | :-------- | :------------------------------------------------------------------------------------------------------- | :-------- |
| `tmuxPaneId` | `string?` | Tmux pane ID for kill/health/cleanup operations                                                          | `f2fe867` |
| `agentName`  | `string?` | Agent file name (e.g. `"software-eng"`) for correlating config display names with discovered agent files | `9a7354b` |

**Why `agentName` is needed**: Claude Code stores display names in config (e.g. `"Bugs B (software-eng)"`), but agent files are named by slug (e.g. `software-eng.md`). The `agentName` field bridges this gap — `listAgents` uses it to match discovered files to config entries, falling back to direct name comparison when not set.

### Agent Health Statuses

| Status        | Meaning                                                          |
| :------------ | :--------------------------------------------------------------- |
| `RUNNING`     | Config entry exists, `tmuxPaneId` set, pane is alive             |
| `DEAD`        | Config entry exists, `tmuxPaneId` set, pane is not alive (stale) |
| `UNKNOWN`     | Config entry exists but no `tmuxPaneId` (cannot verify)          |
| `NOT_SPAWNED` | Agent file exists but no config entry                            |

The original stale entry problem (see `.claude/behaviors/team-member-cleanup.md`) is now addressed by `cleanupStaleEntries`, which removes DEAD entries automatically.

> **Migration note**: The current entry point is `bin/claude-team` in [nsheaps/claude-utils](https://github.com/nsheaps/claude-utils). The agent CLI (`agent launch`) will eventually replace this script. The migration path is: `claude-team` → `agent launch` with compatible flags and config.

---

## Post-MVP Discussion Topics

> The following sections are design discussions for future phases. **None are in scope for the MVP.** Sections §1–§9 capture ideas raised during team sessions that will be prioritized, refined, and scheduled after the MVP lifecycle is reliable.

---

## 1. Security Consultant Agent

### Concept

A specialized agent that acts as a runtime permission gate and agent configuration advisor. When an agent lacks permissions for an action, instead of blocking outright, the security consultant can:

- **Approve/deny one-time actions**: "Agent X wants to run `git push --force`. Approve?"
- **Modify agent configurations**: Add needed permissions to an agent's definition when the lack of permission is a recurring pattern
- **Defer to the user**: When uncertain, escalate to the human via the agent's interface
- **Work with the AI Agent Eng**: Collaborate on agent modifications — security consultant handles permission changes, AI Agent Eng handles behavioral changes (see §1b: Agent Creation Workflow)

### Interface

- Uses the agent's own interface (not a separate UI) to present approve/deny decisions
- Potentially uses [A2A (Agent-to-Agent) protocol](https://google.github.io/A2A/) for structured inter-agent permission requests
- Could implement a "permission escalation chain": agent → security consultant → user

### Design Questions

1. How does the security consultant intercept permission requests? Hook into `PreToolUse`?
2. What's the approval scope? Per-action, per-session, permanent?
3. How are one-time approvals tracked and expired?
4. What's the trust model? Can the security consultant grant permissions the user hasn't pre-approved?
5. How does this interact with Claude Code's existing permission modes (default, bypassPermissions, acceptEdits, dontAsk, plan)?

### References

- Claude Code permission modes: https://code.claude.com/docs/en/permissions
- A2A protocol: https://google.github.io/A2A/
- Existing `PreToolUse` hooks for permission gating

---

## 1b. Agent Creation Workflow

### Concept

Creating a new agent is a **collaborative process** involving three specialized roles. No single role owns the full agent definition — each contributes their domain expertise to produce a well-rounded, secure, and operationally sound agent.

### The Three Roles

| Role                    | Agent             | Owns                                        | Focus                                 |
| :---------------------- | :---------------- | :------------------------------------------ | :------------------------------------ |
| **AI Agent Eng**        | `ai-agent-eng`    | Behavior, prompt, role definition           | What the agent does and how it thinks |
| **Security Consultant** | (future — see §1) | Permissions, access control, trust model    | What the agent is allowed to do       |
| **Ops Eng**             | `ops-eng`         | Infrastructure, credentials, runtime config | How the agent runs                    |

### Field Ownership in agent.yaml / Agent Frontmatter

Each role owns specific fields in the agent definition. This prevents conflicts and ensures appropriate expertise is applied to each concern.

#### AI Agent Eng Fields

| Field                    | Description                                                      |
| :----------------------- | :--------------------------------------------------------------- |
| `name`                   | Agent identifier                                                 |
| `description`            | When to invoke this agent (trigger conditions)                   |
| `prompt_mode`            | EXTEND vs REPLACE                                                |
| `base_prompt`            | Base prompt source                                               |
| `model`                  | Model selection for the role                                     |
| `display_name`           | Display name format                                              |
| `color`                  | UI color                                                         |
| Markdown body            | Full system prompt (role, responsibilities, process, boundaries) |
| `<system-message>` block | Core identity/personality traits                                 |

#### Security Consultant Fields

| Field                          | Description                                                |
| :----------------------------- | :--------------------------------------------------------- |
| `permission_mode`              | default / bypassPermissions / acceptEdits / dontAsk / plan |
| `dangerously_skip_permissions` | Whether to bypass all permission checks                    |
| `tools`                        | Whitelist of available tools                               |
| `disallowed_tools`             | Blacklist of tools (with pattern support)                  |
| `permissions.allowed`          | Allowed command patterns (Phase 2 agent.yaml)              |
| `permissions.denied`           | Denied command patterns (Phase 2 agent.yaml)               |

#### Ops Eng Fields

| Field                 | Description                                  |
| :-------------------- | :------------------------------------------- |
| `framework`           | Agent framework (claude-code, codex, custom) |
| `teammate_mode`       | Display mode (auto, in-process, tmux)        |
| `continue_session`    | Session resumption                           |
| `container`           | Docker/K8s configuration (Phase 2+)          |
| `workspace`           | Volume mounts, repo clones (Phase 2+)        |
| `mesh`                | Mesh MCP connection groups (Phase 2+)        |
| Environment variables | Runtime env setup                            |

### Creation Workflow

```
1. AI Agent Eng: Design the role
   - Define responsibilities, boundaries, process
   - Write system prompt (markdown body)
   - Choose model and prompt mode
   - Create persona file (.claude/personas/)

2. Security Consultant: Set permissions
   - Review responsibilities → determine minimum required tools
   - Set permission_mode (principle of least privilege)
   - Define tool whitelist/blacklist
   - Review system prompt for unsafe instructions
   - Flag any prompt content that could lead to permission escalation

3. Ops Eng: Configure runtime
   - Set framework and teammate_mode
   - Configure infrastructure (container, workspace — Phase 2+)
   - Set up app credentials and environment variables
   - Validate the agent can actually run with given permissions

4. Cross-review
   - AI Agent Eng verifies permissions don't cripple the agent's ability to do its job
   - Security Consultant verifies prompt doesn't instruct the agent to bypass controls
   - Ops Eng verifies the runtime environment supports the required tools
```

### Phase 1 Reality

In Phase 1 (agent launcher MVP), the security consultant agent doesn't exist yet. The workflow simplifies to:

- **AI Agent Eng** handles behavior + prompt + a first pass at tool sets
- **Ops Eng** handles runtime config
- **Team lead / user** reviews permissions (standing in for security consultant)

The three-role workflow becomes fully operational when the security consultant agent is implemented (Phase 2+).

### Why This Matters

Without defined ownership:

- Agents get created with overly broad permissions (no security review)
- Tool sets don't match responsibilities (behavior/permissions mismatch)
- Infrastructure assumptions are baked into prompts (coupling)
- Runtime failures are hard to diagnose (no single owner for operational concerns)

### References

- Agent launcher spec: `docs/specs/draft/agent-launcher.md` §3 (schema), §7 (tool control)
- Writing agent files skill: `plugins/agent-team-skills/skills/writing-agent-team-agents/SKILL.md`
- Security consultant concept: §1 of this document

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

### Agent Configuration Formats — Disambiguation

The ecosystem has three YAML-related agent config formats. They serve different purposes and are not interchangeable:

| Format                      | Location                                                      | Purpose                                                                                  | Status                        |
| :-------------------------- | :------------------------------------------------------------ | :--------------------------------------------------------------------------------------- | :---------------------------- |
| **Claude Code agent files** | `.claude/agents/{name}.md` (YAML frontmatter + markdown body) | Agent prompts and metadata for Claude Code's built-in agent system                       | Current — used today          |
| **agent.yaml** (proposed)   | `agents/{name}/agent.yaml`                                    | Full agent definition (tools, container, permissions, mesh) for the agent-team framework | Future — target format        |
| **Project .agent.yaml**     | `.agent.yaml` (project root)                                  | Launch config for the `agent` CLI wrapper — profiles, MCP configs, settings overrides    | Future — project-level config |

**Migration path**: `.claude/agents/*.md` is the starting point. The agent launcher reads these today. As the framework matures, agent definitions will migrate to `agents/{name}/agent.yaml` with richer schema. Both formats may coexist during transition — the launcher will read both and prefer `agent.yaml` when present.

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

### Migration from Current Format

The current `.claude/agents/*.md` files will not be abandoned overnight. The migration path:

1. **Phase 1 (now)**: Agent launcher reads `.claude/agents/*.md` with YAML frontmatter
2. **Phase 2**: Introduce `agents/{name}/agent.yaml` alongside existing files. Launcher reads both, prefers `agent.yaml`
3. **Phase 3**: Provide a migration tool (`agent migrate`) to convert `.claude/agents/*.md` → `agents/{name}/` structure
4. **Phase 4**: Deprecate `.claude/agents/*.md` for team-managed agents (still valid for Claude Code's built-in agent system)

### agent.yaml Schema

```yaml
name: software-eng
character: Bugs Bunny
role: Software Eng
framework: claude-code
model: claude-opus-4-6

tools:
  - messaging
  - tasks
  - filesystem
  - execution

permissions:
  mode: bypassPermissions # or default, acceptEdits, dontAsk, plan
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

### Relationship to Mesh MCP: Complementary, Not Replacement

The mesh MCP server is the **committed direction** for intra-team real-time communication. A2A is a potential **future complement** for cross-team and cross-framework interoperability — it does not replace mesh MCP.

| Concern                | Mesh MCP              | A2A                   |
| :--------------------- | :-------------------- | :-------------------- |
| Intra-team messaging   | Primary               | Not needed            |
| Cross-framework agents | Not designed for this | Natural fit           |
| Agent discovery        | Within team config    | Standardized protocol |
| Maturity               | In-progress, QA'd     | Early-stage protocol  |

### Research Needed

- A2A protocol maturity and adoption
- How A2A maps to the existing SendMessage/Task primitives
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

### Relationship to Per-Agent Tool Sets (§2)

The static tool set defined in agent config (§2) establishes the agent's **baseline capabilities**. The I/O proxy can further **restrict or modify tools at runtime** — stripping tools based on context, replacing them with mocks, or adding new ones via MCP bridging. Static config = what the agent starts with. Proxy = what gets dynamically enforced.

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

- **Source of truth for I/O proxy design**: [Agent Wrapper PRD §I/O Proxy Architecture](https://github.com/nsheaps/agent/blob/main/docs/specs/draft/agent-wrapper.md#io-proxy-architecture) — the wrapper PRD owns the full proxy design. This section summarizes the team-level perspective.
- Per-agent tool sets: Section 2 of this document

---

## 8. Agent Self-Exit and Relaunch

### Concept

An agent can request its own restart with updated configuration — without intervention from the team lead, PM, or user. The CLI wrapper process stays alive while the inner agent session terminates and relaunches with new settings. This enables dynamic reconfiguration (model swap, tool changes, permission adjustments) driven by the agent itself.

This is distinct from the external relaunch in the agent launcher spec (§6.5), where the user or orchestrator triggers `agent relaunch <name>`. Self-exit/relaunch is **agent-initiated**.

### Use Cases

1. **Model swap**: An agent detects that its current task requires deeper reasoning and requests a restart on a higher-capability model (e.g., Sonnet → Opus for a complex code review)
2. **Tool set change**: An agent needs tools it wasn't initially granted — requests a restart with an expanded tool set (subject to security consultant approval in Phase 2+)
3. **Permission escalation**: An agent needs elevated permissions for a specific operation — restarts with higher permission mode, then reverts after
4. **Context reset**: An agent's context is nearly full — it saves state to files, then requests a clean restart with its memory loaded fresh
5. **Configuration drift correction**: The agent definition file was updated on disk — the agent requests a restart to pick up the new config

### Architecture

```
┌─────────────────────────────────────┐
│  agent CLI wrapper (stays alive)    │
│                                     │
│  1. Receives restart request (IPC)  │
│  2. Saves exit reason + new config  │
│  3. Terminates inner session        │
│  4. Reads updated config            │
│  5. Spawns new inner session        │
│  6. Injects context from prior run  │
└─────────────────────────────────────┘
         ▲                  │
         │ IPC              │ spawn
         │ (restart req)    ▼
┌─────────────────────────────────────┐
│  Inner agent session (claude/codex) │
│                                     │
│  - Detects need for reconfiguration │
│  - Saves state to files             │
│  - Sends restart request to wrapper │
│  - Session terminates               │
└─────────────────────────────────────┘
```

### IPC Mechanism

The agent needs a way to signal the wrapper. Options:

| Mechanism                  | Pros                                                        | Cons                                           |
| :------------------------- | :---------------------------------------------------------- | :--------------------------------------------- |
| MCP tool (`agent.restart`) | Native to the agent's toolset, structured request           | Requires MCP server in the wrapper             |
| Exit code convention       | Simple, no extra infrastructure                             | Limited payload (just a code, no config delta) |
| File-based signal          | Agent writes restart request to known path, wrapper watches | Latency, cleanup needed                        |
| Named pipe / Unix socket   | Low latency, bidirectional                                  | Platform-specific, more complex                |

**Recommended**: MCP tool provided by the wrapper's MCP server. The agent calls `agent.restart` with the desired config changes as parameters. This is the most natural interface for LLM-based agents and integrates with the mesh MCP server design (see `docs/specs/draft/mesh-mcp-server.md`).

### State Preservation Across Restart

When an agent restarts, it needs continuity:

1. **Pre-restart**: Agent writes current state to `.claude/tmp/{agent-name}-restart-state.md` (task progress, findings, context summary)
2. **Post-restart**: Wrapper injects the state file into the new session's system prompt via `--append-system-prompt` or equivalent
3. **Task list**: Operational tasks survive in the persistent task system (see scratch.md on persistent task tracking)

### Guardrails

Self-relaunch is powerful and needs constraints:

- **Rate limiting**: Maximum N restarts per time window (prevent restart loops)
- **Config change approval**: In Phase 2+, the security consultant must approve permission escalations — the wrapper blocks until approval is received
- **Audit trail**: Every restart is logged with reason, old config, new config, and timestamp
- **Rollback**: If the new config causes immediate failure, the wrapper reverts to the previous config
- **Team notification**: The orchestrator and AI Agent Eng are notified of every self-restart

### Design Questions

1. Can the wrapper distinguish between a crash and an intentional self-exit? (Exit code convention vs explicit IPC)
2. Should config changes be scoped (temporary for one task) or permanent (updates the agent file on disk)?
3. How does self-restart interact with session save/restore (§5)? Is a self-restart a new session or a continuation?
4. What's the maximum config delta an agent can request? Can it change its own role or just operational parameters?
5. How does this interact with containerized agents (§3)? Container restart is heavier than process restart.

### References

- Agent launcher relaunch (external): `docs/specs/draft/agent-launcher.md` §6.5
- Session save/restore: §5 of this document
- Mesh MCP server: `docs/specs/draft/mesh-mcp-server.md`
- Scratch note: `docs/scratch.md` line 33 — original requirement

---

## 9. Observability and Tracing

### Concept

Each agent process should emit telemetry that identifies it by name, role, and team — enabling per-agent cost tracking, performance monitoring, and failure diagnosis across the entire team. Claude Code already supports OTEL natively; the launcher just needs to set the right resource attributes per agent.

### What Claude Code Already Emits

With `CLAUDE_CODE_ENABLE_TELEMETRY=1`, Claude Code natively exports:

- **Metrics**: `claude_code.token.usage` (by model), `claude_code.cost.usage` (USD per request), `claude_code.active_time.total`, `claude_code.lines_of_code.count`, `claude_code.commit.count`
- **Events**: `claude_code.user_prompt`, `claude_code.tool_result` (tool_name, success, duration_ms), `claude_code.api_request` (model, cost, tokens), `claude_code.api_error`
- **Standard attributes on all telemetry**: `session.id`, `service.name` (defaults to `claude-code`, overridable), `terminal.type`, `service.version`

No extra code is needed — the launcher only needs to set env vars before spawning each agent.

### Per-Agent Resource Attributes

The launcher should set these env vars per agent process at spawn time:

```bash
# Per-agent (varies per spawn)
OTEL_SERVICE_NAME="agent-team.${agent_role}"
OTEL_RESOURCE_ATTRIBUTES="gen_ai.agent.name=${display_name},gen_ai.agent.id=${agent_id},agent_team.role=${role},agent_team.team_name=${team_name},gen_ai.conversation.id=${session_id}"

# Global (same for all agents)
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT="http://${collector}:4317"
```

### Attribute Naming: OTEL GenAI Conventions

Align with the [GenAI Agent Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) where they exist:

| Our Attribute        | OTEL Convention          | Status                                                                                                      |
| :------------------- | :----------------------- | :---------------------------------------------------------------------------------------------------------- |
| Agent name           | `gen_ai.agent.name`      | Stable                                                                                                      |
| Agent ID             | `gen_ai.agent.id`        | Stable                                                                                                      |
| Session/conversation | `gen_ai.conversation.id` | Stable                                                                                                      |
| Agent role           | `agent_team.role`        | Custom (no standard yet)                                                                                    |
| Team name            | `agent_team.team_name`   | Custom (proposed in [OTEL Issue #2664](https://github.com/open-telemetry/semantic-conventions/issues/2664)) |

Use `gen_ai.*` where conventions exist, `agent_team.*` for custom attributes. Migrate custom attributes to standard names when the GenAI SIG finalizes team/task conventions.

### Phased Implementation

1. **Phase 1 — Resource attributes** (minimal effort, high value): Launcher sets `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` per agent. Immediate per-agent filtering in any OTEL backend.
2. **Phase 2 — Observability backend**: Choose Grafana + Prometheus + Loki (self-hosted, free) or Braintrust/Honeycomb/SigNoz (managed). Same OTEL attributes work with any backend.
3. **Phase 3 — Hook-based tracing** (richer data): Custom hooks (`PreToolUse`, `PostToolUse`) emit distributed trace spans per tool call, enabling parent-child span relationships across tools.

### Backend Options

| Backend                      | Type        | Unique Value                                       | Cost              |
| :--------------------------- | :---------- | :------------------------------------------------- | :---------------- |
| Grafana + Prometheus + Loki  | Self-hosted | Full control, no data sharing                      | Free (infra cost) |
| Braintrust                   | SaaS        | Converts traces → eval datasets, prompt comparison | Paid              |
| Honeycomb / Datadog / SigNoz | Managed     | Production-grade, rich querying                    | Paid              |

**Recommendation**: Stay backend-agnostic in the launcher. Let users configure their preferred backend via collector pipeline config, not launcher flags.

### Design Questions

1. Should `OTEL_SERVICE_NAME` be per-role (`agent-team.software-eng`) or per-instance (`agent-team.bugs-bunny-01`)? Recommendation: per-role in service name, per-instance in `gen_ai.agent.id`.
2. Should the launcher define `agent_team.task.id` and `agent_team.task.subject` as custom attributes now, or wait for the GenAI SIG to standardize task conventions?
3. Hook-based tracing (Phase 3) captures more granular data than native telemetry. Is the added complexity worth it for the agent-team use case?

### References

- Claude Code monitoring docs: https://code.claude.com/docs/en/monitoring-usage
- OTEL GenAI agent conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
- OTEL agentic systems proposal: https://github.com/open-telemetry/semantic-conventions/issues/2664
- Full research report: `.claude/tmp/braintrust-otel-research.md` (Road Runner, #140)

---

## 10. Relationship to Existing PRDs

| Architecture Section     | PRD             | Location                                                | Relationship                                                                        |
| :----------------------- | :-------------- | :------------------------------------------------------ | :---------------------------------------------------------------------------------- |
| §1 Security Consultant   | (none yet)      | —                                                       | Needs its own PRD when prioritized                                                  |
| §1b Agent Creation       | (none yet)      | —                                                       | Cross-role workflow; may need its own spec for tooling support                      |
| §2 Per-Agent Tool Sets   | Agent Wrapper   | `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md` | Tool sets implemented via wrapper settings profiles                                 |
| §3 Docker Containers     | Mesh MCP Server | `docs/specs/draft/mesh-mcp-server.md`                   | Containers need mesh networking                                                     |
| §4 Agent Definition      | Agent Wrapper   | `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md` | agent.yaml schema extends wrapper config                                            |
| §5 Session Save/Restore  | Mesh MCP Server | `docs/specs/draft/mesh-mcp-server.md`                   | Session state may include mesh connection info                                      |
| §6 A2A Protocol          | MCP Tooling     | `~/src/nsheaps/mcp/docs/specs/draft/mcp-tooling.md`     | A2A complements (does not replace) mesh MCP — see note below                        |
| §7 I/O Proxy             | Agent Wrapper   | `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md` | **Wrapper PRD is source of truth** for proxy design; §7 summarizes                  |
| §8 Self-Exit/Relaunch    | Agent Wrapper   | `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md` | Wrapper owns the process lifecycle; §8 captures the agent-initiated restart pattern |
| §9 Observability/Tracing | Agent Wrapper   | `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md` | Launcher sets per-agent OTEL env vars at spawn time                                 |
| All sections             | 14-Phase Plan   | Elmer Fudd's plan (in team lead context)                | All sections feed into phase refinement                                             |

---

## 11. Next Steps

1. Research A2A protocol in depth (Road Runner)
2. Prototype agent.yaml schema as TypeScript types (Bugs Bunny)
3. Design security consultant agent definition (AI Agent Eng + team lead)
4. Evaluate session serialization formats and S3 SDK options
5. Integrate these topics into the 14-phase plan (Elmer Fudd)
