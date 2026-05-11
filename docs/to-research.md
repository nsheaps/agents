- If we're going to support multiple agent harnesses, agent-stream needs to be able to have a reference to the session within a specific harness... maybe like `claude-cli://session/{session_id}` or something (claude has the deep links defined already)?
  - We should have a plugin for each agent harness that we support, and use ReadMcpResourceTool if we want to read transcripts?
- if the agent has to call ListMcpResourcesTool to find the resources an mcp server supports, how will it know to use one from a specific mcp server? Is there no generic one? Perhaps we can provide a generic tool that is aware of all other MCP servers and their resources, and can route the request to the right one based on some convention in the resource name? Eg `claude-code://session/{session_id}` or `agent-team://{team_name}/config` or something like that. The tool can parse the resource name, determine which MCP server it belongs to, and then call ListMcpResourcesTool with the appropriate server identifier.
- we should bring the incident-tracking plugin back, and have it be generic for "tracking a regression and it's fix and a retrospective" and for all behavior issue we'll have an (behavior) incident to track it. Any time it happens again, we'll forward the info into that incident. Maybe support multiple incident providers, including a file based one.
- How do we share contacts? 1pass backend? network volume? remote api? should all agents have all the same contacts?
======
stuff below here is old
======
- can claude write a .claude/agents/xxx.md and then immediately launch an agent with subagent-type xxx without restarting? Is it aware of it as something it can use? If so, can/should it modify them as it launches for any runtime info?
- Can/should it start from least privelidge security, and then maybe have another team member that deems if it's safe or not?

## Agent Management Tool Gaps

Discovered during looney-tunes team session. These tools are needed but don't exist in Claude Code's agent teams system:

### Missing Tools

| Tool               | Purpose                                                         | Current Workaround                                              |
| :----------------- | :-------------------------------------------------------------- | :-------------------------------------------------------------- |
| `TeamRemoveMember` | Remove a specific member from team config by name               | Manual `jq` edit of `~/.claude/teams/{team}/config.json`        |
| `TeamListMembers`  | List members with live/dead status (cross-reference tmux panes) | `jq` on config + `tmux list-panes` manually                     |
| `TeamCleanup`      | Auto-remove all stale members whose backends are gone           | Manual detection and jq cleanup                                 |
| `TeamRespawn`      | Kill and respawn a teammate cleanly (same name, fresh session)  | shutdown_request → wait → manual cleanup if needed → Task spawn |

### Root Cause

When a teammate's tmux pane is killed externally (user kills it, crash, etc.), the team config retains the member entry with `isActive: true`. The system has no mechanism to detect that the backend process is gone. This causes:

- Name collisions when respawning (system appends `-2`, `-3` suffixes)
- Stale entries accumulating in config over long sessions
- No way to cleanly replace a teammate without manual config surgery

### Graceful Crash Handling (Feature Request)

The system should detect when a tmux pane exits (via `tmux wait-for` or pane monitoring) and automatically:

1. Mark the member as `isActive: false`
2. Remove the member entry from config
3. Notify the team lead that a teammate terminated unexpectedly

### Per-Agent Tool Set Configuration

**Design requirement**: Agent management tool sets should be optionally turned on and off per agent. Not every agent needs team management capabilities.

| Tool Category    | Examples                                  | Who Needs It                                   |
| :--------------- | :---------------------------------------- | :--------------------------------------------- |
| Team management  | TeamCreate, TeamRemoveMember, TeamCleanup | Orchestrators, team leads                      |
| Task management  | TaskCreate, TaskUpdate, TaskList          | PMs, team leads, any coordinator               |
| Messaging        | SendMessage (all types)                   | All agents                                     |
| Agent spawning   | Task (with team_name)                     | Orchestrators, agents that spawn sub-processes |
| Shutdown control | SendMessage (shutdown_request)            | Team leads only                                |

**Why**: Some agents can launch their own separate agent processes (nested orchestrators, sub-team leads). These need team/task/spawn tools. Leaf agents that only execute work (engineers, researchers) may not need team management tools at all. Giving every agent the full tool set creates:

- Unnecessary complexity in agent prompts
- Risk of agents accidentally creating teams or spawning teammates
- Larger context from tool descriptions that aren't relevant

This should be a first-class config option in agent definitions (e.g., `tools: [messaging, tasks]` in the agent frontmatter or `.agent.yaml`).

### Workaround Documented

See `.claude/behaviors/team-member-cleanup.md` for the manual self-healing procedure.
