# Launch Guide

How to start the Looney Tunes agent team after session termination.

## Prerequisites

1. **Claude Code CLI** installed and authenticated
2. **Agent teams enabled** — set the environment variable:
   ```bash
   export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
   ```
3. **tmux** installed (required for `tmux` teammate mode):
   ```bash
   brew install tmux
   ```
4. **Teammate mode in settings.json** — add this to `.claude/settings.json` in the agent-team repo to avoid repeated iTerm2 detection prompts:
   ```json
   {
     "teammateMode": "tmux"
   }
   ```
   > Without this, Claude Code asks about iTerm2 detection on every launch. Setting it in `settings.json` persists the choice.
5. **Working directory** — `cd` into the agent-team repo:
   ```bash
   cd ~/src/nsheaps/agent-team
   ```

## Launch Command

### Using claude-team (recommended)

If you have [claude-utils](https://github.com/nsheaps/claude-utils) installed via Homebrew:

```bash
claude-team
# or the shorthand:
ct
```

This handles environment variables, teammate mode selection, and tmux -CC setup automatically.

### Manual launch

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude \
  --continue \
  --dangerously-skip-permissions \
  --teammate-mode tmux \
  --permission-mode delegate \
  --append-system-prompt "You are an orchestrator. Spawn teammates using Task with team_name. Coordinate via SendMessage and TaskCreate/TaskUpdate/TaskList."
```

Key flags:

| Flag                             | Purpose                                              |
| :------------------------------- | :--------------------------------------------------- |
| `--continue`                     | Resume the previous session if one exists            |
| `--dangerously-skip-permissions` | Skip permission prompts for the orchestrator         |
| `--teammate-mode tmux`           | Spawn teammates in tmux panes (iTerm2 uses -CC mode) |
| `--permission-mode delegate`     | Orchestrator delegates permission decisions          |
| `--append-system-prompt "..."`   | Inject orchestrator identity into system prompt      |

## What Happens at Launch

1. Claude Code starts with the orchestrator agent's system prompt
2. The orchestrator reads `.claude/CLAUDE.md`, which loads shared docs via `@references`:
   - `@docs/team-structure.md` — roles, hierarchy, communication flow
   - `@docs/communication-protocol.md` — message routing rules
   - `@docs/team-rules.md` — behavioral standards
3. The orchestrator creates a team with `TeamCreate`
4. The orchestrator spawns teammates using the `Task` tool with `team_name` and `subagent_type` matching agent file names

## Spawning Teammates

The orchestrator spawns each teammate using:

```
Task(
  subagent_type: "agent-name",   # matches .claude/agents/<agent-name>.md
  team_name: "<team-name>",
  name: "<display-name>",
  prompt: "Your initial instructions..."
)
```

Each agent file's body (everything below the YAML frontmatter) becomes that teammate's system prompt.

## Team Roster

| Agent Name          | Character       | Role              | What They Do                                 |
| :------------------ | :-------------- | :---------------- | :------------------------------------------- |
| `orchestrator`      | —               | Team Lead         | Spawns teammates, assigns tasks, coordinates |
| `project-manager`   | Elmer Fudd      | Project Manager   | Owns task list, manages priorities           |
| `coach`             | Wile E. Coyote  | Team Coach        | Observes failures, records patterns          |
| `technical-writer`  | Tweety Bird     | Technical Writer  | Maintains docs, audits specs                 |
| `deep-researcher`   | Road Runner     | Deep Researcher   | Complex multi-source investigations          |
| `ops-engineer`      | Foghorn Leghorn | Ops Engineer      | CI/CD, repos, Homebrew, distribution         |
| `software-engineer` | Bugs Bunny      | Software Engineer | Implements features, writes code             |
| `quality-assurance` | Daffy Duck      | Quality Assurance | Tests, validates, catches regressions        |

See `.claude/docs/team-structure.md` for the full hierarchy and communication flow.

## After-Launch Checklist

Once the orchestrator is running:

1. **Verify teammates spawned** — check that each teammate responds to a health-check message
2. **Coach review** — the Coach (Wile E. Coyote) should review any prior session notes in `.claude/tmp/`
3. **Create tasks** — use `TaskCreate` to define the work, then assign with `TaskUpdate`
4. **Set dependencies** — use `addBlocks` / `addBlockedBy` on tasks that depend on each other
5. **Monitor progress** — the orchestrator checks `TaskList` periodically and coordinates handoffs

## Keyboard Shortcuts (tmux mode)

| Shortcut | Action                                   |
| :------- | :--------------------------------------- |
| `Ctrl+A` | Accept the current response              |
| `Ctrl+C` | Interrupt / cancel current operation     |
| `Ctrl+O` | Toggle verbose view of teammate activity |

## Shutdown

To shut down the team gracefully:

1. The orchestrator sends `shutdown_request` messages to each teammate
2. Each teammate responds with `shutdown_response` (approve or reject)
3. After all teammates confirm, the orchestrator calls `TeamDelete` to clean up

## References

- [Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [claude-utils / agent-teams skill](https://github.com/nsheaps/claude-utils)
- `.claude/docs/team-structure.md` — roles and hierarchy
- `.claude/docs/communication-protocol.md` — message routing
- `.claude/docs/team-rules.md` — behavioral standards
