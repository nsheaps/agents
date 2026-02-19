- need a way to monitor usage, per team, per agent, attributed per task, attributed per task across agents, monitoring usage limits
- Potentially need a way to swap auth or use a mechanism to shove claude to different LLM providers for cost optimization
- use mcp server as a mechanism (via a dummy mcp server with stdio, but then running something else) to run services on remote agent executions on claude code web, maybe something like a metrics exporter, or a mechanism for startup and shutdown to involve saving and restoring the cache of the sessions
- Use todos and the start stop to break up conversations in files to make them more searchable
- We need to extract my customizations of the settings.json in user configs into plugins that ensure those configs are all merged into settings.local.json. Does this file need to be cleared on each startup before merging to prevent stale stuff? not sure
- Agents need to be able to be launched in different folders. Sessions are very folder specific
  - Should sessions for communicating with others and managing actual task execution be separate from the ones doing tasks? Should working on tasks be sub agents? Agent teams with in-process? their own remote agent teams?
- need business-consult agent for helping create llc
- need marketing agent for marketing strategy and execution
- K8s mode:
  - use config maps for files like settings per agent, let security-consult edit file from mounted config map and sync at runtime to the agent.
    - confirm agent got updates via hash monitoring of file, report back to security-consult
- Security
  - Don't let agents modify their own config files, that would potentially enable them to grant permissions to tools they shouldn't have.
  - 
- different configs for agents
  - One for local, maybe with just swe and qa
  - One for cloud for persistent agents
    - It's time. Take on openclaw
- team-lead is orchestrator
  - Team lead can read all agent convos, including inter agent convo
- need to make sure mcp tools allow agents to use abstraction to manage infra AND agent (eg agent gets stuck, use mcp tool to kill tmux pane, or container if k8s mode)
- not all agent roles are created equal. Some can run on sonnet normally, some should run on opus normally.
  - Some should delegate to smarter "more senior" teammates
  - Some should use structural thinking to help
  - Some should use local background agents with a different model to help them perform complex tasks with a less intelligent model
- Consider teammates and their ability or allow permissions for (or gate based on settings) running tasks:
  - In a local background agent (which cannot be interacted with during implementation) aka Task
  - To an in-process sub-agent (claude team, ephemeral vs persistent?)
  - To a remote sub-agent (claude-team, but in tmux/k8s mode)
  - To a separate teammate (not controlled by agent, just asking another teammate to help)
- teammate mode needs a better abstraction than what claude provides (auto/tmux)
  - We need things like limiting agents to only running background agents, or only in-process agents, or only tmux or remote agents.
  - This likely starts getting towards an overarching permissions system bigger than just security-consult.
- ai-agent-eng should be checking claude code change log, anthropic blog, related claude repos every day to factor in the latest recommendations. Keep a full copy of https://claude.md to compare for changes. Use cchistory to understand differences in the claude cli
- Can we make a plugin that's hooks inject messages into the conversation from a file? This would be a way to have a "user message" that isn't actually typed by the user, but is instead written to a file by some other process (like an MCP server receiving messages from slack or something). The hook would read new messages from the file and inject them into the conversation as if they were user messages. This could be a way to integrate external communication channels into the agent conversation without needing the agent to poll those channels directly.
  - The same hook could then review jsonl's to send to a remote server.
  - And maybe a stop hook that forces idle without llm until timeout then shutdown?
    - If shutdown like claude code web, on restart do we resume session? Maybe situation dependent.
    - Start convo by launching agent, and using tmux to write to stdin?
  - Allows agent cli to be in interactive mode but for us to still get json output.
- in this particular orgnaization, ai-agent-eng should also be tracking changes in nsheaps/.ai Many of those changes overlap with goals here and vice versa and we should be working in lock step, not duplicating effort
- agent-controller (other tool?) is a program, not agent, that is responsible for actual launch/termination/communication between agents/task tracking/cache save and restore
  - MCP cache save at end of session should be continuous throught session
- agent-dashboard is the web UI component of it all
  - Shows live token tracking per agent, via adding up token use in session jsonl files
  - Needs method to chat with agents, separate from their thought stream (another mcp tool) so thoughts don't crowd the user conversation
    - Mechanisms for communicating with other users, like slack, or matrix chat... another cli tool/mcp server? perhaps agent-contact, that lets agents built up their own contact book (synced to ... google contacts? google sheet?) including different ways of contacting the same person, things they can do to authenticate the authenticity of that person on different platforms, etc.
    - maybe also a sub agent?
      - Or both, sub agent via claude-agent-sdk, and tool for use in other agent cli's
  - take note of braintrust.dev interface with conversation tracing, we're basically building that too. So also look at otel tracing.
  - Should make it trivially easy for users to click files produced by agents and view them in-browser with proper formatting (markdown rendered, YAML/JSON syntax highlighted, etc.)
    - Later: in-browser editing with notification to the document owner (the agent that produced the file), so the agent can react to manual changes
    - Think Google Docs-style collaboration but between humans and agents
