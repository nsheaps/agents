# Research: Stripping Tools from the Claude Code System Prompt

**Research Date**: February 2026
**Task**: #111
**Author**: Road Runner (Researcher)
**Status**: Complete

---

## Executive Summary

Claude Code provides **three distinct levels** of tool control, each with different effects on context token usage:

| Level | Mechanism | Blocks Execution? | Removes from Context? | Saves Tokens? |
| :---- | :-------- | :----------------- | :-------------------- | :------------ |
| **Removal** | `--tools`, `--disallowedTools` CLI flags | Yes | **Yes** | **Yes** |
| **Restriction** | Agent frontmatter `tools`/`disallowedTools` | Yes | **Yes** (for that agent) | **Yes** |
| **Blocking** | PreToolUse hooks (exit code 2, `permissionDecision: deny`) | Yes | No | No |

**Key finding**: The `--tools` and `--disallowedTools` CLI flags are the **only mechanisms that actually remove tool descriptions from the system prompt**, saving context tokens. Hooks can block execution but tool descriptions still consume context space.

---

## 1. Tool Removal (Saves Context Tokens)

### 1.1 `--tools` Flag (Primary Mechanism)

The `--tools` flag **whitelists** which tools are available. Tools not listed are removed from Claude's context entirely — their descriptions do not appear in the system prompt, and they are not sent via the API `tools` parameter.[^1]

```bash
# Only allow read-only tools — all other tool descriptions removed from context
claude --tools "Read,Grep,Glob,Bash"

# Disable ALL tools
claude --tools ""

# Re-enable all tools (default)
claude --tools "default"
```

**Supported tool names**: `Bash`, `Edit`, `Read`, `Grep`, `Glob`, `Write`, `WebFetch`, `WebSearch`, `MCP`, `AskUserQuestion`, `TaskOutput`[^1]

**Behavior**:
- Removes tool descriptions from the system prompt
- Removes tool schemas from the API `tools` parameter
- Cannot be overridden by permission rules or other mechanisms
- Works in both interactive and print modes

### 1.2 `--disallowedTools` Flag

The `--disallowedTools` flag **blacklists** specific tools. They are removed from Claude's context.[^1]

```bash
# Remove Bash and WebFetch — their descriptions won't appear in context
claude --disallowedTools "Bash" "WebFetch"

# Supports pattern matching for granular control
claude --disallowedTools "Bash(rm -rf *)" "Bash(sudo *)"

# Disable specific sub-agents
claude --disallowedTools "Task(Explore)" "Task(Plan)"

# Disable file access to sensitive paths
claude --disallowedTools "Read(./.env)" "Edit(/src/secrets/**)"

# Disable domain access
claude --disallowedTools "WebFetch(domain:api.private.com)"
```

**Pattern syntax** follows permission rule format:
- `Bash` — all Bash commands
- `Bash(npm run *)` — Bash commands starting with "npm run"
- `Read(./.env)` — reading .env file
- `WebFetch(domain:example.com)` — WebFetch to specific domain
- `Task(Explore)` — disable Explore subagent

### 1.3 Agent Frontmatter `tools` and `disallowedTools` Fields

Custom subagents can restrict their tool set via frontmatter. Tools not listed in the `tools` field are not included in the subagent's context.[^2]

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep, Bash
disallowedTools: Write, Edit
model: sonnet
---
```

Or via the `--agents` CLI flag:

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer",
    "prompt": "You are a senior code reviewer...",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "disallowedTools": ["Write", "Edit"],
    "model": "sonnet"
  }
}'
```

**Key behaviors**:
- If `tools` is omitted, the subagent inherits **all tools** from the parent
- If `tools` is empty array `[]`, the subagent has **no tools**
- `disallowedTools` removes specific tools from the inherited or specified list
- Subagent tool restrictions apply only to that subagent, not the parent

**Limitation**: This only applies to **custom subagents**, not the main Claude Code session.

---

## 2. Tool Blocking (Does NOT Save Context Tokens)

### 2.1 PreToolUse Hooks

Hooks can **block tool execution** but the tool descriptions remain in the system prompt, consuming context tokens.[^3]

**Exit code 2** blocks the tool call:

```bash
#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')
if echo "$COMMAND" | grep -q 'rm -rf'; then
  echo "Destructive rm command blocked by hook" >&2
  exit 2  # Block the command
fi
exit 0  # Allow it
```

**JSON `permissionDecision: deny`** also blocks:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Database writes are not allowed"
  }
}
```

**Matchers** filter which tools trigger the hook (case-sensitive regex):
- `"Bash"` — matches Bash tool
- `"Edit|Write"` — matches Edit or Write
- `"mcp__filesystem__.*"` — matches all filesystem MCP tools

### 2.2 Prompt-Based Hooks

Delegate blocking decisions to a Haiku model:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Is this Bash command safe? Block if it modifies system files. Command: $ARGUMENTS",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Limitations**:
- Slower (~500ms–1s per tool call due to LLM inference)
- Cannot modify tool input
- Tool descriptions still present in context

### 2.3 Permission Rules in settings.json

Permission rules control **approval behavior**, not tool visibility:

```json
{
  "permissions": {
    "deny": ["Bash(rm -rf *)", "Read(./.env)"],
    "ask": ["Bash"],
    "allow": ["Read", "Grep", "Glob"]
  }
}
```

Evaluation order: Deny (highest) → Ask → Allow → Default mode check[^4]

**Important**: Unlike `--disallowedTools`, permission deny rules do **not** remove tool descriptions from the system prompt. They only prevent execution.[^1]

---

## 3. System Prompt Architecture

### 3.1 Where Tool Descriptions Live

Tool descriptions exist in **two places simultaneously**:[^5]

1. **System prompt text** — Embedded as Markdown, providing usage context and patterns
2. **API `tools` parameter** — JSON schemas for parameter validation

This dual-description pattern is intentional: the system prompt provides behavioral guidance while the schema ensures proper parameter structure.

### 3.2 Token Cost of Tool Descriptions

Tool descriptions vary significantly in size:[^5]

| Tool | Approximate Tokens |
| :--- | :----------------- |
| `Bash` | ~1,067 |
| `TodoWrite` | ~2,167 |
| `Write` | ~121 |
| Other tools | 100–800 each |

The total context consumed by all tool descriptions is **substantial** — potentially 5,000–10,000 tokens for a full Claude Code session with all tools enabled.

### 3.3 Conditional Loading

Claude Code's system prompt is **not a single string** but 110+ conditionally-loaded segments. Tool descriptions are among the segments added/removed based on configuration.[^5]

This means `--tools` and `--disallowedTools` flags actually prevent the corresponding prompt segments from being loaded, providing genuine context savings.

---

## 4. What Cannot Be Done (Currently)

### 4.1 No "Strip Description Only" Flag

There is no mechanism to keep a tool available but remove its description from the system prompt. The description is considered essential for Claude to understand how to use the tool.[^5]

### 4.2 No Custom Tool Descriptions

There is no flag to replace a built-in tool's description with a shorter custom version. The `--append-system-prompt` flag can add instructions but cannot modify existing tool descriptions.[^6]

### 4.3 No settings.json Tool Removal

`settings.json` does **not** have `allowedTools`, `disabledTools`, or `tools` fields for tool removal. It only has permission rules that affect approval behavior.[^1]

### 4.4 Plugin Tool Visibility Bug

Disabled plugins' tools remain accessible (GitHub Issue #9996[^7]). The `/plugin` disable toggle does not remove tool descriptions from the session.

### 4.5 Skill Visibility

All skill descriptions are loaded into the parent agent's system prompt at startup. A feature request exists (GitHub Issue #12633[^8]) to add `hidden: true` to hide skills from parent agents.

---

## 5. The `--system-prompt` Flag (Full Replacement)

Claude Code supports a `--system-prompt` flag that **replaces the entire system prompt**:[^6]

```bash
claude --system-prompt "You are a Python expert"
claude -p --system-prompt "You are a Python expert" "query"
```

**This removes ALL tool descriptions** (and all other default instructions). However:
- Reported as **unreliable in interactive mode** (GitHub Issue #2692[^9])
- Works reliably in **print mode** (`-p`)
- The Agent SDK's `systemPrompt` parameter is more reliable for full replacement

**Implication for agent-team**: If we replace the system prompt entirely, we'd need to reconstruct any tool descriptions we want to keep, which is fragile and version-dependent.

---

## 6. Practical Recommendations

### For Per-Agent Tool Sets (agent-team use case)

**Recommended approach — combine CLI flags with agent frontmatter**:

```bash
# Agent orchestrator: coordination tools only
claude \
  --tools "Read,Grep,Glob,Task,SendMessage,TaskCreate,TaskUpdate,TaskList" \
  --disallowedTools "Edit" "Write" "Bash" \
  --permission-mode delegate

