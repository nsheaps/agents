# tmux Orchestration Tools: Agent Platform Research Report

**Source**: GitHub repositories, community documentation, blog posts
**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #44 (Orchestration Platforms Survey)

---

## 1. What It Is

tmux has emerged as the **de facto standard** for orchestrating multiple concurrent AI agent sessions. The ecosystem includes 10+ specialized projects that wrap tmux to manage agent lifecycle, plus Claude Code's native Agent Teams feature.

Three distinct architecture patterns have emerged:

| Pattern                         | Tools                                    | Description                                               |
| :------------------------------ | :--------------------------------------- | :-------------------------------------------------------- |
| **Named Session Orchestration** | NTM, Agent of Empires, Tmux Orchestrator | Named panes within a tmux session, programmatic targeting |
| **Web Dashboard + Kanban**      | Agent Viewer, KanVibe                    | Browser UI with embedded/detached tmux backend            |
| **IDE as Control Plane**        | tmux-agents                              | VS Code sidebar managing tmux panes                       |

## 2. Architecture and Design Patterns

### Pattern A: Named Session Orchestration

```
Session: "project_name"
├── Pane: project_name__cc_1 (Claude Code Agent 1)
├── Pane: project_name__cc_2 (Claude Code Agent 2)
├── Pane: project_name__cod_1 (Codex Agent 1)
├── Pane: project_name__gmi_1 (Gemini Agent 1)
└── Pane: project_name__user (User control pane)
```

**Named Tmux Manager (NTM)** — Go CLI with command palette TUI

