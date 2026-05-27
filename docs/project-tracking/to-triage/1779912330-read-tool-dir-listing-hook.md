PreToolUse hook for the Read tool: if the path is a directory, intercept and return a `ls`-style directory listing instead of letting Read fail with `EISDIR: illegal operation on a directory`.

Why: when Bash is broken (see companion ticket on session-env E2BIG), I lose Glob/LS-style enumeration capability entirely — the only tools left are Read/Write/Edit, and Read on a directory just errors out without showing what's inside. This makes recovery scenarios (where you need to find a file to truncate/move) impossible without external help.

Even outside the Bash-broken case, this would be a quality-of-life improvement: "list the directory" is a frequent intent, and we currently force the agent through Glob or Bash `ls` for it. A PreToolUse hook that does `if isdir(path): emit listing as tool_result, decision=block` would short-circuit the EISDIR error and serve the obvious intent.

Implementation notes:
- Hook should match PreToolUse for tool `Read`.
- Check `stat(input.file_path)` — if directory, run a bounded listing (e.g., top 200 entries with size/mtime, like `ls -la`) and emit it as the tool response with decision: "block" + reason explaining we showed listing instead.
- Keep output bounded so listing a huge dir doesn't blow context.
- Could live in agent-utils plugin (or a new tiny utility plugin).

Source: Nate Discord 2026-05-27 ~19:58Z, after I got stuck unable to enumerate `~/.agents/alex/.claude/session-env/`.