- we also want metrics for our stuff too, both usage metrics for us of the app itself, and org metrics for our customers.
- We need to think about monetization, maybe of this product maybe not, but need to make enough money to cover the AI costs.
- use tilt/ctlptl/kind for testing
- need different runtime modes, like separate processes, docker containers orchestrated by a process, or orch by a controller in docker, docker compose, k8s, etc.
  - everything needs to support multiple agents running on the same computer, including separate secrets stores for each agent, but the suggested/happy path is an agent in a container for safety and performance reason.s
- Agents need a way to terminate themselves, restart themselves (communicate with controller > ipc to wrapper, kill and resume session), and schedule themselves to run later, or to run on certain events (events...webhooks?)
  - **Self-exit and relaunch with new configs**: The "agent" CLI wrapper should support an agent requesting its own restart with updated configuration. The wrapper process stays alive while the inner claude session terminates and relaunches. Enables dynamic config changes (model swap, tool changes, permission changes) without team lead intervention. Check if any PRDs already call this out — if not, add to agent-team architecture spec.
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
- **Claude Code project isolation vs agent teams**: Claude treats each folder as a separate project, including sibling worktree folders. This creates several challenges:
  - **Conversation history silos**: agents running in different folders have separate conversation histories, even if they're the same git repo (worktrees). Searching history across projects requires awareness of this.
  - **`--additionalDirectories`**: the launcher must manage this flag so agents can access files across repos/worktrees without being siloed to one folder
  - **Directory access security concern**: agents with `additionalDirectories` can `cd` into that dir and stay there, but if they can't (non-bypass mode), they'd need `cd /path && command` which chains commands and bypasses granular permission approval. This is a security hole.
    - In non-bypassPermissions mode, agents should NOT be allowed to `cd /other/dir && do-something` — this sidesteps permission gating
    - Instead, agents should request directory access from security-consult (when it exists), who can grant/deny per-directory access
    - **Plugin idea**: a PreToolUse hook that denies `cd ... && ...` patterns in Bash with an error message directing the agent to request directory access properly
    - Short term: agents should use absolute paths rather than cd-chaining
    - Long term: security-consult manages a directory access allowlist per agent
  - **`~/.claude.json` / `githubRepoPaths`**: needs to include worktree paths so Claude recognizes them as the same repo. Currently `~/.claude.json` is symlinked from `~/.claude/home-claude.json`.
  - **Plugin opportunity for nsheaps/ai**: Turn `~/.claude.json` management into a plugin that:
    - Auto-discovers worktrees for configured repos and adds them to `githubRepoPaths`
    - Manages `additionalDirectories` settings
    - Keeps the config in sync as worktrees are created/deleted
    - Currently manual config work — should be automated
  - **Agent conversation history search**: agents must be trained to search conversation history across project boundaries, not just their own project folder. The `conversation-search` behavior needs to account for this — search `~/.claude/projects/` broadly, not just the current project subfolder.
  - **Ephemeral agent instances**: agents launched in temporary/container workspaces will have fresh project context. The launcher needs to either:
    1. Pre-populate `~/.claude/projects/<hash>/` with relevant history from prior sessions
    2. Or give agents access to a shared history store (relates to session save/restore in architecture doc §5)
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
- **Agent teams launch requirement**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` env var alone is NOT enough. You ALSO need `--permission-mode=delegate` even when using `--dangerously-skip-permissions`. Without delegate mode, the lead doesn't get the TeamCreate/SendMessage/TaskCreate primitives. Both are required together.
- **Tracing / observability**: Each agent on the same machine inherits user-level configs (~/.claude/settings.json, env vars). This means OTEL tracing should "just work" if the right env vars are set at the user level.
  - Research Braintrust (braintrust.dev) integration — they have conversation tracing UI we'd essentially be rebuilding
  - Research which OTEL env vars can differentiate agents from each other and tasks from each other (e.g., OTEL_SERVICE_NAME, OTEL_RESOURCE_ATTRIBUTES)
  - The launcher should set per-agent env vars (agent name, role, team name) as OTEL resource attributes so traces are attributable
  - This ties into the agent-dashboard / web UI vision — traces feed the monitoring dashboard
  - See also scratch.md line 24 re: braintrust.dev interface with conversation tracing
- Research https://ccs.kaitran.ca/ — potential Claude Code related tooling
- Research https://github.com/kivo360/OmoiOS — potential relevant patterns
- **Event source polling plugin (PRD needed)**: A Claude Code plugin that uses async background hooks to poll external event sources (GitHub notifications, Slack mentions, CI status changes, Linear updates, etc.) and write updates to disk. Then SessionStart/PostToolUse/Stop hooks inject accumulated events into the conversation.
  - Similar to the agent-team I/O proxy concept for injecting user messages, but for polled events rather than pushed (webhooks)
  - Webhook-pushed events would go through the controller and get similarly propagated to disk → hooks → conversation
  - Think of it as an agent "inbox" that accumulates between tool calls and gets flushed into context on each hook trigger
  - Polling frequency, event sources, and filtering rules should be configurable per-agent or per-team
  - Could also serve as the mechanism for inter-agent event notification (agent A completes task → event written to disk → agent B picks it up on next hook)
  - PRD should live at `docs/specs/draft/event-source-plugin.md` when written
- **MCP server: shell-scripts-as-tools**: An MCP server (stdio) that exposes shell scripts from a directory as MCP tools. Each script becomes a callable tool with proper input schemas derived from the script's arguments/flags. This could replace Claude's built-in delegate mode spawn mechanism with custom launch logic (e.g., custom agent spawning that goes through our wrapper instead of bare `claude` binary). Should be a plugin in nsheaps/.ai.
  - Scripts define their tool schema via a companion YAML/JSON file or inline comments
  - Supports both stdio and HTTP transport
  - Could also expose non-Claude shell tooling (docker, kubectl, etc.) as MCP tools
- **MCP server: structured-docs-as-tools**: An MCP server that exposes org-wide rules and documentation as MCP tools with important content in the description field (surviving Claude's deferred tool loading/search), plus MCP resource URIs for fetching full document content on demand. Filesystem location doesn't matter — docs are served via MCP.
  - Tool descriptions contain the critical rules that must always be visible
  - Resource URIs let Claude fetch full docs when needed
  - Decouples documentation from filesystem layout
  - Could serve as the canonical source for org-wide rules that currently live in .claude/rules/

- **Orchestrator permissions leak**: Teammates need bypass permissions to work autonomously, but the orchestrator must also be in bypass mode, which lets it do things it shouldn't (launch sub-agents, run bash, edit files). The orchestrator should be restricted to coordination tools only (SendMessage, TaskCreate/Update/List, TeamCreate/Delete). Potential fix: PreToolUse hooks that block non-coordination tools on the lead session.
  - This is a security/isolation concern — the lead can currently modify files, run commands, and take actions outside its coordination role
  - Hook-based approach: a PreToolUse hook on the lead session that returns exit code 2 (block + feedback) for tools like Bash, Edit, Write, etc.
  - Alternative: a dedicated `orchestrator` permission mode that only exposes team coordination primitives
  - Related to delegate mode bug [#25037](https://github.com/anthropics/claude-code/issues/25037) — both are about permission boundaries in multi-agent setups

---

## Pending Tasks (updated 2026-02-18, looney-tunes session 3)

### In Progress

(none currently)

### Pending

- **#140**: Research Braintrust + OTEL env vars for agent/task tracing differentiation

### Research (unassigned)

- Navigable TUI for agent pane management (tmux + AppleScript + Linux automation)
- Web UI for agent team monitoring (happy.engineering style dashboard)
- Optimal model selection per agent role (initial doc at `docs/research/model-selection-per-role.md`)
- Research https://ccs.kaitran.ca/
- Research OmoiOS (github.com/kivo360/OmoiOS)

### Backlog

- Consider splitting conversation-search behavior reference material
- Add prettier pre-commit hook or CI check to agent-team repo
- Research ticket automation (todo-sync style) for agent-team project

### Completed (prior sessions)

- **#116**: QA full agent lifecycle test — done (Daffy)
- **#127**: Document agent creation collaboration workflow — done (Tweety)
- **#128**: Architecture doc structural fixes (MVP boundary, I/O proxy dedup, YAML formats table) — done (Tweety, `29652c6`)
- **#141**: Fix DEF-1 — `--dry-run` truncates CLI args at 80 chars — done (Bugs, `51d0f16`)
- **#142**: Fix DEF-2 — `agentFilter` positional arg parsing is fragile — done (Bugs, `3962e7b`)
- **#143**: Fix DEF-3 — ambiguous duplicate agent name error — done (Bugs, `1fd5ac1`)
- **#144**: Add standing responsibilities to ai-agent-eng agent file — done (Tweety, `407bbc7`)
- **#145**: Update display_name format across all agent files — done (Tweety)
