# PRD: Agent Abstraction Levels

**Status**: Draft
**Date**: 2026-02-16

## Summary

Four levels of agent orchestration abstraction, each building on the previous. Lower levels are simpler with fewer capabilities. Higher levels enable complex multi-session, multi-task workflows.

## Levels

### Level 1: Built-in Agent Teams

Uses Claude Code's native agent teams feature. The orchestrator and all agents run within a single Claude Code process.

```
┌─────────────────────────────┐
│ Claude Code Process         │
│                             │
│  Orchestrator               │
│    ├── Agent A              │
│    ├── Agent B              │
│    └── Agent C              │
└─────────────────────────────┘
```

**Characteristics:**
- Single process, shared context
- Agents are subagents within one session
- Communication via built-in `SendMessage`
- No external infrastructure required
- Limited by single-process resource constraints

**When to use:** Simple coordination tasks where all agents share one environment and do not need independent sessions.

### Level 2: Terminal Sessions (tmux)

Each agent runs in its own terminal session managed by tmux. Mimics the built-in agent teams model but with process isolation.

```
┌──────────────────────────────────────┐
│ tmux                                 │
│                                      │
│  ┌──────────┐ ┌──────────┐          │
│  │ Session 0│ │ Session 1│  ...      │
│  │ Agent A  │ │ Agent B  │          │
│  └──────────┘ └──────────┘          │
└──────────────────────────────────────┘
```

**Characteristics:**
- Separate terminal sessions per agent
- Process isolation between agents
- Communication via the MCP/websocket protocol (see Agent Communication Protocol PRD)
- Each agent has its own shell environment
- Can be observed and interacted with independently

**When to use:** When agents need isolated shell environments or you need to observe individual agent activity in real time.

### Level 3: Controller Orchestrator

A separate agent process acts as the orchestration controller. It creates, launches, and manages other agents. Each managed agent is a single process that can parallelize work within its own session.

```
┌─────────────────────┐
│ Controller          │
│ Orchestrator        │
│ (separate process)  │
└──────────┬──────────┘
           │ manages
     ┌─────┼─────┐
     ▼     ▼     ▼
   ┌───┐ ┌───┐ ┌───┐
   │ A │ │ B │ │ C │   ← single-process agents
   └───┘ └───┘ └───┘
```

**Characteristics:**
- Controller is its own process, separate from agents
- Controller creates and manages agent lifecycle (launch, monitor, terminate)
- Each agent is a single process
- Agents can parallelize internally (e.g., using built-in agent teams within their session)
- Controller communicates with agents via the MCP/websocket protocol

**When to use:** When you need centralized lifecycle management of multiple independent agents, or when agents need different configurations, credentials, or system-level setup.

### Level 4: Hierarchical Orchestration

The controller orchestrator manages agents, and each agent itself acts as a controller orchestrator for its own sub-sessions. This creates a two-tier hierarchy where top-level agents can manage multiple concurrent sessions.

```
┌─────────────────────┐
│ Controller          │
│ Orchestrator        │
└──────────┬──────────┘
           │ manages
     ┌─────┼─────┐
     ▼     ▼     ▼
   ┌───┐ ┌───┐ ┌───┐   ← agent controller-orchestrators
   │ A │ │ B │ │ C │
   └─┬─┘ └─┬─┘ └─┬─┘
     │      │      │
   ┌─┼─┐ ┌─┼─┐ ┌─┼─┐   ← individual sessions per agent
   ▼ ▼ ▼ ▼ ▼ ▼ ▼ ▼ ▼
   sessions sessions sessions
```

**Characteristics:**
- Two-tier orchestration: controller → agent-controllers → sessions
- Each top-level agent manages multiple sessions for parallel or independent work
- Complex or resource-heavy tasks run in isolated sessions without interrupting others
- Each session can have its own global system setup (environment, credentials, dependencies)
- Enables an agent to work on multiple tasks concurrently across separate sessions

**When to use:** When agents need to perform complex or resource-heavy tasks in isolation, when different tasks require different global system configurations, or when an agent needs to work on multiple things concurrently without cross-contamination.

## Level Comparison

| Aspect                  | Level 1          | Level 2         | Level 3              | Level 4                    |
| :---------------------- | :--------------- | :-------------- | :------------------- | :------------------------- |
| Process model           | Single process   | tmux sessions   | Separate processes   | Hierarchical processes     |
| Agent isolation         | None             | Terminal-level   | Process-level        | Process + session-level    |
| Orchestrator            | Built-in         | External        | Dedicated process    | Dedicated + per-agent      |
| Parallelism             | Within session   | Across sessions | Within + across      | Multi-tier                 |
| Independent environment | No               | Shell env only  | Full process env     | Full per-session env       |
| Complexity              | Lowest           | Low             | Medium               | Highest                    |
| Infrastructure          | None             | tmux            | Controller + MCP     | Controller + MCP + agents  |

## Relationship to Communication Protocol

All levels above Level 1 use the agent communication protocol (MCP server + orchestration controller + websocket + message queue + hook injection) described in the Agent Communication Protocol PRD. Level 1 uses Claude Code's built-in communication.

## Open Questions

1. **Level mixing**: Can different levels be mixed within a single deployment (e.g., some Level 2 agents alongside Level 3)?
2. **Promotion**: Can an agent be promoted from one level to another at runtime (e.g., Level 1 agent spun out to Level 3)?
3. **Resource limits**: How are resource constraints enforced at each level?
4. **Failure propagation**: At Level 4, how do session failures propagate up to the agent-controller and then to the top-level controller?
