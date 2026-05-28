---
type: feature
id: GSD-78
legacy_ids:
  - "1779997019-sdq-cli-implementation"
state: triage
created: 2026-05-28T19:34:22Z
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-677"
    note: "#677: AGENT(triage-3-tickets): Promote 3 just-filed to-triage tickets into GSD-N ticke"
  - id: nate-discord-sdq
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509641003160699121
events:
  - ts: 2026-05-28T19:34:22Z
    by: alex
    change: "created — captured from Nate Discord msg 1509641003160699121"
  - ts: 2026-05-28T19:39:01Z
    by: alex
    change: "promoted to-triage → GSD-78 (state=triage) per Nate Discord 1509642169932316742"
---

# GSD-78 — sdq-cli implementation

## Original ask

From Nate (Discord [2026-05-28T19:34:22Z][^nate-discord-sdq]):

> if the return type of a bash tool is > 5 lines and is parseable by json, yaml, xml, toon or tron, that it saves to file and forces you to use sdq-cli to query the data. This is blocked by the sdq implementation which might not have a ticket yet too

## Goal

Implement `sdq-cli` — a structured data query CLI tool for querying files in JSON, YAML, XML, TOON, and TRON formats. This tool is used by agents in place of raw shell parsing when bash output or saved data files need to be queried.

## User story

As **an agent**, I want a single CLI tool (`sdq-cli`) that can query structured data files in JSON, YAML, XML, TOON, and TRON formats, so that I don't have to rely on fragile shell pipelines to extract values from structured output.

## Stakeholders

- **Nate** (handler) — directive source
- **Alex** (subject) — primary consumer of sdq-cli in hooks and ad-hoc queries

## Acceptance criteria

- [ ] `sdq-cli` installed and available in the agent environment
- [ ] Supports querying JSON, YAML, XML, TOON, and TRON format files
- [ ] Query interface suitable for use in PostToolUse hooks (non-interactive, scriptable)
- [ ] Returns structured or line-oriented output for downstream use

## Blocks

- [GSD-79](./GSD-79-bash-output-structured-sdq-cli.md) — PostToolUse hook that redirects large parseable bash output to files and requires sdq-cli for queries

[^nate-discord-sdq]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509641003160699121