- Repo: [github.com/Dicklesworthstone/ntm](https://github.com/Dicklesworthstone/ntm)
- Spawn: `ntm spawn myproject --cc=4 --cod=2 --gmi=1`
- Broadcast: `ntm send myproject --cc "please review this code"`
- Token velocity badges (real-time tokens/second per agent)
- Safety guards to prevent dangerous commands

**Agent of Empires** — Rust-based terminal session manager

- Repo: [github.com/njbrake/agent-of-empires](https://github.com/njbrake/agent-of-empires)
- Visual dashboard with status detection
- Git worktree integration for branch isolation
- Optional Docker sandboxing
- Built-in git workflow coordination

### Pattern B: Web Dashboard with Kanban Board

```
Web UI (Browser)
  ├── Kanban Board (Running/Idle/Completed columns)
  ├── Terminal Sessions (embedded/detached)
  └── Message Queue (SSE-driven updates)
    └── tmux Backend
```

**Agent Viewer** — SSE-driven Kanban board

- Repo: [github.com/hallucinogen/agent-viewer](https://github.com/hallucinogen/agent-viewer)
- Spawns agents via `tmux new-session`, captures via `tmux capture-pane`, sends via `tmux send-keys`
- Uses Claude Haiku for label generation (async, non-blocking)
- Two-file architecture: server.js + single-file HTML frontend

**KanVibe** — Self-hosted Kanban with browser terminals

- Repo: [github.com/rookedsysc/kanvibe](https://github.com/rookedsysc/kanvibe)
- Hook-driven auto-tracking of tmux/zellij sessions
- Git worktree integration

### Pattern C: VS Code as Control Plane

**tmux-agents** — VS Code sidebar extension

- Repo: [github.com/super-agent-ai/tmux-agents](https://github.com/super-agent-ai/tmux-agents)
- Tree view, Kanban board view, and AI chat interface
- Each agent runs in its own tmux pane

## 3. Agent Lifecycle Management

All tools implement similar state machines:

```
SPAWNED → IDLE → BUSY → COMPLETED
           ↑             ↓
           └─────────────┘ (message/prompt)

ERROR states: NEEDS_INPUT, STUCK, FAILED
```

### Core Operations

| Operation         | Mechanism                                                                              |
| :---------------- | :------------------------------------------------------------------------------------- |
| **Spawning**      | Define agent counts by type; tools auto-calculate pane layout                          |
| **Monitoring**    | Parse terminal output for state detection (regex patterns), token velocity metrics     |
| **Communication** | Broadcast (all agents of type) or targeted (named pane), message queue for busy agents |
| **Termination**   | Soft kill (`Ctrl+C` via send-keys), hard kill (`tmux kill-session`), auto-cleanup      |

### Session Persistence

tmux's server-side session model provides resilience:

- SSH drops don't lose agent state
- `tmux attach-session -t project_name` restores entire session
- All orchestration tools leverage this for session recovery

## 4. MCP Server for tmux

**tmux-mcp-server** — MCP interface to tmux

- Repo: [github.com/lox/tmux-mcp-server](https://github.com/lox/tmux-mcp-server)
- Enables AI agents to orchestrate other agents via tmux programmatically
- Agents can spawn sessions, send commands, capture output
- Opens agent self-orchestration patterns

## 5. Emerging Platforms

**Warp: The Agentic Development Environment**

- Site: [warp.dev](https://www.warp.dev/)
- Evolved from terminal into full agent development environment
- **Oz Platform**: Cloud orchestration for multi-agent coordination
- Features: multi-threaded agent execution, internal task list per agent, user interception flows, multi-repo changes, full terminal + computer use
- Named TIME's Best Invention of 2025

## 6. Comparison to Claude Code Agent Teams

| Dimension           | tmux Community Tools                  | Claude Code Agent Teams      |
| :------------------ | :------------------------------------ | :--------------------------- |
| **Session model**   | Named tmux sessions/panes             | tmux panes or in-process     |
| **State detection** | Regex on terminal output              | Internal event system        |
| **Communication**   | `tmux send-keys` broadcast/targeted   | SendMessage + file inbox     |
| **Multi-provider**  | NTM supports Codex + Gemini + Claude  | Claude only                  |
| **Monitoring**      | Token velocity, visual dashboards     | Ctrl+O verbose transcript    |
| **Task management** | External (Kanban, task queues)        | Built-in TaskCreate/TaskList |
| **Git isolation**   | Worktrees (Agent of Empires, KanVibe) | Shared workspace             |
| **Web UI**          | Agent Viewer, KanVibe                 | CLI only                     |
| **IDE integration** | tmux-agents (VS Code)                 | VS Code extension (separate) |

### What Community Tools Add

- Multi-provider agent support (not just Claude)
- Visual dashboards and Kanban boards
- Token velocity metrics and cost tracking
- Git worktree isolation per agent
- Browser-based terminal interaction

### What Claude Code Agent Teams Add

- First-class task list with dependencies
- Peer-to-peer messaging without tmux intermediary
- Plan approval workflows
- Delegate permission mode
- Integrated context (conversation history carries team state)

## 7. Lessons for Our Approach

### tmux is Proven Infrastructure

The ecosystem validates tmux as a robust orchestration backend. 10+ tools have standardized on it. Our `claude-team` script's tmux integration aligns with the industry standard.

### Named Sessions Enable Programmatic Control

NTM's naming convention (`project__agent_type_N`) enables broadcast and targeted messaging. Our architecture should adopt consistent naming for programmatic agent targeting.

### Visual Monitoring is Essential

Every major tool includes some form of visual monitoring — dashboards, Kanban boards, token velocity. Our CLI-only approach may need supplementing for larger teams.

### Git Worktree Isolation Prevents Conflicts

Agent of Empires and KanVibe demonstrate that git worktrees provide better isolation than shared workspace. Worth adopting for parallel agent work.

### MCP Enables Agent Self-Orchestration

tmux-mcp-server shows that agents can orchestrate other agents via MCP + tmux. Relevant to our MCP-as-abstraction-layer vision.

### What NOT to Copy

- Regex-based state detection (fragile, Claude Code has internal APIs)
- Web UI dependency (adds deployment complexity)
- Manual pane layout calculation (Claude Code handles this natively)

## 8. Links and Sources

### Key Tools

| Tool                     | Repo                                                                                        | Language   |
| :----------------------- | :------------------------------------------------------------------------------------------ | :--------- |
| Named Tmux Manager (NTM) | [Dicklesworthstone/ntm](https://github.com/Dicklesworthstone/ntm)                           | Go         |
| Agent of Empires         | [njbrake/agent-of-empires](https://github.com/njbrake/agent-of-empires)                     | Rust       |
| Agent Viewer             | [hallucinogen/agent-viewer](https://github.com/hallucinogen/agent-viewer)                   | JavaScript |
| Tmux Orchestrator        | [Jedward23/Tmux-Orchestrator](https://github.com/Jedward23/Tmux-Orchestrator)               | Python     |
| KanVibe                  | [rookedsysc/kanvibe](https://github.com/rookedsysc/kanvibe)                                 | Rust       |
| tmux-agents              | [super-agent-ai/tmux-agents](https://github.com/super-agent-ai/tmux-agents)                 | TypeScript |
| Agent Manager Skill      | [fractalmind-ai/agent-manager-skill](https://github.com/fractalmind-ai/agent-manager-skill) | Python     |
| tmux-mcp-server          | [lox/tmux-mcp-server](https://github.com/lox/tmux-mcp-server)                               | —          |
| Agent Deck               | [asheshgoplani/agent-deck](https://github.com/asheshgoplani/agent-deck)                     | —          |
| CLI Agent Orchestrator   | [awslabs/cli-agent-orchestrator](https://github.com/awslabs/cli-agent-orchestrator)         | Python     |

### Articles

- [Addy Osmani - Claude Code Swarms](https://addyosmani.com/blog/claude-code-agent-teams/)
- [Dariusz Parys - Claude Code Multi-Agent tmux Setup](https://www.dariuszparys.com/claude-code-multi-agent-tmux-setup/)
- [Javier Aguilar - Claude Code Agent Teams in tmux](https://www.javieraguilar.ai/en/blog/claude-code-agent-teams)
- [Scuti AI - Combining tmux and Claude](https://scuti.asia/combining-tmux-and-claude-to-build-an-automated-ai-agent-system-for-mac-linux/)
- [TIME - Warp: Best Invention of 2025](https://time.com/collections/best-inventions-2025/7318249/warp-agentic-development-environment/)
- [The New Stack - How Warp Went From Terminal to Agentic Dev Environment](https://thenewstack.io/how-warp-went-from-terminal-to-agentic-development-environment/)

### Official Documentation

- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [GitHub Issue #23615 - Agent teams should spawn in new tmux window](https://github.com/anthropics/claude-code/issues/23615)
