---
type: feature
id: GSD-55
legacy_ids:
  - "1779912331"
created: 2026-05-27T20:05:31Z
state: triage
project: GSD
priority: 4
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1779912331
events:
  - { ts: 2026-05-27T20:05:31Z, by: nsheaps, change: "created from Discord ask[^discord-ask]" }
  - { ts: 2026-05-28T02:02:06Z, by: alex-triager, change: "promoted to-triage → GSD-55 (state=triage) per triager-v2 workflow" }
---

# GSD-55 — Move/Delete tools for agent

## Original ask

Give the agent first-class Move and Delete tools, so the file-manipulation primitives aren't just Read/Write/Edit (which together force a 3-step Read→Write-new→Write-empty-old dance to "move" a file, and don't really support delete at all).

The trigger: 2026-05-27 recovery scenario where Bash was broken (E2BIG) and Nate asked me to rename a session-env file to .bak. With only Read/Write/Edit, the safe move is:

1. Read source
2. Write content to dest path
3. Write empty/zero-content to source

That's three tool calls, breaks atomicity (a Read→Write race could lose data), and doesn't actually delete the source — it just truncates it. Delete proper isn't possible at all without Bash.

Source: Nate Discord[^discord-ask] (2026-05-27 20:01Z)

## Goal

Add first-class `Move({source, dest})` and `Delete({path})` tools to the agent's capability set, so file operations are atomic and work even when Bash is unavailable.

- `Move({source, dest})` — atomic rename, single tool call, no read+rewrite round-trip.
- `Delete({path})` — proper file removal, with optional confirmation gate via PreToolUse safety hook on dangerous paths.

## Scope

In:

- `Move` tool: atomic filesystem rename — wraps OS-level `rename(2)` so the operation is either complete or not (no partial state).
- `Delete` tool: filesystem unlink — removes the file at the given path. Hook-gated for paths that match dangerous patterns (e.g. outside the project root, hidden config files).
- PreToolUse safety hook for `Delete` (and optionally `Move`) to block or warn on sensitive path patterns.

Out:

- Directory move/delete (initially; single-file scope only).
- Networked / remote filesystem operations.

## Connection to other tickets

Pairs well with the Read-on-dir hook ticket (GSD-54) — together they give the agent a complete minimal filesystem capability set that works even when Bash is unavailable. Today, "Bash broken" = "agent helpless for any file operation beyond reading or appending."

## Acceptance criteria

1. `Move({source, dest})` tool available; single tool call renames a file atomically.
2. `Delete({path})` tool available; removes the file.
3. PreToolUse hook blocks or warns when `Delete` (or `Move` source) targets a sensitive path.
4. Both tools work in a Bash-unavailable context (E2BIG or equivalent).
5. Documentation / SKILL.md updated to describe the new primitives.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1779912331
