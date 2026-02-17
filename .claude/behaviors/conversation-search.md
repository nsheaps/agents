---
name: conversation-search
description: Procedure for searching previous Claude Code conversations. Use when you need to find what was previously said, verify past decisions, look up how something was done before, or trace the history of a particular topic across sessions.
---

# Conversation Search

Procedure for searching Claude Code conversation transcripts without bloating your own context. Transcripts are large JSONL files — a single session can reach 38MB. Loading them into your main context will cause compaction issues or crashes.

## Purpose

Find specific information from past conversations — user requests, decisions, tool usage, error history — while keeping your context lean.

## When to Use

- You need to verify what the user originally requested
- A teammate claims something was decided earlier and you need to confirm
- You're looking for how something was done in a previous session
- You need the root cause history of a recurring failure
- Someone asks "didn't we already discuss...?" and you need to check

## Steps

1. **Never search in your main context** — Conversation transcripts are too large. Loading them directly risks context bloat, failed compaction, and session crashes.

2. **Use the `conversation-history-search` agent** — This is a built-in Claude Code agent type designed for this task:

   ```
   Task(
     subagent_type: "conversation-history-search",
     prompt: "Search for [what you're looking for]",
     model: "haiku"
   )
   ```

   The agent searches `~/.claude/projects/**/*.jsonl` and returns a summary. Use `haiku` model to minimize cost.

3. **Provide specific search terms** — Narrow searches work better than broad ones:
   - Error messages, file paths, function names (good)
   - Broad keywords like "discussed" or "decided" (less effective)
   - Include time context if known: "in the session from February 15"

4. **For programmatic access** — When building tools or scripts that need transcript data:
   - **Bun**: `Bun.JSONL.parseChunk()` — native, streaming, low memory
   - **Node.js**: `ndjson` package — industry standard, streaming
   - **CLI quick search**: `rg` for fast text matching, pipe to `jq` for structured extraction

5. **Review and confirm** — The agent returns a summary. Verify findings with the user or requester before acting on them. Summaries can lose nuance.

## Transcript Location and Schema

Transcripts live at `~/.claude/projects/{project-path-hash}/{session-id}.jsonl`. Each line is a JSON object with a `type` field:

| Type              | What It Contains                                         |
| :---------------- | :------------------------------------------------------- |
| `user`            | User messages and tool results                           |
| `assistant`       | LLM responses (text, tool_use, thinking)                 |
| `system`          | System events (hooks, compaction boundaries)             |
| `summary`         | Compaction summaries                                     |
| `queue-operation` | Internal queue management (~86% of entries — skip these) |
| `progress`        | Hook progress and waiting states                         |

## Practical CLI Recipes

When you need to search outside the agent (e.g., in scripts or one-off investigations):

### Find user messages containing a keyword

```bash
rg -F '"type":"user"' transcript.jsonl | jq -r 'select(.message.content | type == "string") | .message.content' | rg "keyword"
```

### List all tools used in a session

```bash
jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .name' transcript.jsonl | sort | uniq -c | sort -rn
```

### Find errors from tool results

```bash
rg '"is_error":true' transcript.jsonl | jq -r '.message.content[] | select(.is_error == true) | .content[:200]'
```

### Extract conversation flow (text only)

```bash
jq -r 'select(.type == "user" or .type == "assistant") |
  if .type == "user" then
    "USER: " + (.message.content | if type == "string" then . else "[tool_result]" end)
  else
    "ASSISTANT: " + ([.message.content[] | select(.type == "text") | .text] | join(" "))
  end' transcript.jsonl
```

### Find compaction boundaries

```bash
jq 'select(.type == "system" and .subtype == "compact_boundary")' transcript.jsonl
```

## Anti-Patterns

- Loading transcript files directly into your context (use the agent instead)
- Using `jq -s` (slurp) on large transcripts — it loads everything into memory
- Searching with broad keywords that match thousands of lines
- Trusting a summary without verifying critical details
- Running `cat` or `Read` on a `.jsonl` file — they can be tens of megabytes
- Grepping in your main context instead of delegating to a sub-agent

## References

- [JSONL Parsing Tools Research](../../docs/research/jsonl-parsing-tools.md) — full tool comparison and schema documentation
- [Claude Code Docs](https://code.claude.com/docs/en/)
