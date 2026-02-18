# Room-Based and Channel-Based Messaging Patterns for Multi-Agent Systems

> Supplementary research for the agent-team messaging abstraction layer.
> Date: 2026-02-17

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Multi-Agent Framework Messaging Patterns](#multi-agent-framework-messaging-patterns)
3. [Chat Room and Channel Patterns](#chat-room-and-channel-patterns)
4. [Pub/Sub for Agents](#pubsub-for-agents)
5. [User-as-Participant Pattern](#user-as-participant-pattern)
6. [Context Token Optimization](#context-token-optimization)
7. [Synthesis: Recommended Patterns for agent-team](#synthesis-recommended-patterns-for-agent-team)
8. [Sources](#sources)

---

## Executive Summary

Across the multi-agent ecosystem, there are five dominant communication models: **shared state graphs** (LangGraph), **hierarchical delegation** (CrewAI), **group chat rooms** (AutoGen), **event-sourced logs** (OpenHands), and **standardized inter-agent protocols** (Google A2A, MCP). The most relevant patterns for the agent-team project -- where Claude Code instances communicate via tmux and messages currently consume the lead's context window -- are:

1. **File-backed message rooms** (inspired by OpenHands event sourcing + filesystem-based agent state)
2. **Priority-tiered message injection** (only critical messages enter context; everything else goes to a readable log)
3. **Digest/summary polling** (agent reads room summaries on-demand rather than receiving every message as a conversation turn)

These patterns can be implemented without changes to Claude Code internals by using shared files as the communication medium, with a thin coordination layer managing rooms, subscriptions, and priority routing.

---

## Multi-Agent Framework Messaging Patterns

### LangGraph: Shared State Graph

**Model**: Centralized mutable state object with typed channels.

LangGraph treats inter-agent communication as a graph computation problem. All agents (graph nodes) read from and write to a shared `State` object. Communication happens implicitly through state mutation rather than explicit message passing.

Key concepts:
- **Channels** are typed state fields that nodes subscribe to. A node reads its input channels, processes, and writes to output channels.
- **PregelNodes** (named after Google's Pregel graph processing model) are the actors that subscribe to and publish on channels.
- **Private channels** allow internal node-to-node communication without polluting the main state.
- **Shared scratchpad**: Multiple agents can collaborate on a shared message list where all work is visible to all participants.

**Relevance to agent-team**: The channel concept maps well to rooms. Private channels demonstrate that not all communication needs to flow through the main state (analogous to not injecting every message into the lead's context). However, LangGraph assumes in-process shared memory, which does not apply to tmux-based agent instances.

**Strengths**: Fine-grained control over what state flows where. Typed channels prevent pollution.
**Weaknesses**: Assumes co-located agents sharing memory. No built-in persistence or room abstraction.

> Reference: [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api), [LangGraph Multi-Agent Workflows](https://blog.langchain.com/langgraph-multi-agent-workflows/)

### CrewAI: Hierarchical Delegation

**Model**: Hub-and-spoke with manager/worker hierarchy.

CrewAI uses a strict delegation model where a manager agent decomposes tasks and delegates to worker agents. Communication is structured as task assignment and result reporting -- not free-form messaging.

Key concepts:
- **Delegation tools**: When `allow_delegation=True`, agents can assign tasks to teammates and ask specific questions.
- **Hub-and-spoke only**: No peer-to-peer agent traffic. All communication flows through the manager.
- **Memory**: With memory enabled, agents learn from previous collaborations and improve delegation decisions.
- **Structured responses**: Workers respond with machine-readable (JSON) reports rather than conversational messages.
- **Flows**: Event-driven control with conditional branching and secure state management for production scaffolding.

**Relevance to agent-team**: The hierarchical model matches the orchestrator/worker pattern. The structured response format (JSON reports rather than conversational text) is a strong pattern for reducing context consumption. The strict hub-and-spoke model prevents context pollution from peer chatter.

**Strengths**: Clear communication boundaries. Structured output reduces ambiguity.
**Weaknesses**: No room-like broadcast capability. Workers cannot observe each other's progress.

> Reference: [CrewAI Collaboration Docs](https://docs.crewai.com/en/concepts/collaboration), [CrewAI Hierarchical Delegation Guide](https://activewizards.com/blog/hierarchical-ai-agents-a-guide-to-crewai-delegation)

### AutoGen: Group Chat (Room Pattern)

**Model**: Shared conversation room with turn-based speaking managed by a chat manager.

AutoGen's GroupChat is the closest existing pattern to a room-based model. Multiple agents participate in a shared conversation, with a GroupChat Manager selecting who speaks next.

Key concepts:
- **Group topic**: All participants subscribe to a common topic. Messages published to this topic are visible to all members.
- **RequestToSpeak**: The manager sends targeted messages to select the next speaker, rather than all agents speaking freely.
- **Speaker transitions**: Configurable constraints on which agents can follow which, preventing uncontrolled cross-talk.
- **Dual subscription**: Each agent subscribes to both the group topic (shared room) and its own private topic (direct messages).
- **v0.4 async rewrite (Jan 2025)**: Complete architectural overhaul built on async message passing, allowing truly parallel agent operation.

**Relevance to agent-team**: This is the most directly applicable model. The dual-subscription pattern (group room + private DM channel) maps cleanly to rooms. The speaker transition constraints provide a governance mechanism. However, AutoGen still assumes all messages flow through the agents' context windows -- there is no digest or summary mechanism.

**Strengths**: True room semantics. Broadcast + DM. Speaker governance.
**Weaknesses**: All messages consume context. No built-in summarization or priority filtering.

> Reference: [AutoGen Group Chat](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html), [AutoGen Conversation Patterns](https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns/)

### OpenHands: Event-Sourced State

**Model**: Immutable event log with typed actions and observations.

OpenHands (formerly OpenDevin) uses an event-sourcing architecture where all interactions -- agent messages, tool invocations, user inputs -- are modeled as immutable events appended to an event log.

Key concepts:
- **Event log**: The canonical source of truth. All state is derived by replaying the event log.
- **Typed events**: Actions (AgentMessageAction, AgentDelegateAction, CmdRunAction) and observations (CmdOutputObservation, etc.) are distinct types.
- **AgentDelegateAction**: Explicit delegation to specialized sub-agents (e.g., CodeActAgent delegates browsing to BrowsingAgent).
- **ConversationState**: Mutable session metadata tracking current state, derived from the event log.
- **WebSocket streaming**: Real-time event streaming to UIs without polling.
- **Agent Client Protocol (ACP)**: JSON-RPC over stdio for editor integration, similar to LSP.

**Relevance to agent-team**: The event-sourced model is highly relevant. Messages as immutable events in a log file is exactly the "room as a file" pattern. Agents can read the log to catch up, and the log can be summarized or filtered without losing the source of truth. The typed event model also enables priority filtering (e.g., only inject ErrorObservation events into the lead's context).

**Strengths**: Clean separation of event storage from context injection. Replay capability. Typed events enable filtering.
**Weaknesses**: Requires infrastructure for event log management. Delegation is 1:1, not room-based.

> Reference: [OpenHands Software Agent SDK](https://arxiv.org/html/2511.03690v1), [OpenHands Platform Paper (ICLR 2025)](https://openreview.net/pdf/95990590797cff8b93c33af989ecf4ac58bde9bb.pdf)

### Semantic Kernel: Orchestration Patterns

**Model**: Pre-built orchestration patterns (Sequential, Concurrent, Handoff, Group Chat, Magentic).

Microsoft's Semantic Kernel provides multiple orchestration patterns as first-class abstractions, recently merging with AutoGen into the Microsoft Agent Framework.

Key concepts:
- **Sequential**: Pipeline where each agent passes output to the next.
- **Concurrent**: Multiple agents process the same input in parallel; results are aggregated.
- **Handoff**: Dynamic transfer of control between agents based on capability matching.
- **Group Chat**: AutoGen-style shared conversation (see above).
- **Magentic**: Research-originated pattern for complex multi-step reasoning.
- **A2A integration**: Native support for Google's Agent2Agent protocol for cross-framework communication.

**Relevance to agent-team**: The pattern taxonomy is useful for understanding different coordination modes. The Concurrent pattern (parallel agents, aggregated results) maps to broadcasting a task to a room and collecting responses. The Handoff pattern is relevant for escalation flows.

> Reference: [Semantic Kernel Agent Orchestration](https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-orchestration/), [SK Multi-Agent Orchestration Blog](https://devblogs.microsoft.com/semantic-kernel/semantic-kernel-multi-agent-orchestration/)

### Google A2A Protocol: Standardized Inter-Agent Communication

**Model**: JSON-RPC 2.0 over HTTP(S) with agent discovery, task delegation, and streaming.

Google's Agent2Agent (A2A) protocol, launched April 2025, provides a vendor-neutral standard for agent interoperability.

Key concepts:
- **Agent Card**: JSON metadata document describing identity, capabilities, skills, endpoint, and auth requirements.
- **Task lifecycle**: Create, monitor, and collect results from delegated tasks.
- **Three transport modes**: Synchronous request/response, streaming (SSE), and async push notifications.
- **Three-layer spec**: Protocol-agnostic data model (protobuf), behavioral specification, and protocol bindings (JSON-RPC, gRPC, REST).
- **Linux Foundation governance**: Vendor-neutral with 50+ technology partners.

**Relevance to agent-team**: A2A is designed for cross-organization agent communication but its patterns are instructive. The Agent Card concept (capability advertisement) could be used for room membership discovery. The three transport modes (sync, streaming, async push) map to different urgency levels. However, A2A is heavyweight for intra-team communication.

> Reference: [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/), [Google A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)

---

## Chat Room and Channel Patterns

### Slack-like Channels

**Model**: Named persistent channels with membership, history, and threading.

Key properties relevant to agents:
- **Named channels** with clear purpose (e.g., `#status-updates`, `#errors`, `#research-findings`)
- **Persistent history**: All messages are stored and searchable. New members can scroll back.
- **Threading**: Sub-conversations branch from main channel without cluttering it.
- **Mentions/notifications**: `@agent-name` for targeted attention within a room.
- **Channel types**: Public (all can see), private (invited only), DM (1:1).
- **Unread tracking**: Members see what is new since they last checked.

**Applicability**: High. Named rooms with persistent history and threading map directly to the agent-team use case. An agent could post to `#status` without consuming the lead's context, and the lead could poll `#status` when ready. Threading allows focused sub-conversations without polluting the main channel.

### IRC-Style Rooms

**Model**: Lightweight named rooms with join/part, operators, and modes.

Key properties:
- **Minimal overhead**: No threading, no rich formatting. Just messages with timestamps and authors.
- **Channel modes**: Moderated (only operators speak), quiet, invite-only.
- **PRIVMSG**: Direct messages alongside channel messages.
- **Topic**: Channel-level metadata describing current purpose.
- **Simplicity**: The entire protocol is text-based and trivial to implement.

**Applicability**: Medium-high. The simplicity is appealing for file-based implementation. A room is just a file. Messages are appended lines. The moderated mode concept is useful for restricting who can post to certain rooms.

### Matrix/Element Federation

**Model**: Decentralized event-sourced rooms with state resolution.

Key properties:
- **Event sourcing**: Every message, membership change, and state update is an event in a DAG (directed acyclic graph).
- **Room state**: Accumulated from all state events. Includes membership, power levels, room name, topic.
- **Power levels**: Fine-grained permissions (who can send messages, who can kick, who can change room state).
- **Federation**: Rooms span multiple servers. Events are replicated.
- **Sync API**: Efficient "catch up" for clients that have been offline.

**Applicability**: Medium. The event-sourcing model is highly relevant (aligns with OpenHands). The power levels concept maps to agent roles (orchestrator has higher power level). Federation is irrelevant for local agent teams but the sync/catch-up pattern is valuable.

### Discord Thread Model

**Model**: Main channels with spawnable threads for focused sub-conversations.

Key properties:
- **Threads branch from messages**: Any message in a channel can spawn a thread.
- **Auto-archive**: Threads auto-archive after inactivity, reducing noise.
- **Thread-specific notifications**: Members can follow specific threads without watching the whole channel.
- **Forum channels**: Structured threads where every top-level post is a thread (good for task tracking).

**Applicability**: Medium. The thread model is useful for task-specific conversations. An orchestrator could create a thread per task, and the assigned agent works within that thread. The auto-archive concept helps with cleanup. Forum channels map to task boards.

---

## Pub/Sub for Agents

### Topic-Based Messaging

Agents subscribe to topics they care about and publish events when they have something to share.

**Pattern**:
```
Agent publishes -> Topic -> Subscribed agents receive
```

**Examples of topics in an agent team**:
- `task.assigned.*` -- new task assignments
- `task.completed.*` -- task completion notifications
- `error.*` -- error events (high priority)
- `status.heartbeat` -- periodic status updates (low priority)
- `research.findings` -- research results
- `review.requested` -- code review requests

**Advantages over direct messaging**:
- Decoupled: Publisher does not need to know who is listening.
- Scalable: Adding a new agent that cares about errors just requires subscribing to `error.*`.
- Filterable: Agents only receive messages they subscribed to.

**Disadvantages**:
- No guaranteed ordering across topics.
- Fan-out can still overwhelm if an agent subscribes to many topics.
- Requires a broker or coordination layer.

### Event-Driven Patterns

Agents emit events as side effects of their work. Other agents react to events they care about.

**Pattern**:
```
Agent completes work -> Emits event -> Event bus -> Matching subscribers react
```

This is the model used by Semantic Kernel's Flows and OpenHands' event log. The key difference from direct messaging is that the emitter does not target a specific recipient -- it just declares what happened.

### Comparison: Direct vs Broadcast vs Pub/Sub

| Aspect | Direct Message | Broadcast | Pub/Sub |
|--------|---------------|-----------|---------|
| Targeting | Specific recipient | All agents | Subscribed agents |
| Coupling | High (sender knows receiver) | Medium (sender knows group) | Low (sender knows topic) |
| Context impact | Recipient only | All agents | Subscribed agents |
| Filtering | None needed | None possible | By subscription |
| Implementation | Simple | Simple | Moderate |
| Best for | Urgent/targeted | Announcements | Selective awareness |

**Recommendation for agent-team**: A hybrid model. Direct messages for urgent items that need context injection. Pub/sub for everything else, with agents polling their subscribed topics when they have capacity.

---

## User-as-Participant Pattern

### Current Problem

In Claude Code agent teams, every teammate message to the team lead gets injected as a conversation turn. This means:
- Each message consumes context tokens
- The lead cannot defer reading non-urgent messages
- There is no "unread" concept -- everything is immediately in context
- The user sees agent chatter mixed with their own conversation

### User as Room Member

Instead of the user being a direct message target, they become a member of rooms they choose to follow.

**Pattern**:
```
User joins: #overview, #errors, #decisions
User ignores: #status-heartbeat, #debug-logs, #research-raw
```

The user reads rooms at their own pace. Critical items can still trigger notifications (via a priority escalation mechanism) but the default is async consumption.

### Dashboard / Log Monitoring

Several frameworks support dashboard-like monitoring:
- **OpenHands**: WebSocket streaming of events to a web UI
- **AutoGen Studio**: Visual monitoring of group chat conversations
- **CrewAI Flows**: Event-driven state visualization

For agent-team, the equivalent would be:
- A log file per room that can be `tail -f`'d
- A summary dashboard (could be a tmux pane showing room activity)
- Priority alerts that break through to the user's attention

### Asynchronous Notification Models

| Model | How it works | Context impact |
|-------|-------------|----------------|
| **Immediate injection** (current) | Every message becomes a conversation turn | High -- all messages consume tokens |
| **Polling** | Agent/user reads room when ready | Zero -- messages stay in files until read |
| **Digest** | Periodic summary of room activity | Low -- one summary replaces many messages |
| **Priority escalation** | Only critical messages get injected | Low -- most messages stay in files |
| **Hybrid** | Priority items inject; everything else is digest/poll | Minimal -- best of both worlds |

---

## Context Token Optimization

### The Core Problem

As documented by JetBrains Research (NeurIPS 2025): "Agent-generated context actually quickly turns into noise instead of being useful information." Both managed strategies (observation masking and LLM summarization) cut costs by over 50% versus raw unmanaged context.

### Approach 1: Observation Masking

Replace older environment observations with placeholders while preserving reasoning and action history. In four of five test scenarios, this matched or exceeded LLM summarization performance while being cheaper.

**Applied to rooms**: Messages older than N turns could be masked (replaced with "[5 status messages from Agent X between 10:00-10:30]") rather than fully present in context.

### Approach 2: LLM Summarization

Use a separate model to compress interaction histories. However, JetBrains found that summaries may obscure stopping signals (causing agents to run 13-15% longer than necessary) and added 7%+ to total costs without proportional gains.

**Applied to rooms**: A summarizer agent could periodically compress room history into a digest. The digest replaces the raw messages in any agent's context. Original messages remain in the room file for reference.

### Approach 3: Selective Context Injection

From Google's context engineering guide: Context processing involves Selection (filtering irrelevant events), Transformation (flattening events into content objects), and Injection (writing formatted history into the LLM request).

**Applied to rooms**: A message router evaluates each room message and decides:
1. **Inject immediately**: Critical errors, user mentions, blocking questions
2. **Add to digest**: Status updates, progress reports, non-blocking findings
3. **File only**: Debug logs, heartbeats, verbose output

### Approach 4: Filesystem-Based Agent State

From the [Agentic Patterns catalog](https://agentic-patterns.com/patterns/filesystem-based-agent-state/):

Agents persist intermediate results and working state to files, creating durable checkpoints. The pattern uses a directory hierarchy: `state/` for checkpoints, `data/` for inputs/outputs, and `logs/` for execution records.

**Applied to rooms**: Each room is a directory containing:
- `messages.jsonl` -- append-only message log (the source of truth)
- `summary.md` -- latest digest/summary (regenerated periodically)
- `state.yaml` -- room metadata (members, topic, last-read pointers per agent)

### Approach 5: Agentic Service Bus

The [Agentic Service Bus](https://www.arionresearch.com/blog/the-agentic-service-bus-a-new-architecture-for-inter-agent-communication) concept proposes structured, machine-readable protocols between agents rather than natural language chat. This reduces token waste from "polite inter-agent dialogue," latency from natural language parsing, and ambiguity from interpretation variability.

**Applied to rooms**: Messages in rooms could be structured (JSON events with type, priority, sender, payload) rather than free-form text. Agents parse the structured data directly rather than interpreting natural language.

### The "Share Memory by Communicating" Principle

From Google's context engineering guide: "Share memory by communicating, don't communicate by sharing memory." Multi-agent systems fail due to context pollution when every sub-agent shares the same context, creating massive KV-cache penalties.

This principle directly supports the room model: agents communicate by posting to rooms (sharing memory through communication), rather than all sharing one massive context window (communicating through shared memory).

---

## Synthesis: Recommended Patterns for agent-team

Based on this research, the recommended messaging architecture for agent-team combines several patterns:

### Core Model: File-Backed Message Rooms

Each room is a directory on the filesystem:

```
.agent-team/rooms/
  #general/
    messages.jsonl      # append-only structured message log
    summary.md          # latest auto-generated digest
    room.yaml           # metadata: members, topic, read-cursors
  #errors/
    messages.jsonl
    summary.md
    room.yaml
  #status/
    messages.jsonl
    summary.md
    room.yaml
  @orchestrator/        # DM channel (@ prefix for DMs)
    messages.jsonl
    room.yaml
```

### Message Format

```json
{
  "id": "msg-uuid",
  "timestamp": "2026-02-17T10:30:00Z",
  "sender": "road-runner",
  "type": "status|error|question|result|heartbeat",
  "priority": "critical|normal|low",
  "room": "#status",
  "payload": "Research on topic X complete. See /path/to/report.md",
  "thread": null
}
```

### Priority-Tiered Injection

| Priority | Behavior |
|----------|----------|
| `critical` | Injected into lead's context immediately (as today) |
| `normal` | Added to room digest; lead polls when ready |
| `low` | File-only; never enters any agent's context unless explicitly read |

### Read Model

Agents interact with rooms via tools:
- `room.post(room, message)` -- append to room's message log
- `room.read(room, since=cursor)` -- read new messages since last read
- `room.digest(room)` -- get latest summary of room activity
- `room.subscribe(room, priority_filter)` -- configure which priority levels trigger injection

### Digest Generation

A background process (or the orchestrator on a timer) summarizes room activity:
- Runs every N messages or M minutes
- Produces a 2-5 line summary of activity since last digest
- Stored in `summary.md` for quick consumption
- Original messages always preserved in `messages.jsonl`

### Mapping to Current Claude Code Agent Teams

| Current behavior | Room-based alternative |
|-----------------|----------------------|
| Teammate sends message to lead | Teammate posts to room file |
| Message becomes conversation turn | Only critical messages become turns |
| Lead reads all messages in sequence | Lead polls rooms or reads digests |
| User sees agent chatter | User reads rooms they choose to follow |
| All messages consume context | Most messages stay in files |

### Implementation Path

1. **Phase 1**: File-based rooms with manual read/write (shell scripts or simple tools)
2. **Phase 2**: MCP server providing room tools (post, read, digest, subscribe)
3. **Phase 3**: Priority-based injection (critical messages auto-inject, others stay in files)
4. **Phase 4**: Auto-summarization of room activity (digest generation)

---

## Sources

### Multi-Agent Frameworks
- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Multi-Agent Workflows](https://blog.langchain.com/langgraph-multi-agent-workflows/)
- [LangGraph Multi-Agent Orchestration Guide 2025](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/langgraph-multi-agent-orchestration-complete-framework-guide-architecture-analysis-2025)
- [CrewAI Collaboration Docs](https://docs.crewai.com/en/concepts/collaboration)
- [CrewAI Hierarchical Delegation Guide](https://activewizards.com/blog/hierarchical-ai-agents-a-guide-to-crewai-delegation)
- [CrewAI Framework 2025 Review](https://latenode.com/blog/ai-frameworks-technical-infrastructure/crewai-framework/crewai-framework-2025-complete-review-of-the-open-source-multi-agent-ai-platform)
- [AutoGen Group Chat](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html)
- [AutoGen Conversation Patterns](https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns/)
- [AutoGen Selector Group Chat](https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/selector-group-chat.html)
- [OpenHands Software Agent SDK](https://arxiv.org/html/2511.03690v1)
- [OpenHands Platform Paper (ICLR 2025)](https://openreview.net/pdf/95990590797cff8b93c33af989ecf4ac58bde9bb.pdf)
- [Semantic Kernel Agent Orchestration](https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-orchestration/)
- [Semantic Kernel Multi-Agent Orchestration Blog](https://devblogs.microsoft.com/semantic-kernel/semantic-kernel-multi-agent-orchestration/)
- [Microsoft Agent Framework (SK + AutoGen)](https://visualstudiomagazine.com/articles/2025/10/01/semantic-kernel-autogen--open-source-microsoft-agent-framework.aspx)

### Protocols
- [Google A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [Google A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [A2A Protocol Upgrade (v0.3)](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade)
- [A2A at Linux Foundation](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
- [Survey of Agent Interoperability Protocols (MCP, ACP, A2A, ANP)](https://arxiv.org/html/2505.02279v2)
- [AWS: Open Protocols for Agent Interoperability on MCP](https://aws.amazon.com/blogs/opensource/open-protocols-for-agent-interoperability-part-1-inter-agent-communication-on-mcp/)

### Context Optimization
- [JetBrains Research: Efficient Context Management (NeurIPS 2025)](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- [Google: Architecting Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
- [Airbyte: 5 AI Context Window Optimization Techniques](https://airbyte.com/agentic-data/ai-context-window-optimization-techniques)
- [Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [Context Engineering for AI Agents](https://www.philschmid.de/context-engineering-part-2)
- [Fractal: Five-Layer Context Architecture](https://fractal.ai/blog/five-layer-architecture-llms)

### Architectural Patterns
- [Filesystem-Based Agent State Pattern](https://agentic-patterns.com/patterns/filesystem-based-agent-state/)
- [The Agentic Service Bus](https://www.arionresearch.com/blog/the-agentic-service-bus-a-new-architecture-for-inter-agent-communication)

---

## Limitations

- **No direct benchmarks**: No framework has published benchmarks comparing room-based vs direct messaging for context token savings in LLM agent systems.
- **Implementation gap**: The file-backed room model is a synthesis of patterns, not a proven implementation. The closest existing implementations are OpenHands' event log and the filesystem-based agent state pattern.
- **Claude Code constraints**: The recommended architecture assumes agents can read/write shared files and that a coordination layer can selectively inject messages. This requires either MCP tools or shell-based tooling that agents can invoke.
- **Summarization quality**: The JetBrains research suggests LLM summarization can hurt performance by obscuring signals. Digest generation would need careful tuning.
- **Concurrency**: Multiple agents writing to the same JSONL file needs append-locking or similar coordination. Not researched in depth here.
