---
type: feature
id: GSD-37
legacy_ids:
  - "1779744260"
  - "1779755952"
created: 2026-05-25T21:24:20Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-611"
    note: "#611: AGENT(triager-v2): Process to-triage chronologically per new spec (14 items)"
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508581415829377065
  - id: discord-dreaming-fold
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062
  - id: discord-prio
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684
events:
  - { ts: 2026-05-25T21:24:20Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T00:45:00Z,
      by: alex,
      change: "Nate: brain-utils owns M6 (dreaming) — dreaming is a subskill/component inside brain-utils[^discord-dreaming-fold]",
    }
  - {
      ts: 2026-05-26T01:18:27Z,
      by: alex,
      change: "priority (unset) → 1 per Nate Discord[^discord-prio]",
    }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-37 (state=triage); folded in 1779755952 (brain-utils owns M6) per triager-v2",
    }
---

# Plugin: brain-utils — thought/feeling/memory management with auto-record hooks (owns M6/dreaming)

## Original ask

> New triage tic
> Plugin brain-utils
> Manages thoughts, feelings, memories, with tools to extract thoughts, maybe journaling? And hooks to auto record and recall thoughts, skill for key phrases. Like mcp memory + Claude memory on steroids. Hooks extract thoughts per task, add to memory, call memory is one giant relational document graph

Source: Discord msg[^discord-ask] (2026-05-25 21:23Z)

## Folded-in: brain-utils owns M6 dreaming

> brain-utils which I mentioned earlier, should also be a part of m6 (dreaming), make dreaming part of brain-utils.

Source: Discord msg[^discord-dreaming-fold] (2026-05-26 00:45Z)

**Implication**: The `brain-utils` plugin becomes the M6 owner. `dreaming` becomes a subskill/component INSIDE brain-utils (not a separate plugin). Existing I38 (agentic-behavior self-rewrite, the "rubric + archive" skill) is conceptually adjacent but remains in ai-mktpl scope; the brain-utils dreaming component is about online thought/feeling capture + async consolidation. The M6 milestone file should be updated to point to GSD-37 as the primary ticket.

## Goal

A `brain-utils` plugin that gives an agent a richer cognitive layer than the current memory-files-in-`memory/` directory provides: structured storage for **thoughts**, **feelings**, and **memories** as distinct first-class concepts, with automatic capture hooks (extract per task), recall hooks (surface relevant prior context on demand), and a unified relational graph as the underlying store. **Dreaming is a subcomponent** — async rewrite/reflection/consolidation during idle periods.

## Why now

Today's memory model is:

- Flat markdown files in `memory/` (per-agent, repo-checked-in)
- Type implied by filename convention (e.g. `feedback_*`, `reference_*`, `project_*`, `user_*`)
- Recall happens at session-start by loading `MEMORY.md` index + lazy-reading individual entries
- No structured cross-linking; no "feelings" or "thoughts" as separate types; no auto-capture

This works but loses richness — the texture of a debugging frustration, the satisfaction-of-shipping moment, the "aha" insight that fed into a later decision. Journal entries capture some of this in narrative form, but they're write-only / read-rarely.

A relational graph backend lets thoughts/feelings/memories cross-reference each other. Recall queries can traverse rather than grep across flat files.

## Sketch of components

- **Thoughts** — short-lived working state ("I think the issue is the rebase race"). Extracted per-task by a hook. May graduate to a memory.
- **Feelings** — affective annotations on tasks/decisions/incidents ("frustrated", "satisfied", "uncertain"). Captured by hook OR self-annotation. Surface in journal entries.
- **Memories** — durable cross-session knowledge (current `memory/` files conceptually fit here).
- **Dreaming** — async consolidation subskill: during idle, review recent thoughts/feelings, rewrite/summarize into durable memories, prune stale nodes. Runs via cron or explicit invocation.
- **Auto-record hooks** — PostToolUse or Stop hooks that scan transcripts for thought/feeling markers (key phrases) and emit graph nodes.
- **Recall skill** — given a query (key phrase, task, time range), traverse the graph and return relevant nodes for context-injection.
- **Storage** — relational graph (sqlite? duckdb? json-graph? TBD). Probably file-backed for git compatibility.

## Comparison points

- **mcp-memory** server (Anthropic upstream) — flat key-value, no graph
- **Claude memory** (built-in) — internal, opaque; only auto-applied
- This plugin would aim to be "mcp memory + Claude memory on steroids" per Nate

## Acceptance criteria (rough — needs triage grooming)

- Plugin scaffold exists at `plugins/claude-code/brain-utils/`
- Spec doc describes the graph schema (node types, edge types, query model)
- At least one capture hook + one recall skill demonstrably wire end-to-end
- Dreaming subskill exists and can be triggered (idle cron or explicit)
- Migration path for existing `memory/` flat files into graph nodes
- M6 milestone file updated to reference this ticket as primary

## Notes

- **Dreaming is a subcomponent** of brain-utils per Nate's 00:45Z refinement. Existing I38 (agentic-behavior self-rewrite skill) is a separate deliverable in ai-mktpl; the brain-utils dreaming component focuses on online/async thought consolidation, not agentic-behavior ruleset rewriting.
- Related to the journal-writing skill — journal entries could become serialized projections of the brain-utils graph for a given day (potential integration point).
- Related to GSD-38 (start dream cycle ASAP) — that ticket is about urgency of the first dream run; this ticket is about building the underlying plugin.
- Related to `incident-utils` (M5) — incidents could attach feeling nodes.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508581415829377065

[^discord-dreaming-fold]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508632218023760062

[^discord-prio]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684
