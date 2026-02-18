# OpenHands: Agent Platform Research Report

**Source**: OpenHands Documentation, GitHub, ICLR 2025 Paper
**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #44 (Orchestration Platforms Survey)

---

## 1. What It Is

**OpenHands** is an open-source, model-agnostic platform for AI software developers operating as generalist agents.[^1] Created by All-Hands-AI, it enables agents to interact with digital environments like humans: writing code, executing shell commands, browsing the web, and calling APIs.[^3]

**Key metrics:**

- 67,900 GitHub stars | 469 contributors | 98 releases[^2]
- **Status**: Production-ready, ICLR 2025 peer-reviewed[^4]
- **License**: MIT (core) + enterprise licensing[^2]
- **Latest**: v1.3.0 (Feb 2, 2026)
- **Performance**: SWE-Bench Verified 66.4% (state-of-the-art)[^8]

**Positioning**: Explicitly open alternative to Devin, Claude Code, Cursor with zero vendor lock-in and model-agnostic support (Claude, GPT, Llama).[^1]

---

## 2. Architecture and Design Patterns

### Core Model: Event-Sourced, Modular SDK

OpenHands V1 refactored from monolithic design into **four distinct packages**:[^5]

```
openhands.sdk         → Agent core (reasoning + action orchestration)
openhands.tools       → Concrete implementations (Bash, Python, Editor, Browser)
openhands.workspace   → Pluggable backends (Local, Remote, Docker)
openhands.agent_server → FastAPI server + REST/WebSocket APIs
```

**Principle**: "Strict separation of concerns"—agent logic is deployment-agnostic.[^5]

### Execution Model: Agent.step() Loop

Each reasoning-action cycle is a single **stateless function**:[^5]

```python
def step(state: ConversationState) -> ConversationState:
    # 1. Query LLM with current context
    response = llm.query(messages=state.messages, tools=available_tools)

    # 2. Parse into Message or Action
    events = parse_response(response)

    # 3. Execute tools, generate observations
    for action in events:
        observation = execute_tool(action)
        events.append(observation)

    # 4. Append to immutable state log
    state.append_events(events)
    return state
```

**Key property**: Agent holds no mutable state between steps—enables interruption, inspection, and resumption.[^5]

### State: ConversationState (Event Log)

Single source of truth, immutable and append-only:[^4]

```
ConversationState:
  - messages[]       # User + Assistant conversation
  - actions[]        # All executed actions (Bash, Edit, etc.)
  - observations[]   # Environmental feedback
  - metadata{}       # Session info, timestamps
```

**Benefits**:

- Deterministic replay for full session recovery
- Pause/resume capability (pause at step N, deploy new agent version, resume with exact context)
- Fully serializable over network (local, remote, Docker)

### Workspace Interface: Pluggable Execution

Three implementations, same agent code:[^5]

| Workspace           | Backend                 | Use Case                   |
| ------------------- | ----------------------- | -------------------------- |
| **LocalWorkspace**  | Direct filesystem/shell | Development, single-user   |
| **RemoteWorkspace** | HTTP/gRPC to server     | Distributed, multi-user    |
| **DockerWorkspace** | Container sandbox       | Isolation, resource limits |

---

## 3. Agent Communication Model

### Type-Safe Event Hierarchy

All communication flows through **Pydantic-validated event stream**:[^5]

```
Event
├── Message (UserMessage, AssistantMessage)
├── Action (BashAction, PythonAction, EditAction, AgentDelegateAction)
└── Observation (CommandObservation, ErrorObservation, FileObservation)
```

**Contract**: Action → Execution → Observation (deterministic, reversible, fully typed)

### Sub-Agent Delegation (First-Class)

Agents coordinate via **AgentDelegateAction**, a standard action type:[^6]

```python
class AgentDelegateAction(Action):
    task: str                # What to delegate
    agent_name: str          # Which agent (e.g., "BrowsingAgent")
    workspace: WorkspaceRef  # Shared workspace context
    model_config: LLMConfig  # Inherited from parent
```

**Execution**:

1. Parent identifies task needs specialization
2. Creates AgentDelegateAction with task + agent name
3. Framework spawns sub-agent (inherits parent LLM config, shares workspace)
4. Sub-agent runs independent reasoning loop
5. Returns observation with results
6. Parent continues with observation in context

**Current behavior**: Blocking (sequential), but architecture supports async patterns.[^6]

### Distributed Communication: FastAPI + WebSocket

Built-in server for remote deployment:[^5]

```
Frontend (Browser/IDE)
  ├─ REST API: GET /conversations/{id}, POST /step
  └─ WebSocket: Real-time action/observation streaming

RemoteConversation (Client)
  ├─ Serializes agent.step() over HTTP
  ├─ Receives observations via WebSocket stream
  └─ Updates local state incrementally
```

---

## 4. Task Management

**Current**: No native task management. Task is **implicit in conversation history**:[^3]

- User's initial message = task definition
- All subsequent messages/actions = task progress
- Event stream = task execution trace

**Planned**: GitHub issue #7290 proposes explicit `TASK` microagents (under development, not production).

**Evaluation harness** (for benchmarking):[^8]

