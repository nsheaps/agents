# PRD: Web Session Orchestration

**Status**: Draft
**Date**: 2026-02-16

## Summary

Extends the agent communication protocol and controller orchestrator to launch and manage Claude Code web sessions. The controller orchestrator can create, continue, and coordinate web-based agent sessions alongside local ones. Session continuity is a first-class concern, including remote sessions, teleporting between local and web, and manual save/restore of session state.

## Architecture

```
┌─────────────────────┐
│ Controller          │
│ Orchestrator        │
└──────────┬──────────┘
           │
     ┌─────┼──────────┐
     ▼     ▼          ▼
   ┌───┐ ┌───┐   ┌────────┐
   │CLI│ │CLI│   │  Web   │
   │ A │ │ B │   │Session │
   └───┘ └───┘   └────────┘
                  (claude.ai)
```

The controller communicates with web sessions using the same MCP/websocket protocol used for local agents. The MCP server runs within the web session environment and connects back to the controller.

## Capabilities

### Launch Web Sessions

The controller orchestrator can:

- Create new Claude Code web sessions via API
- Attach an MCP server to the web session for communication
- Assign tasks to web sessions the same way it assigns to local agents
- Monitor web session status and output

### Continue Sessions

Session continuity is critical. The system supports:

- **Resume**: Reconnect to an existing web session by session ID and continue where it left off
- **Remote sessions**: Sessions that run independently on claude.ai infrastructure, accessible from any client
- **Teleporting**: Move a session between local CLI and web, or between machines, preserving full conversation context

### Save and Restore

For cases where automatic continuity is insufficient:

- **Save**: Export session state (conversation history, working files, environment context) to a portable format
- **Restore**: Import a saved session into a new local or web session to continue work
- **Manual checkpoint**: Agent or controller can trigger a save at any point as a checkpoint

## Session Lifecycle

```
create → attach MCP → assign task → monitor → (pause/resume/teleport) → complete
```

| State     | Description                                              |
| :-------- | :------------------------------------------------------- |
| Created   | Web session exists but no MCP connection yet             |
| Connected | MCP server attached, controller can communicate          |
| Active    | Agent is processing a task                               |
| Paused    | Session is idle, can be resumed                          |
| Saved     | Session state exported to file, can be restored anywhere |
| Completed | Task finished, session can be terminated or reused       |

## Integration with Abstraction Levels

Web sessions can be used at any abstraction level that involves separate processes:

- **Level 2 (tmux)**: A web session replaces a local tmux session
- **Level 3 (controller)**: The controller launches web sessions alongside local agents
- **Level 4 (hierarchical)**: An agent-controller can spawn web sub-sessions for its tasks

## Open Questions

1. **API access**: What API is used to create and manage Claude Code web sessions programmatically?
2. **MCP in web**: How does the MCP server run within a web session? Is it a browser extension, a sidecar process on the web infra, or injected via session configuration?
3. **Teleport mechanism**: What is the concrete mechanism for teleporting a session between local and web? Is it a full state export/import, or does it use a shared session backend?
4. **Session limits**: Are there limits on concurrent web sessions per account?
5. **State format**: What format is used for saved session state, and what does it include (conversation, files, env vars, tool state)?
6. **Authentication**: How does the controller authenticate to create and manage web sessions?
