---
type: feature
id: GSD-54
legacy_ids:
  - "1779912330"
created: 2026-05-27T20:05:30Z
state: triage
project: GSD
priority: 4
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-687"
    note: "#687: [RETRO/GSD-54] Read tool dir-listing hook — retro-filed 2026-05-28 per Nate 20:04Z"
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1779912330
events:
  - { ts: 2026-05-27T20:05:30Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-28T02:01:58Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-54 (state=triage)",
    }
---

# GSD-54 — Read tool dir-listing hook

## Original ask

> PreToolUse hook for the Read tool: if the path is a directory, intercept and return a `ls`-style directory listing instead of letting Read fail with `EISDIR: illegal operation on a directory`.
>
> Why: when Bash is broken (see companion ticket on session-env E2BIG), I lose Glob/LS-style enumeration capability entirely — the only tools left are Read/Write/Edit, and Read on a directory just errors out without showing what's inside. This makes recovery scenarios (where you need to find a file to truncate/move) impossible without external help.
>
> Even outside the Bash-broken case, this would be a quality-of-life improvement: "list the directory" is a frequent intent, and we currently force the agent through Glob or Bash `ls` for it. A PreToolUse hook that does `if isdir(path): emit listing as tool_result, decision=block` would short-circuit the EISDIR error and serve the obvious intent.
>
> Implementation notes:
>
> - Hook should match PreToolUse for tool `Read`.
> - Check `stat(input.file_path)` — if directory, run a bounded listing (e.g., top 200 entries with size/mtime, like `ls -la`) and emit it as the tool response with decision: "block" + reason explaining we showed listing instead.
> - Keep output bounded so listing a huge dir doesn't blow context.
> - Could live in agent-utils plugin (or a new tiny utility plugin).

Source: Nate Discord[^discord-ask] (2026-05-27 ~19:58Z)

## Goal

Add a `PreToolUse` hook for the `Read` tool that detects when the target path is a directory and returns a bounded `ls`-style listing instead of erroring with `EISDIR`. This improves agent resilience in Bash-broken scenarios and is a general quality-of-life improvement.

## Acceptance criteria

1. A `PreToolUse` hook is implemented that intercepts `Read` calls where `file_path` is a directory.
2. The hook emits a bounded directory listing (e.g. `ls -la`, max ~200 entries with size/mtime).
3. The hook responds with `decision: block` and a reason explaining the listing was returned instead of raising an error.
4. Output is bounded to prevent context blowout on large directories.
5. Hook lives in `agent-utils` plugin (or a new lightweight utility plugin), not inline in agent config.
6. Tested: agent can enumerate a directory when Bash is unavailable by attempting `Read` on the directory path.

## Related

- Companion ticket on session-env `E2BIG` / Bash-broken scenarios (the motivating case).
- `agent-utils` plugin (proposed home for the hook).

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1779912330
