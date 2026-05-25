---
type: feature
created: 2026-05-25T21:24:20Z
state: to-triage
project: GSD
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508581415829377065
events:
  - { ts: 2026-05-25T21:24:20Z, by: alex, change: "created from Discord ask[^discord-ask]" }
---

# Plugin: brain-utils — thought / feeling / memory management with auto-record hooks

## Original Discord message

> New triage tic
> Plugin brain-utils
> Manages thoughts, feelings, memories, with tools to extract thoughts, maybe journaling? And hooks to auto record and recall thoughts, skill for key phrases. Like mcp memory + Claude memory on steroids. Hooks extract thoughts per task, add to memory, call memory is one giant relational document graph

Source: Discord msg[^discord-ask] (2026-05-25 21:23Z)

## Goal

A `brain-utils` plugin that gives an agent a richer cognitive layer than the current memory-files-in-`memory/` directory provides: structured storage for **thoughts**, **feelings**, and **memories** as distinct first-class concepts, with automatic capture hooks (extract per task), recall hooks (surface relevant prior context on demand), and a unified relational graph as the underlying store.

## Why now

Today's memory model is:

- Flat markdown files in `memory/` (per-agent, repo-checked-in)
- Type implied by filename convention (e.g. `feedback_*`, `reference_*`, `project_*`, `user_*`)
- Recall happens at session-start by loading `MEMORY.md` index + lazy-reading individual entries
- No structured cross-linking; no "feelings" or "thoughts" as separate types; no auto-capture

This works but loses richness — the texture of a debugging frustration, the satisfaction-of-shipping moment, the "aha" insight that fed into a later decision. Journal entries capture some of this in narrative form, but they're write-only / read-rarely.

A relational graph backend lets thoughts/feelings/memories cross-reference each other (e.g. a "feeling: frustrated with redact-secrets PR loop" node could link to the "memory: redact-secrets debug session" node + the "thought: maybe we need different tool ergonomics" node). Recall queries can traverse — "what was I feeling when I worked on PR #X?" — rather than grep across flat files.

## Sketch of components

- **Thoughts** — short-lived working state ("I think the issue is the rebase race"). Extracted per-task by a hook. May graduate to a memory.
- **Feelings** — affective annotations on tasks/decisions/incidents ("frustrated", "satisfied", "uncertain"). Captured by hook OR self-annotation. Surface in journal entries.
- **Memories** — durable cross-session knowledge (current `memory/` files conceptually fit here).
- **Auto-record hooks** — PostToolUse or Stop hooks that scan transcripts for thought/feeling markers (key phrases) and emit graph nodes.
- **Recall skill** — given a query (key phrase, task, time range), traverse the graph and return relevant nodes for context-injection.
- **Storage** — relational graph (sqlite? duckdb? json-graph? TBD). Probably file-backed for git compatibility.

## Comparison points

- **mcp-memory** server (Anthropic upstream) — flat key-value, no graph
- **Claude memory** (built-in) — internal, opaque; only auto-applied
- This plugin would aim to be "mcp memory + Claude memory on steroids" per Nate

## Acceptance criteria (rough — needs triage)

- Plugin scaffold exists at `plugins/claude-code/brain-utils/`
- Spec doc describes the graph schema (node types, edge types, query model)
- At least one capture hook + one recall skill demonstrably wire end-to-end
- Migration path for existing `memory/` flat files into graph nodes

## Notes

- Related to (but distinct from) the `dreaming` plugin (M6) — dreaming is about asynchronous rewrite/reflection; brain-utils is about online capture + recall.
- Related to `defining-scope-and-cleaning-git-state` milestone (M5) which mentions `incident-utils` — incidents could attach feeling nodes.
- The journal-writing skill could plug into this — journal entries become a serialized projection of the graph for a given day.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508581415829377065
