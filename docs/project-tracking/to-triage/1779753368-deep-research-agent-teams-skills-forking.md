---
type: research
created: 2026-05-25T23:55:17Z
state: to-triage
priority: 3
project: GSD
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508619501350944959
events:
  - { ts: 2026-05-25T23:55:17Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:18:27Z,
      by: alex,
      change: "priority (unset) → 3 per Nate Discord[^discord-prio]",
    }
---

# Deep research: agent teams, skills, agents, forking, --agent flag

## Original Discord message

> add a triage task to deeply research docs and examples for teammates/agent teams, skills, agents, forked subagents, forked skills, agents, agent prompts, --agent flag passed to claude. Come up with a good approach of what to suggest. Compare your approach to whats in our docs. Link your comparison research in the arch draft under an open questions section

Source: Discord msg[^discord-ask] (2026-05-25 23:55Z)

## Goal

Produce a comprehensive research note covering Claude Code's primitives for multi-agent and reusable-behavior work, then recommend a synthesized approach and compare it to what's already documented in our architecture.

## Topics to cover (deep dive each)

1. **teammates / agent teams** (`/teammates`, team mode, `teammateMode: tmux`) — how teams differ from sub-agents, when to use each.
2. **skills** — invocation, frontmatter, `context: fork`, model overrides, `tools:` allowlist, where they live (project / plugin / user).
3. **agents** (`.claude/agents/*.md`) — subagent definitions, dispatch via the `Agent` tool, `subagent_type` param.
4. **forked subagents** — the `Agent` tool's spawned context vs the caller's context; what's preserved (env, cwd) vs not (chat history).
5. **forked skills** — `context: fork` semantics; how the forked skill returns to the caller; whether it can use a different model.
6. **agent prompts** — the system-prompt construction for sub-agents; CLAUDE.md inheritance; the role of `description:` in agent files.
7. **`--agent` flag passed to claude** — what it does at the CLI; whether it's how agent teams are dispatched; how this differs from `Agent` tool calls.

For each: find the canonical doc, find at least one real example (in our repos, the official docs, or community examples), and capture concrete code/config snippets.

## Deliverables

1. Research note in `docs/research/agent-primitives-2026-05-26.md` (alex repo) — one section per topic, each with citations + examples.
2. Synthesis section at the end: **"Recommended approach for our agent-team work"** — when to use which primitive, the decision tree, and the gotchas.
3. Comparison section: line up the recommended approach against what's currently in `nsheaps/agents/ARCHITECTURE_DRAFT.md` — what aligns, what diverges, what's missing on either side.
4. PR to `nsheaps/agents` adding an entry under **Open Questions** in `ARCHITECTURE_DRAFT.md` that links to the comparison research note.

## Approach notes (for triage agent)

- Should be a feature ticket (research deliverable + arch-draft PR).
- Likely milestone: M2 (agent consistency / setup) or M11 (improve plugin + skill writing). Triage agent decides.
- The research itself should be dispatched as a sub-agent (`deep-research:lead-researcher` looks right per available agents) — `run_in_background: true`, `isolation: "worktree"` if any PR work.
- Do NOT dispatch this as urgent — it's a backlog research item, not blocking other work.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508619501350944959

[^discord-prio]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684>
