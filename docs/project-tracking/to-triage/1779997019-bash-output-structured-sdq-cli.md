---
type: feature
id: ""
state: triage
created: 2026-05-28T19:34:22Z
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: nate-discord-sdq
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509641003160699121
events:
  - {
      ts: 2026-05-28T19:34:22Z,
      by: alex,
      change: "created — captured from Nate Discord msg 1509641003160699121",
    }
---

# PostToolUse hook — save large parseable Bash output + require sdq-cli

## Original ask

From Nate (Discord [2026-05-28T19:34:22Z][^nate-discord-sdq]):

> if the return type of a bash tool is > 5 lines and is parseable by json, yaml, xml, toon or tron, that it saves to file and forces you to use sdq-cli to query the data. This is blocked by the sdq implementation which might not have a ticket yet too

## Goal

Add a PostToolUse hook on the Bash tool. When `tool_response` is >5 lines AND the output parses as JSON, YAML, XML, TOON, or TRON:

1. Save the output to a file under `.claude/tmp/bash-output/` (timestamped or content-hashed filename)
2. Emit `additionalContext` instructing the agent to use `sdq-cli` for queries instead of re-running bash or inline parsing

## Acceptance criteria

- Hook fires only for Bash tool PostToolUse events
- Threshold: >5 lines of output
- Formats detected: JSON, YAML, XML, TOON, TRON
- Saved file path surfaced in additionalContext
- Agent receives clear instruction to use `sdq-cli <file> <query>` syntax
- Non-parseable output passes through unchanged

## Blocked by

- `1779997019-sdq-cli-implementation.md` — sdq-cli must exist before this hook is useful

[^nate-discord-sdq]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509641003160699121
