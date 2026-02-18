# Architecture Doc Review — Pre-Addition Audit

**Reviewer:** Wile E. Coyote (AI Agent Engineer)
**Date:** 2026-02-16
**File:** `~/src/nsheaps/agent-team/docs/specs/draft/agent-team-architecture.md`
**Task:** #128

Reviewing for contradictions and gaps before incoming additions (#118 I/O proxy, #125 team names, #126 display names, #127 agent creation).

---

## Internal Contradictions

### 1. Tool Configuration: Config-Time vs Runtime (§2 vs §7)

**§2 (Per-Agent Tool Sets)** defines tool sets as static YAML config:

```yaml
tools:
  - messaging
  - tasks
```

**§7 (I/O Proxy)** describes "runtime tool stripping" as a dynamic proxy capability: "tools can be added/removed without restarting the agent."

These are complementary but the doc never explicitly says "§2 is static config, §7 is dynamic runtime override." Without this, implementers may be confused about which mechanism controls tool access — or whether they're the same thing.

**Recommendation:** Add a clarifying note in §7 referencing §2: "The static tool set (§2) defines the agent's baseline capabilities. The I/O proxy can further restrict or modify tools at runtime."

### 2. I/O Proxy Duplication (Architecture §7 vs Agent Wrapper PRD)

Architecture §7 and agent-wrapper PRD (lines 143-174) both describe the I/O proxy concept with near-identical content. The agent-wrapper PRD cross-references back to architecture §7, which is good. But having the same design rationale in two places invites drift.

**Recommendation:** One should be the source of truth, the other should reference it. Since the agent-wrapper PRD is about the `agent` CLI specifically, it should own the I/O proxy design. Architecture §7 should summarize and cross-reference.

### 3. Three Different "Agent YAML" Concepts

The ecosystem now has three YAML-related agent configs that could confuse implementers:

| Concept                    | Location                                                      | Purpose                                                     |
| -------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Claude Code agent files    | `.claude/agents/{name}.md` (YAML frontmatter + markdown body) | Current agent prompts in agent-team repo                    |
| Architecture §4 agent.yaml | `agents/{name}/agent.yaml` (proposed)                         | Full agent definition (tools, container, permissions, mesh) |
| Agent wrapper .agent.yaml  | `.agent.yaml` (project root)                                  | Launch config for the agent CLI                             |

No document acknowledges all three or explains the relationship/migration path between them.

**Recommendation:** Add a table or note explaining that `.claude/agents/*.md` is the current Claude Code format, `agents/{name}/agent.yaml` is the future target, and `.agent.yaml` is project-level config.

### 4. Relationship Table Incomplete (§8)

The table maps 4 PRDs to architecture sections. But:

- §7 (I/O Proxy) is missing — it directly relates to the Agent Wrapper PRD
- §1 (Security Consultant) has no PRD relationship listed
- §2 (Per-Agent Tool Sets) has no PRD relationship listed

**Recommendation:** Expand the table to cover all architecture sections.

---

## Gaps

### 5. MVP Boundary Unclear in Body Sections

The MVP section (lines 9-21) clearly states the first 5 priorities (launch, kill, relaunch, health check, auto-cleanup). But §1-§7 are all post-MVP features with no markers. An implementer reading §3 (Docker Containers) could reasonably think it's in scope for the first release.

**Recommendation:** Add a visible divider: "---\n\n## Post-MVP Discussion Topics\n\nThe following sections are design discussions for future phases. None are in scope for the MVP." This prevents scope creep.

### 6. No Migration Path from Current Structure

No discussion of how the current `.claude/agents/*.md` format evolves into the proposed `agents/{name}/` directory structure (§4). Questions unanswered:

- Do both formats coexist during transition?
- Does the agent CLI read both?
- Is there a migration tool?

### 7. No Mention of Existing `claude-team` Script

The architecture discusses the agent CLI (§7) but never acknowledges `bin/claude-team` in claude-utils — the script that currently performs agent team launches. The migration path from claude-team to the new agent CLI isn't documented. This is directly relevant to Task #117 (my next assigned task).

### 8. A2A vs Mesh MCP Ambiguity (§6)

§6 lists as an open question: "Whether A2A replaces or complements the mesh MCP server." But the mesh MCP PRD is already more developed and has been QA'd. Suggesting A2A might "replace" it creates uncertainty about the communication architecture. The mesh MCP PRD doesn't mention A2A at all.

**Recommendation:** Clarify that mesh MCP is the committed direction. A2A is a future complementary option, not a replacement candidate.

---

## Cross-Spec Contradictions

### 9. Language Decision Stale in Agent Wrapper PRD

Architecture doc header: "TypeScript + Bun (all components). Exception: K8s controller (Go)."

Agent wrapper PRD §Technology (lines 77-101): Still presents a three-way comparison (bunx vs Rust vs Go) with "Recommendation (needs user decision)." This was written before the language decision and is now stale.

**Impact:** Low — the PRD was already updated to reflect TS/Bun per Task #91, but the comparison table and recommendation section still read as if undecided.

### 10. Agent Wrapper Open Question #2 Now Answerable

Agent wrapper PRD open question #2: "How does `agent` interact with agent-team's orchestration? Does the orchestrator call `agent launch` for each teammate?"

Architecture §7 (I/O Proxy) now answers this — the agent CLI wraps the framework binary. The orchestrator would call `agent launch` which proxies to `claude`. This should be moved from "open question" to "answered."

---

## Pre-Assessment for Incoming Additions

| Incoming                | Task | Current State in Doc               | Risk                                                  |
| ----------------------- | ---- | ---------------------------------- | ----------------------------------------------------- |
| I/O Proxy               | #118 | Already present as §7              | Duplication with agent-wrapper PRD (contradiction #2) |
| Customizable team names | #125 | Implicit in session paths only     | No discussion of naming, uniqueness, or conventions   |
| Display name format     | #126 | §4 has `name` + `character` fields | No format spec, no display rules                      |
| Agent creation workflow | #127 | §4 has structure but no workflow   | No "how to create a new agent" procedure              |

---

## Summary

| #   | Finding                                  | Severity | Type          |
| --- | ---------------------------------------- | -------- | ------------- |
| 1   | Static vs runtime tool config ambiguity  | Medium   | Contradiction |
| 2   | I/O Proxy duplicated in two docs         | Medium   | Contradiction |
| 3   | Three "agent YAML" concepts unnamed      | High     | Gap           |
| 4   | Relationship table incomplete            | Low      | Gap           |
| 5   | MVP boundary unclear in body             | High     | Gap           |
| 6   | No migration path for agent file format  | Medium   | Gap           |
| 7   | claude-team script not acknowledged      | Medium   | Gap           |
| 8   | A2A vs mesh MCP ambiguity                | Medium   | Contradiction |
| 9   | Language decision stale in wrapper PRD   | Low      | Cross-spec    |
| 10  | Wrapper PRD open question now answerable | Low      | Cross-spec    |

No findings warrant failure log entries — these are spec quality issues, not process failures. The doc is well-structured for a brainstorming/requirements-gathering document. The main risk is that incoming additions (#118, #125-#127) will compound the existing gaps if they aren't addressed first.
