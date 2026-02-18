# Research: Claude Code System Prompt CLI Flags

**Researcher**: Bugs Bunny (Software Engineer)
**Date**: 2026-02-17
**Task**: #103
**Sources**: `claude --help` output (v2.1.39), [CLI reference docs][1], [Agent teams docs][2]

---

## Summary

**Both REPLACE and EXTEND modes are supported.** Claude Code provides four system prompt flags:

| Flag | Mode | Availability | Description |
|:-----|:-----|:-------------|:------------|
| `--system-prompt <text>` | **REPLACE** | Interactive + Print | Replaces entire default system prompt with custom text |
| `--system-prompt-file <path>` | **REPLACE** | Print only | Replaces entire default system prompt with file contents |
| `--append-system-prompt <text>` | **EXTEND** | Interactive + Print | Appends custom text to the end of the default system prompt |
| `--append-system-prompt-file <path>` | **EXTEND** | Print only | Appends file contents to the default system prompt |

### Combination Rules

- `--system-prompt` and `--system-prompt-file` are **mutually exclusive** (cannot use both)
- The append flags **CAN** be used together with either replacement flag
- Example: `--system-prompt "base" --append-system-prompt "extra"` is valid

### Recommendations from Docs

> "For most use cases, `--append-system-prompt` or `--append-system-prompt-file` is recommended as they preserve Claude Code's built-in capabilities while adding your custom requirements. Use `--system-prompt` or `--system-prompt-file` only when you need complete control over the system prompt."

---

## Implications for Agent Launcher

### EXTEND Mode (default for most agents)
Use `--append-system-prompt` to inject the agent's prompt while keeping all Claude Code defaults (tool usage, memory, CLAUDE.md, etc.).

```bash
claude --append-system-prompt "You are a code reviewer..."
```

### REPLACE Mode (for specialized agents)
Use `--system-prompt` when the agent needs complete control, e.g., a focused single-task agent that shouldn't have default Claude Code behaviors.

```bash
claude --system-prompt "You are a focused test runner. Only run tests."
```

### File-based Prompts
The `-file` variants only work in print mode (`-p`), not interactive. Since agent team teammates are interactive sessions, we **must use the inline text flags** (`--system-prompt` or `--append-system-prompt`), not the file variants.

**Important limitation**: Long prompts passed via CLI flag may hit shell argument length limits. For very long agent prompts, we may need to:
1. Keep prompts concise (recommended)
2. Use environment variables or heredoc workaround
3. Consider `--settings` JSON with a system prompt field (needs investigation)

---

## Other Relevant CLI Flags for Agent Launcher

| Flag | Purpose | Agent Launcher Use |
|:-----|:--------|:-------------------|
| `--teammate-mode <mode>` | Display mode: `auto`, `in-process`, `tmux` | Set per-session, typically `tmux` for visible panes |
| `--permission-mode <mode>` | Permission level: `default`, `delegate`, `plan`, `bypassPermissions`, etc. | Map from agent frontmatter |
| `--agent <name>` | Select a pre-defined agent | Could use if agents are registered in settings |
| `--agents <json>` | Define custom subagents via JSON | Alternative to file-based agent definitions |
| `--tools <list>` | Restrict available tools | Map from agent frontmatter `tools` field |
| `--allowedTools <list>` | Tools that skip permission prompts | Map from agent frontmatter |
| `--disallowedTools <list>` | Tools removed from context entirely | Map from agent frontmatter |
| `--model <model>` | Override model for session | Map from agent frontmatter |
| `--settings <json>` | Load additional settings | Inject hooks, env vars, MCP config per-agent |
| `--mcp-config <path>` | Load MCP servers | Per-agent MCP configuration |
| `--dangerously-skip-permissions` | Skip all permission prompts | For fully trusted agents |
| `--allow-dangerously-skip-permissions` | Enable bypass as an option | For agents that might escalate |
| `--continue` | Resume most recent conversation | For agent session persistence |
| `--plugin-dir <paths>` | Load plugins for session only | Per-agent plugin loading |

### Missing: No `--team` Flag

There is **no CLI flag to join an existing team**. Teams are created programmatically via `TeamCreate` tool, and teammates are spawned by the lead session's `Task` tool. The lead manages the team lifecycle.

This means the agent launcher **cannot** use a CLI flag to tell a spawned agent "join this team." Instead, the spawning must happen through the lead's `Task` tool with `team_name` parameter — which is how it already works.

### `--agents` JSON Format (for reference)

The `--agents` flag accepts inline JSON for defining subagents:

```json
{
  "agent-name": {
    "description": "When to invoke this agent (required)",
    "prompt": "System prompt for the agent (required)",
    "tools": ["Read", "Edit", "Bash"],
    "disallowedTools": ["Write"],
    "model": "sonnet",
    "skills": ["skill-name"],
    "mcpServers": ["server-name"],
    "maxTurns": 10
  }
}
```

This could be an alternative path: instead of spawning teammates with `--system-prompt`, define them as `--agents` on the lead. However, this would make them subagents (not teammates), which loses inter-agent communication.

---

## Open Questions Answered

| Question | Answer |
|:---------|:-------|
| Does `--system-prompt` exist? | **Yes** — replaces entire system prompt |
| Does `--append-system-prompt` exist? | **Yes** — extends default system prompt |
| Can they be combined? | **Yes** — append flags work with replacement flags |
| Do `-file` variants work for teammates? | **No** — file variants are print-mode only; teammates are interactive |
| Is there a `--team` flag? | **No** — teams are managed via `TeamCreate` tool, not CLI |
| Does `--teammate-mode` appear in docs? | **Yes** — documented in both CLI reference and agent teams page |

---

## References

[1]: https://code.claude.com/docs/en/cli-usage "Claude Code CLI Reference"
[2]: https://code.claude.com/docs/en/agent-teams "Agent Teams Documentation"