```python
@dataclass
class EvaluationTask:
    description: str
    initial_state: State
    success_criteria: Callable
    user_response_fn: Callable  # Simulates user interaction
```

Used for SWE-Bench (GitHub issue resolution) and WebArena (web interaction tasks).[^8]

---

## 5. Unique Features

1. **Event-Sourced Deterministic State**: Full event log enables pause/resume and deterministic replay.[^4] Agent can be paused mid-step, new version deployed, and resumed with exact context preserved.

2. **Composable Multi-Package SDK**: Researchers can use SDK without server, or swap tools/workspaces without touching agent core.[^5]

3. **MCP Native Support**: Agents auto-discover external tools (Notion, GitHub, etc.) via Model Context Protocol without recompilation.[^7]

4. **Multi-Agent as Tool Abstraction**: Sub-agent delegation is a standard Tool, not special-cased.[^6] Complex patterns (fan-out, pipelines) become user-defined.

5. **Production-Ready Infrastructure**: Built-in FastAPI server with REST/WebSocket, session management, multi-user support, Kubernetes-ready.[^3]

6. **Rigorous Evaluation**: OpenHands Index provides comprehensive benchmarking (15+ task categories, SWE-Bench, WebArena) with reproducible harness.[^8]

---

## 6. Comparison to Claude Code Agent Teams

| Aspect                      | Claude Code Teams                      | OpenHands                                       |
| --------------------------- | -------------------------------------- | ----------------------------------------------- |
| **Spawning**                | Fire-and-forget subprocess             | Explicit agent lifecycle management             |
| **Communication**           | File-based inbox + settings.json       | Type-safe event stream (JSON, Pydantic)         |
| **State Model**             | Process mutable state                  | Event-sourced immutable log                     |
| **Coordination**            | Leader sends files, workers read/write | Parent waits on AgentDelegateAction observation |
| **Backend**                 | tmux -CC or in-process                 | Docker sandbox (configurable)                   |
| **Pause/Resume**            | Process-level (kill/restart)           | Resume from event log                           |
| **Serialization**           | Implicit (file paths)                  | Explicit (JSON over network)                    |
| **Multi-Agent Parallelism** | Independent agents (true parallelism)  | Sub-agents inherit parent context (sequential)  |
| **Error Recovery**          | Restart required                       | Replay event log                                |
| **Remote Deployment**       | Difficult (process-bound)              | Built-in RemoteConversation                     |

### State Management Contrast

**Claude Code Teams** (Distributed files, eventual consistency):

```
leader.py ← → settings.json ← → worker.py
            (shared disk)
```

**OpenHands** (Centralized event log, strong consistency):[^4]

```
ConversationState (single source of truth)
  ├─ messages[]
  ├─ actions[]
  └─ observations[]
     ↓
Sub-agents inherit, read-only reference
```

---

## 7. Lessons for Our Approach

### Key Patterns to Adopt

1. **Event-sourced state** (append-only, immutable): Enables pause/resume, deterministic replay, remote serialization without additional plumbing.[^4]

2. **Type-safe action contracts** (Pydantic models): Validate before execution, enable schema export, support tool discovery (MCP).[^5]

3. **Workspace as pluggable interface**: Same agent code runs locally, in Docker, or remotely without changes.[^5]

4. **Multi-agent as tool abstraction**: Complex orchestration (fan-out, pipelines) becomes user-defined, not framework-special-cased.[^6]

5. **Built-in REST/WebSocket from day 1**: Remote deployment, multi-user, and browser UIs become natural consequences, not afterthoughts.[^3]

6. **Evaluation framework as first-class**: Benchmark support designed in, not added post-hoc. Enables comparative analysis and prevents regressions.[^8]

7. **Provider-agnostic via LLM interface**: Define LLM contract, not implementation. Supports Claude, GPT, Llama without core changes.[^1]

8. **Configuration immutability**: Agent configuration (model, tools, skills) immutable at construction. Prevents runtime surprises, enables caching, supports serialization.[^5]

### What NOT to Copy

- **Sub-agent blocking behavior**: Current OpenHands waits for sub-agents sequentially.[^6] Consider true async parallelism for fan-out patterns (Claude Code Teams already handle this with independent processes).
- **Lack of explicit task management**: OpenHands task tracking is implicit. Claude Code Teams should add explicit task state machine for better progress visibility.
- **Docker-only sandboxing**: OpenHands uses Docker; Claude Code Teams use tmux. Both valid—consider hybrid support.

---

## References

[^1]: https://openhands.dev/

[^2]: https://github.com/OpenHands/OpenHands

[^3]: https://docs.openhands.dev/

[^4]: https://openreview.net/pdf/95990590797cff8b93c33af989ecf4ac58bde9bb.pdf

[^5]: https://arxiv.org/html/2511.03690v1

[^6]: https://docs.openhands.dev/sdk/guides/agent-delegation

[^7]: https://docs.openhands.dev/sdk/guides/mcp

[^8]: https://www.swebench.com/

---

**Research compiled**: February 16, 2026
**Confidence**: High (ICLR 2025 peer-reviewed, active project, 67.9k GitHub stars)
