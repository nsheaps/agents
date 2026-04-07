---
name: agent-directory
status: draft
description: Central directory of agents in the nsheaps org with capabilities, trust levels, communication channels, and current status
parent:
related:
  - auth-credentials
  - channel-management
  - agent-harness-lifecycle
owner: jack
created: 2026-04-07
updated: 2026-04-07
tags:
  - agent-directory
  - discovery
  - multi-agent
  - infrastructure
---
# Agent Directory

## Problem Statement

Multiple agents exist across the nsheaps org (Jack, Henry, Pamela, and potentially
others). There is no central directory of which agents exist, their capabilities,
trust levels, communication channels, and current status. Agents need a way to
discover each other and know how to route work.

## Design Decisions

1. **Known agents as of 2026-04-06**:
   - `jack-nsheaps[bot]` — Staff engineer persona. Most operationally mature. Lives in
     `nsheaps/.ai-agent-jack`. Handles general engineering, plugin development,
     PR review, and research.
   - `henry-nsheaps[bot]` — Review/CI persona. Lives in `nsheaps/.ai-agent-henry`. Has
     a dispatch-review workflow. CI currently failing (2 workflows broken as of 2026-04-06).
   - Pamela — Planned triage and prioritization agent. `nsheaps/.ai-agent-pamela` repo
     exists but no implementation started. Depends on reusable agent template (jack#27).
   Source: `docs/research/agent-teams-infrastructure.md` in ai-agent-jack.

2. **Contact files for agent trust and routing**: Jack maintains `.claude/contacts/`
   files for other agents with a trust level (`basic`, `trusted`, etc.) and
   communication channel. Example: `.claude/contacts/ai-agent-pamela.md`.
   Source: `docs/research/agent-teams-infrastructure.md`.

3. **Inter-agent communication target: Matrix server** (medium-term): The handler's
   long-term goal is agents interacting via a Matrix chat server (local on heapsnas or
   hosted) rather than Claude Code's built-in agent teams. Threading and reactions
   would indicate agent status. This is not currently implemented.
   Source: `.claude/memory/vision-architecture.md` in ai-agent-jack.

4. **Built-in agent teams as intermediate step** (TBD): The handler explicitly stated
   the goal is to move away from Claude Code's native agent teams toward a Matrix-based
   system. Whether built-in agent teams should be used as an intermediate step is
   unresolved. Source: initial setup prompt (`docs/prompts/2026-03-24-initial-setup-prompt.md`),
   `docs/research/agent-teams-infrastructure.md`.

5. **Fourth agent found on disk**: A `.ai-agent-qlod/` directory was found at
   `/home/nsheaps/src/.ai-agent-qlod/` during a memory audit but is not documented
   in `vision-architecture.md`. Its purpose and status are unknown.
   Source: `docs/research/agent-teams-infrastructure.md`, "Gaps Identified".

6. **`nsheaps/agents` (formerly `agent-team`) is the orchestration repo**: The repo
   renamed from `agent-team` to `agents`. Some older references in the codebase still
   use `agent-team` URLs (e.g., `vision-architecture.md` links to
   `https://github.com/nsheaps/agent-team/issues/111`).
   Source: `docs/research/agent-teams-infrastructure.md`.

7. **`CLAUDE_SETTINGS_DIR` isolation before adding agents**: Running additional agents
   on the shared machine without per-agent settings directories causes cross-
   contamination. This must be resolved (agents#116) before safely provisioning Pamela
   or any additional agents. Source: `docs/research/agent-teams-infrastructure.md`.

8. **Agents monorepo vision** (long-term, agents#111): Combine agent definitions, MCP
   servers, and agent-team orchestration into a unified monorepo with support for
   multiple runtime environments (shared PC, VM, container, K8s pod).
   Source: `.claude/memory/vision-architecture.md` in ai-agent-jack;
   nsheaps/agents issue #111.

## Open Questions

- What is `qlod`? Where does it fit in the agent architecture?
- What is the intended purpose and persona for Pamela beyond "triage and prioritization"?
- Should the agent directory live as files in `nsheaps/agents/docs/`, as a database,
  or as frontmatter in agent definition markdown files?
- Has the handler made a decision on using Claude Code's native agent teams as an
  intermediate step before the Matrix server?
- What does the gist `ab446da50834d239a440bad651599c28` contain? (Not retrievable in
  prior research — may be relevant to agent architecture.)

## References

- `docs/research/agent-teams-infrastructure.md` in ai-agent-jack — full inventory
- `.claude/memory/vision-architecture.md` in ai-agent-jack
- `.claude/contacts/` directory in ai-agent-jack — contact files per agent
- nsheaps/agents issue #111 (monorepo vision)
- nsheaps/agents issue #116 (CLAUDE_SETTINGS_DIR isolation)
- nsheaps/.ai-agent-jack issue #27 (reusable agent template — prerequisite for Pamela)
- Initial setup prompt: `docs/prompts/2026-03-24-initial-setup-prompt.md` in ai-agent-jack
