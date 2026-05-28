---
type: feature
state: triage
created: 2026-05-28T19:37:22Z
project: GSD
priority: 1
references:
  - id: nate-discord-1509641003160699121
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509641003160699121
events:
  - ts: 2026-05-28T19:37:22Z
    by: alex
    change: "created from Nate Discord message 2026-05-28T19:34:22Z"
---

# Bash | head / tail — rewrite to redirect-to-file

## Origin

Nate Discord 2026-05-28T19:34:22Z[^nate-discord-1509641003160699121]:

> "when bash is called with | head or | tail, modify the input to the tool to redirect to a file, then tail the outputted file and post a message to the agent saying what was done"

## Goal

Add a **PreToolUse hook on the Bash tool** that detects when a command contains `| head` or `| tail` (with optional flags/args), rewrites the command to redirect full output to a temp file, then tails that file to surface the requested lines — and injects `additionalContext` coaching text so the agent understands the transformation.

## Desired transformation

**Trigger:** Bash tool call whose `command` contains `| head` or `| tail` (anywhere in the pipeline).

**Rewrite (PreToolUse):**

1. Strip `| head [args]` or `| tail [args]` from the end of the command.
2. Append `> <tmpfile>` to redirect full output to a file (e.g. `.claude/tmp/bash-output-<timestamp>.txt`).
3. Append `; tail -n <N> <tmpfile>` (or `head -n <N>`) to show the requested lines from the file.
4. Return the rewritten command to the tool.

Example:

```
# Original
some-long-command | head -20

# Rewritten
some-long-command > .claude/tmp/bash-output-1779997042.txt; head -n 20 .claude/tmp/bash-output-1779997042.txt
```

## Desired additionalContext coach text

Inject a coach message (via `additionalContext` in the hook response) along the lines of:

> "Your command used `| head` or `| tail`. It has been rewritten to redirect full output to `.claude/tmp/bash-output-<ts>.txt` and then display the requested lines from that file. The full output is available at that path if you need more context."

## Acceptance criteria

- [ ] PreToolUse hook script exists (likely at `.claude/hooks/rewrite-bash-pipe-head-tail.sh` or similar).
- [ ] Hook fires on any Bash tool call whose `command` matches `| head` or `| tail` (case-insensitive, with optional flags).
- [ ] Rewritten command redirects full output to a file in `.claude/tmp/`.
- [ ] Rewritten command surfaces the originally-requested lines (head/tail N).
- [ ] `additionalContext` coach text is included in the hook response, describing the transformation.
- [ ] Hook is registered in `.claude/settings.json` under the appropriate `hooks` / `preToolUse` entry.
- [ ] Temp files do not accumulate unboundedly (either unique-named per run or cleaned by an existing sweep).
- [ ] Does not break commands that do not use `| head` or `| tail`.

## Notes

- Scope: alex's agent only unless explicitly broadened.
- Temp dir: `.claude/tmp/` per secrets-and-shared-machine rule.
- The hook should be idempotent — if the command is already redirected, don't double-redirect.

[^nate-discord-1509641003160699121]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509641003160699121
