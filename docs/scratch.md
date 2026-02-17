- need a way to monitor usage, per team, per agent, attributed per task, attributed per task across agents, monitoring usage limits
- Potentially need a way to swap auth or use a mechanism to shove claude to different LLM providers for cost optimization
- use mcp server as a mechanism (via a dummy mcp server with stdio, but then running something else) to run services on remote agent executions on claude code web, maybe something like a metrics exporter, or a mechanism for startup and shutdown to involve saving and restoring the cache of the sessions
- Use todos and the start stop to break up conversations in files to make them more searchable
- We need to extract my customizations of the settings.json in user configs into plugins that ensure those configs are all merged into settings.local.json. Does this file need to be cleared on each startup before merging to prevent stale stuff? not sure
- Agents need to be able to be launched in different folders. Sessions are very folder specific
  - Should sessions for communicating with others and managing actual task execution be separate from the ones doing tasks? Should working on tasks be sub agents? Agent teams with in-process? their own remote agent teams?
- need business-consult agent for helping create llc
- need marketing agent for marketing strategy and execution
- different configs for agents
  - One for local, maybe with just swe and qa
  - One for cloud for persistent agents
    - It's time. Take on openclaw
- team-lead is orchestrator
  - Team lead can read all agent convos, including inter agent convo
- agent-controller (other tool?) is a program, not agent, that is responsible for actual launch/termination/communication between agents/task tracking/cache save and restore
  - MCP cache save at end of session should be continuous throught session
- agent-dashboard is the web UI component of it all
  - Shows live token tracking per agent, via adding up token use in session jsonl files
  - Needs method to chat with agents, separate from their thought stream (another mcp tool) so thoughts don't crowd the user conversation
    - Mechanisms for communicating with other users, like slack, or matrix chat... another cli tool/mcp server? perhaps agent-contact, that lets agents built up their own contact book (synced to ... google contacts? google sheet?) including different ways of contacting the same person, things they can do to authenticate the authenticity of that person on different platforms, etc.
    - maybe also a sub agent?
      - Or both, sub agent via claude-agent-sdk, and tool for use in other agent cli's
  - take note of braintrust.dev interface with conversation tracing, we're basically building that too. So also look at otel tracing.
- we also want metrics for our stuff too, both usage metrics for us of the app itself, and org metrics for our customers.
- We need to think about monetization, maybe of this product maybe not, but need to make enough money to cover the AI costs. 
- use tilt/ctlptl/kind for testing
- need different runtime modes, like separate processes, docker containers orchestrated by a process, or orch by a controller in docker, docker compose, k8s, etc.
  - everything needs to support multiple agents running on the same computer, including separate secrets stores for each agent, but the suggested/happy path is an agent in a container for safety and performance reason.s
- Agents need a way to terminate themselves, restart themselves (communicate with controller > ipc to wrapper, kill and resume session), and schedule themselves to run later, or to run on certain events (events...webhooks?)
- Probably need to think of where to actually run this... on the cloud?
- while agents _can_ message each other through the agent-team system, the default mechanism should be the org preference for text based communication, such as slack or matrix, with preferences on rooms, threads, etc (llm evaluated). The default local setup is them messaging each other but the web UI lets you message them, and they're also actually just running in tmux so the dashboard guides you through connecting to them (or provides a web based tty interface to them, like tty-share?)
- Prefer yaml over json. Perhaps perfer some form of yamll? for jsonl? See if toon fits in anywhere. Human readability, and comments, are key for comprehension by agents and humans alike. Don't convert, just prefer within the app (but support the basic alternatives for interoperability)
- Agent-team needs a **persistent task tracking system** separate from both:
  1. **Claude Code TaskCreate** (ephemeral, dies with the session/team)
  2. **Project tickets in docs/tickets/** (project planning, long-lived, git-tracked)
  - This third layer is **operational task tracking** — tasks assigned to agents that survive agent stop/start cycles
  - When an agent is killed and relaunched, it should be able to pick up where it left off
  - The controller/launcher should own this state, not the individual agent sessions
  - Could be file-based (YAML in a known location), database-backed, or managed by the agent-controller process
  - Must support: assignment, status, dependencies, context/notes per task
  - Think of it like a persistent work queue that outlives any single agent session
- Context length / conversation bloat is a serious operational concern with multi-agent teams
  - 8 agents all running concurrently causes rapid context accumulation on the lead
  - Every teammate message, idle notification, and system event adds to lead's context
  - Hit rate limits in this session partly due to volume
  - Mitigations to design for:
    1. Shorter agent lifespans — spin up for specific tasks, shut down when done
    2. Fewer concurrent agents — 3-4 active at a time instead of 8
    3. Sub-agent delegation within teammates — use haiku sub-agents for research/exploration
    4. Compaction awareness — teammates should write important state to files before context fills
    5. Lead context management — summarize teammate messages rather than accumulating raw DMs
    6. Context budget as first-class launcher concern — agents should know their budget and manage it
  - This should inform the agent lifecycle management design in the launcher
- Research https://ccs.kaitran.ca/ — potential Claude Code related tooling
- Research https://github.com/kivo360/OmoiOS — potential relevant patterns

---

## Pending Tasks (preserved from looney-tunes session, 2026-02-17)

### Must Do (next session)
- **#116**: QA full agent lifecycle test (launch → kill → relaunch) — Phase 1 code-complete, needs validation
- **#127**: Document agent creation collaboration workflow (ai-agent-eng + security-consult + ops-eng)
- orchestrator.md duplicate model key — fixed by Tweety (commit aaeb46b), verify it's clean

### Research (assign to Road Runner)
- **#133**: Navigable TUI for agent pane management (tmux + AppleScript + Linux automation)
- **#135**: Web UI for agent team monitoring (happy.engineering style dashboard)
- **#136**: Optimal model selection per agent role (Wile E. delivered initial doc at docs/research/model-selection-per-role.md)
- **#138**: Research ccs.kaitran.ca
- **#139**: Research OmoiOS (github.com/kivo360/OmoiOS)

### Backlog
- **#122**: Consider splitting conversation-search behavior reference material
- **#123**: Add prettier pre-commit hook or CI check to agent-team repo
- **#131**: Research ticket automation (todo-sync style) for agent-team project
- **#9**: Stop all teammates for user review (completed manually this session, can be closed)

### Architecture Doc Fixes (assign to Tweety)
- Add MVP boundary divider to agent-team-architecture.md
- Fix I/O proxy duplication (arch doc = source of truth, remove from other locations)
- Add three agent YAML formats disambiguation table (frontmatter vs agent.yaml vs config.json)
