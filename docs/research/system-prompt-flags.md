# Research: Claude Code --system-prompt (Replace) Flag

**Research Date**: February 2026
**Task**: #103
**Author**: Road Runner (Researcher)
**Status**: Complete

---

## Executive Summary

**YES, Claude Code has a `--system-prompt` flag that REPLACES the built-in system prompt.** However, it has a critical reliability limitation in interactive mode.

| Flag                               | Behavior                           | Print Mode | Interactive Mode              |
| :--------------------------------- | :--------------------------------- | :--------- | :---------------------------- |
| `--system-prompt "..."`            | **Replaces** entire default prompt | Works      | Documented but unreliable[^2] |
| `--system-prompt-file path`        | **Replaces** from file             | Works      | Print mode only               |
| `--append-system-prompt "..."`     | **Appends** to default prompt      | Works      | Works                         |
| `--append-system-prompt-file path` | **Appends** from file              | Works      | Print mode only               |

---

## 1. Available Flags

### `--system-prompt` (Full Replacement)

Replaces the ENTIRE default system prompt with custom text. This removes all default Claude Code instructions, tool usage guidance, and behavioral rules.[^1]

```bash
claude --system-prompt "You are a Python expert"
claude -p --system-prompt "You are a Python expert" "query"
```

### `--system-prompt-file` (Full Replacement from File)

Same as above but loads from a file. Print mode only.[^1]

```bash
claude -p --system-prompt-file ./custom-prompt.txt "query"
```

### `--append-system-prompt` (Addition)

Appends to the END of the default system prompt, preserving all default Claude Code capabilities.[^1]

```bash
claude --append-system-prompt "Always use TypeScript"
```

### `--append-system-prompt-file` (Addition from File)

Appends file contents. Print mode only.[^1]

```bash
claude -p --append-system-prompt-file ./extra-rules.txt "query"
```

**Note**: `--system-prompt` and `--system-prompt-file` are mutually exclusive. Append flags can combine with either.[^1]

---

## 2. Interactive Mode Reliability Issue

GitHub Issue #2692[^2] reports that `--system-prompt` does not reliably work in interactive mode:

- Documented as working in interactive mode
- Users report Claude Code still uses default instructions even when `--system-prompt` is specified
- Different from Gemini CLI which supports `GEMINI_SYSTEM_MD` for this purpose

**Workarounds**:

1. Use `--append-system-prompt` (more reliable, but adds to rather than replaces)
2. Use `-p` print mode (reliable but non-interactive)
3. Use CLAUDE.md files (supplements, doesn't replace)
4. Use output styles (persistent file-based configurations)

---

## 3. Claude Agent SDK Support

The Agent SDK (Python and TypeScript) provides **reliable** system prompt replacement:[^3]

### Full Replacement

```typescript
const customPrompt = `You are a Python coding specialist...`;

for await (const message of query({
  prompt: "Help me write code",
  options: {
    systemPrompt: customPrompt, // REPLACES entire prompt
  },
})) {
  console.log(message);
}
```

### Preset with Append

```typescript
for await (const message of query({
  prompt: "Help me write code",
  options: {
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: "Always use TypeScript", // ADDS to default
    },
  },
})) {
  console.log(message);
}
```

**Key note**: The Agent SDK uses a minimal system prompt by default (no Claude Code instructions). You must explicitly specify `systemPrompt: { preset: "claude_code" }` to use Claude Code's full prompt.[^3]

---

## 4. Implications for Agent Team Launcher

### Per-Agent System Prompt Customization

The `--system-prompt` flag enables **complete per-agent role customization** when launching agents:

```bash
# Orchestrator agent
claude --system-prompt "You are the Orchestrator. Coordinate agents, manage tasks..." \
  --teammate-mode tmux

# Worker agent
claude --system-prompt "You are a Code Implementer. Write and test code..." \
  --tools "Read,Edit,Write,Bash,Grep,Glob"
```

### Recommended Approach (Given Reliability Concerns)

1. **For interactive agent sessions**: Use `--append-system-prompt` with a clear role prefix (more reliable)
2. **For print-mode / scripted operations**: Use `--system-prompt` for full replacement (works reliably)
3. **For Agent SDK integration**: Use `systemPrompt` parameter directly (most reliable)
4. **Test thoroughly**: Verify `--system-prompt` behavior in the specific launch context (tmux panes, teammate spawning) before relying on it

### Combined with Tool Stripping

When using `--system-prompt` (full replacement), **all tool descriptions are removed** since they're part of the default prompt. If you still need some tools, you must reconstruct their guidance in your custom prompt — which is fragile and version-dependent.

A safer approach combines append with tool flags:

```bash
claude \
  --append-system-prompt "AGENT ROLE: You are the Orchestrator..." \
  --tools "Read,Grep,Glob,Task,SendMessage" \
  --disallowedTools "Edit" "Write" "Bash"
```

This preserves Claude Code's tool descriptions for the tools you keep while removing the rest.

---

## References

[^1]: [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) — Complete flag documentation

[^2]: [Replace system prompt in interactive mode — GitHub Issue #2692](https://github.com/anthropics/claude-code/issues/2692) — Interactive mode reliability discussion

[^3]: [Claude Agent SDK — Modifying System Prompts](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts) — SDK system prompt customization

[^4]: [Overridable Plan mode system prompt — GitHub Issue #12127](https://github.com/anthropics/claude-code/issues/12127) — Related mode-specific prompt discussion

[^5]: [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams) — Agent team integration context
