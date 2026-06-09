# hook-utils

Observability for Claude Code hooks. Maps **every** hook event to a single
renderer that prints the hook name — and, depending on verbosity, its
parameters and response — **to the user only, never to Claude**.

Think of it as a `claude-stream` view of your hook lifecycle: it shows you what
is firing, in what order, with what inputs, and how long tool calls take —
without polluting the model's context.

## How it works

Every documented hook event (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`,
`SessionStart`, `Stop`, `Notification`, … 30 events in total) is registered in
[`hooks/hooks.json`](hooks/hooks.json) and routed to one script,
[`hooks/hook-stream.sh`](hooks/hook-stream.sh).

The script:

1. Reads the hook payload from stdin and reads `hook_event_name`.
2. Renders a one-line summary in the [`claude-stream`](https://github.com/nsheaps/claude-utils)
   style — a `Hook(<EventName>): <body>` line with `…` truncation.
3. Emits it via the **`systemMessage`** JSON output field (shown in the UI, not
   added to Claude's context) and sets `suppressOutput: true` so the raw hook
   stdout never reaches the transcript.

It **never** emits a `permissionDecision`, so the normal permission flow is
untouched — this plugin only observes, it never blocks or alters a tool call.

### Timing

`PreToolUse` records a start timestamp keyed by `tool_name` + `tool_input`.
`PostToolUse` / `PostToolUseFailure` read it back and append the elapsed time
(e.g. ` [1.2s]`, ` [125ms]`). State lives under
`${CLAUDE_PROJECT_DIR}/.claude/tmp/hook-utils/<session>/`.

## Configuration

Add a `hook-utils:` section to your project's
`.claude/plugins.settings.yaml`:

```yaml
# .claude/plugins.settings.yaml
hook-utils:
  # Master switch — set false to silence the plugin entirely. Default: true
  enabled: true

  # quiet  — just the hook name, e.g. Hook(PreToolUse)
  # normal — hook name + params (pre-events) or response + elapsed time
  #          (post-events), each truncated to 80 chars
  # full   — everything, untruncated ("verbose" is accepted as an alias)
  # Default: normal
  verbosity: normal

  # Wrap the prefix in ANSI colour (yellow=tool pre, magenta=tool post,
  # cyan=prompt/setup, blue=session/stop). Default: false — system messages
  # are styled by the UI and raw ANSI may render literally in some clients.
  color: false
```

## Verbosity at a glance

| Level    | PreToolUse                                 | PostToolUse                                         |
| :------- | :----------------------------------------- | :-------------------------------------------------- |
| `quiet`  | `Hook(PreToolUse)`                         | `Hook(PostToolUse)`                                 |
| `normal` | `Hook(PreToolUse): Bash({"command":"npm …` | `Hook(PostToolUse): Bash → {"stdout":"all … [1.2s]` |
| `full`   | full `tool_input` JSON, untruncated        | full `tool_response` JSON + ` [1.2s]`, untruncated  |

Events without tool context (`SessionStart`, `UserPromptSubmit`, `Stop`,
`Notification`, …) render their event-specific payload (the input minus the
always-present common fields), truncated to 80 chars in `normal` and shown in
full in `full`.

## Requirements

- `jq` (rendering). If `jq` is unavailable the hook fails open silently.
- `python3` with PyYAML (config read). Missing config falls back to defaults.

## Why `systemMessage` and not stdout?

For most hook events, plain stdout is written only to the debug log — it is not
shown in the transcript and not given to Claude. `UserPromptSubmit`,
`UserPromptExpansion`, and `SessionStart` are the exception: their stdout is
fed to Claude as context. Using `systemMessage` gives one consistent,
user-only output channel across **all** events, which is exactly what this
plugin wants.
