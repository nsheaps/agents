# PRD: Agent Communication Protocol

**Status**: Draft
**Date**: 2026-02-16

## Summary

A communication protocol where each agent runs an MCP server that connects to a central orchestration controller. The controller receives webhooks from external sources and forwards messages to agents over websocket connections. Agents receive messages via a local queue that a hook injects into the active conversation.

## Architecture

```
                    ┌──────────────┐
                    │   External   │
                    │   Sources    │
                    └──────┬───────┘
                           │ webhooks
                           ▼
                  ┌─────────────────┐
                  │  Orchestration  │
                  │   Controller    │
                  └────────┬────────┘
                           │ websocket
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ MCP      │ │ MCP      │ │ MCP      │
        │ Server A │ │ Server B │ │ Server C │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │             │             │
        ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐
        │ Message  │ │ Message  │ │ Message  │
        │ Queue    │ │ Queue    │ │ Queue    │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │ hook        │ hook        │ hook
        ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐
        │ Agent    │ │ Agent    │ │ Agent    │
        │ Session  │ │ Session  │ │ Session  │
        └──────────┘ └──────────┘ └──────────┘
```

## Components

### MCP Server (per agent)

Each agent session runs a local MCP server. The MCP server:

- Establishes a websocket connection to the orchestration controller on startup
- Maintains a local message queue for inbound messages
- Exposes tools for the agent to send messages outbound
- Works in both JSON mode (`--output-format json`) and interactive mode

### Orchestration Controller

A central process that:

- Accepts websocket connections from agent MCP servers
- Receives webhooks from external sources (other systems, user interfaces, CI, etc.)
- Routes messages to the correct agent session(s) based on addressing
- Tracks connected agents and their session state

### Message Queue

Each MCP server maintains a local queue:

- Inbound messages from the controller are placed into the queue
- A hook reads the queue and injects messages into the agent conversation
- Ensures messages are not lost if the agent is mid-turn
- Preserves message ordering

### Hook Injection

A Claude Code hook that:

- Fires on a defined trigger (e.g., `prompt_submit`, periodic, or tool-based)
- Checks the local message queue for pending messages
- Injects pending messages into the conversation context
- Works identically in JSON mode and interactive mode

## Message Flow

1. External source sends a webhook to the orchestration controller
2. Controller identifies the target agent(s)
3. Controller forwards the message over the websocket to the agent's MCP server
4. MCP server places the message into its local queue
5. Hook fires and injects the queued message into the agent's conversation
6. Agent processes the message and may respond via the MCP server's outbound tools
7. MCP server sends the response over the websocket to the controller
8. Controller routes the response to the appropriate destination

## Modes of Operation

| Mode        | How It Works                                                                  |
| :---------- | :---------------------------------------------------------------------------- |
| Interactive | Agent runs with a terminal UI. Hook injects messages into the conversation.   |
| JSON        | Agent runs headless with `--output-format json`. Same hook injection applies. |

Both modes use the same MCP server, message queue, and hook mechanism. The only difference is how the agent session is started and how output is rendered.

## Open Questions

1. **Webhook authentication**: How are inbound webhooks authenticated to the controller?
2. **Message addressing**: What addressing scheme is used to route messages to specific agents?
3. **Queue persistence**: Should the message queue survive agent restarts, or is it ephemeral?
4. **Hook trigger**: What is the optimal hook trigger for message injection without adding latency?
5. **MCP server discovery**: How does the controller discover agent MCP servers, or do agents register on connect?
