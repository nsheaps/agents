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

# sdq-cli implementation

## Original ask

From Nate (Discord [2026-05-28T19:34:22Z][^nate-discord-sdq]):

> if the return type of a bash tool is > 5 lines and is parseable by json, yaml, xml, toon or tron, that it saves to file and forces you to use sdq-cli to query the data. This is blocked by the sdq implementation which might not have a ticket yet too

## Goal

Implement `sdq-cli` — a structured data query CLI tool for querying files in JSON, YAML, XML, TOON, and TRON formats. This tool is used by agents in place of raw shell parsing when bash output or saved data files need to be queried.

## Acceptance criteria

- `sdq-cli` installed and available in the agent environment
- Supports querying JSON, YAML, XML, TOON, and TRON format files
- Query interface suitable for use in PostToolUse hooks (non-interactive, scriptable)
- Returns structured or line-oriented output for downstream use

## Blocks

- `1779997019-bash-output-structured-sdq-cli.md` — PostToolUse hook that redirects large parseable bash output to files and requires sdq-cli for queries

[^nate-discord-sdq]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509641003160699121
