Give the agent first-class Move and Delete tools, so the file-manipulation primitives aren't just Read/Write/Edit (which together force a 3-step Read→Write-new→Write-empty-old dance to "move" a file, and don't really support delete at all).

The trigger: 2026-05-27 recovery scenario where Bash was broken (E2BIG) and Nate asked me to rename a session-env file to .bak. With only Read/Write/Edit, the safe move is:

1. Read source
2. Write content to dest path
3. Write empty/zero-content to source

That's three tool calls, breaks atomicity (a Read→Write race could lose data), and doesn't actually delete the source — it just truncates it. Delete proper isn't possible at all without Bash.

A first-class Move tool would be `Move({source, dest})` — atomic rename, single tool call, no read+rewrite round-trip. A Delete tool would be `Delete({path})` with optional confirmation gate via hook (probably want a PreToolUse safety check on dangerous paths).

Pairs well with the Read-on-dir hook ticket — together they give the agent a complete minimal filesystem capability set that works even when Bash is unavailable. Today, "Bash broken" = "agent helpless for any file operation beyond reading or appending."

Source: Nate Discord 2026-05-27 20:01Z, after the move-via-Read+Write awkwardness during the session-env recovery.
