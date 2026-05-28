---
type: feature
id: GSD-40
legacy_ids:
  - "1779754572"
created: 2026-05-26T00:16:12Z
state: triage
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-611"
    note: "#611: AGENT(triager-v2): Process to-triage chronologically per new spec (14 items)"
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508624607509217391
events:
  - { ts: 2026-05-26T00:16:12Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-40 (state=triage) per triager-v2 workflow",
    }
---

# Dummy browser dashboard (agent-mcp-service → agent-controller)

## Original ask

> lets also make a triage ticket p3 to make a dummy browser, in agent-utils plugin, use agent-mcp-service and have that run a simple webserver that shows you all the tasks and their states in a simple ui with a websocket that forwards events so the page can update dynamically as the agent changes things. For things to update dynamically, the updates should be done through tools so the tool call can emit an event. Consider having a socket file for plugins to emit events to, that the server reads from to push out to other consumers. One big graph pub/sub spagetti eventually.
>
> While this is going to be done in agent-mcp-service right now, later it will be a part of agent-controller to be the eventbus for all things agent. Tasks can continue to write to that socket, but agent-controller is instead the listener and propagator and webserver. The mcp server should just be an interface for channel messages (from agent-controller, again as the event bus), and tools for the agent to interact with the system around it.
>
> I wanna do that before m11 so maybe the ticket is a p2 and the stuff before m11 is a p1, and the bugs I'm telling you to do right now are p0s

Source: Discord msg[^discord-ask] (2026-05-26 00:15Z). Initial P3, revised to **P2** in same message (needs to land before M11).

## Goal

Build a dashboard that shows the agent's live task list + state, with a WebSocket that pushes events as the agent changes things. Use the existing `agent-mcp-service` now; eventually migrate to a future `agent-controller` event-bus daemon.

## Topics to capture during triage

1. **agent-utils plugin scope** — where in the existing plugin (apps/? packages/? new subfolder?) does the webserver + websocket live?
2. **agent-mcp-service usage** — research what `agent-mcp-service` exposes today (tools? channel messages?) and confirm it's the right host for this dashboard.
3. **Socket file pub/sub** — proposed pattern: plugins write events to a unix socket; the dashboard server reads from it and broadcasts to WebSocket clients. Triage agent should validate this design or propose alternatives (e.g. Redis pub/sub, named pipe, in-process channel).
4. **Tool-emits-event contract** — every TaskCreate/TaskUpdate (and similar) emits an event. Where does that hook live? PostToolUse hook on Task\* matchers? Inside the task-utils plugin? Both?
5. **Dashboard UI** — simple HTML+JS, no framework needed. Shows: task ID, subject, status, owner, blockedBy chain. Updates live.
6. **Future migration path** — once `agent-controller` exists as the canonical event-bus daemon:
   - Tasks still write to the socket.
   - `agent-controller` becomes the listener+propagator+webserver.
   - `agent-mcp-service` reduces to: (a) interface for channel messages (from agent-controller), (b) tools for the agent to interact with the system around it.
   - Plan the cut-over so the dashboard moves cleanly.

## Priority

**P2** (revised from initial P3 in same Discord message). Rationale: wants before M11, but not blocking the P0 bugs (force-bg hook, mantra, chain-count hook).

## Suggested milestone

Pre-M11 (per Nate's "wanna do that before m11"). Triage grooming picks the specific milestone.

## Acceptance criteria

- A simple webserver in the agent-utils plugin serves a task dashboard at localhost.
- The dashboard shows task ID, subject, status, owner, blockedBy chain for all tasks.
- A WebSocket connection pushes state-change events as TaskCreate/TaskUpdate fires.
- Events flow through a unix socket file that any plugin can write to.
- Migration plan for agent-controller documented in the ticket.

## Notes

- This ticket exists because skill/rule guidance was demonstrably insufficient: the "socket file pub/sub" pattern itself may warrant a separate design research ticket BEFORE the dashboard is built.
- Cross-link with GSD-39 (deep research: agent primitives) — the dashboard surfaces some of the agent-team primitives that research will cover.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508624607509217391