# Agent worker: implementation tools, no spawning
claude \
  --tools "Read,Edit,Write,Bash,Grep,Glob" \
  --disallowedTools "Task(Explore)" "Task(Plan)" \
  --permission-mode bypassPermissions
```

### For Context Token Savings

1. **Use `--tools` to whitelist** — only include tools the agent actually needs
2. **Use `--disallowedTools` to blacklist** — remove specific tools you know aren't needed
3. **Combine both** — whitelist core tools AND blacklist dangerous patterns within allowed tools
4. **Use agent frontmatter `tools` field** — restrict subagent tool sets

### Do NOT Rely On

- Hooks for context savings (tools still in prompt)
- Permission deny rules for context savings (tools still in prompt)
- Plugin disabling (known bug: tools remain accessible)
- `--append-system-prompt "Don't use X"` (soft guidance, not enforceable)

---

## 7. Tool Availability Matrix

| Mechanism | Scope | Removes from Context? | Blocks Execution? | Pattern Support? |
| :-------- | :---- | :-------------------- | :----------------- | :--------------- |
| `--tools` | Session | **Yes** | Yes | No (exact names) |
| `--disallowedTools` | Session | **Yes** | Yes | Yes (wildcards) |
| Agent `tools` frontmatter | Subagent | **Yes** | Yes | No (exact names) |
| Agent `disallowedTools` | Subagent | **Yes** | Yes | Yes |
| `permissions.deny` | Session/Project | No | Yes | Yes (wildcards) |
| PreToolUse hooks | Session/Project | No | Yes | Yes (regex matchers) |
| Prompt-based hooks | Session/Project | No | Yes | Yes (regex matchers) |
| `--system-prompt` | Session | **Yes** (all removed) | Yes (all removed) | N/A |
| Plugin disable | Session | No (bug) | No (bug) | N/A |

---

## References

[^1]: [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) — Complete flag documentation for `--tools`, `--allowedTools`, `--disallowedTools`

[^2]: [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents) — Subagent tool configuration via frontmatter

[^3]: [Hooks reference — Claude Code Docs](https://code.claude.com/docs/en/hooks) — PreToolUse hooks, exit codes, matchers

[^4]: [Configure Permissions — Claude Code Docs](https://code.claude.com/docs/en/permissions) — Permission rules, evaluation order, modes

[^5]: [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — Extracted system prompts showing tool description embedding and token counts

[^6]: [Claude Agent SDK — Modifying System Prompts](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts) — `systemPrompt` parameter for full replacement

[^7]: [Plugin marketplace disabled but tools remain available — GitHub Issue #9996](https://github.com/anthropics/claude-code/issues/9996) — Known plugin visibility bug

[^8]: [Allow skills to be hidden from main agent — GitHub Issue #12633](https://github.com/anthropics/claude-code/issues/12633) — Feature request for skill visibility control

[^9]: [Replace system prompt in interactive mode — GitHub Issue #2692](https://github.com/anthropics/claude-code/issues/2692) — Interactive mode `--system-prompt` reliability issue

[^10]: [Automate workflows with hooks — Claude Code Docs](https://code.claude.com/docs/en/hooks-guide) — Hook patterns and PreToolUse blocking examples

[^11]: [MCP Tool Filtering — GitHub Issue #7328](https://github.com/anthropics/claude-code/issues/7328) — Feature request for selective MCP tool enable/disable

[^12]: [cchistory — Tracking Claude Code System Prompt and Tool Changes](https://mariozechner.at/posts/2025-08-03-cchistory/) — Tool description extraction methodology

[^13]: [OpenCode vs Claude Code — Builder.io](https://www.builder.io/blog/opencode-vs-claude-code) — Dual enforcement pattern (permission deny + visibility hiding)
