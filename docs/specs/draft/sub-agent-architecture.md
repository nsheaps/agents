---
name: sub-agent-architecture
status: draft
description: Architecture for sub-agents used by orchestrators for parallelized work including model selection and task routing
parent: model-routing-strategy
related:
  - model-routing-strategy
  - agent-harness-lifecycle
owner: jack
created: 2026-04-07
updated: 2026-04-07
tags:
  - architecture
  - sub-agents
  - model-routing
---
# Sub-Agent Architecture

## Problem Statement

The agent system uses sub-agents for parallelized work (research, code changes, PR
reviews). Without a clear model-selection strategy, sub-agents default to the parent
model (Opus), which is expensive for mechanical tasks. A tiered model routing strategy
was researched and decided upon but not yet codified as a spec.

## Design Decisions

1. **Three-tier model hierarchy**:
   - Tier 1 (Orchestrator): Opus 4.6 — complex decisions, handler communication,
     high context (1M window).
   - Tier 2 (Quality sub-agents): Sonnet 4.6 — PR reviews, code changes, research,
     planning (~80–90% of Opus quality at ~20% cost).
   - Tier 3 (Mechanical sub-agents): Haiku 4.5 — dashboard updates, simple git ops,
     template filling, file formatting.
   Source: `docs/research/model-cost-optimization.md`.

2. **Sonnet 4.6 with high thinking effort ≈ Opus with low thinking effort**: For
   quality-sensitive sub-agent tasks, Sonnet 4.6 with `high` thinking effort gives
   comparable results to Opus at ~5× lower cost. Source: model-cost-optimization
   research, section on "Thinking effort controls".

3. **Sequential-thinking MCP reserved for Haiku**: Native extended thinking is more
   cost-effective than sequential-thinking MCP tool calls when using Sonnet/Opus.
   The MCP tool is appropriate only for Haiku (which lacks native thinking) or when
   visible step-by-step reasoning is explicitly needed. Source: model-cost-optimization
   research, section 4.

4. **Sonnet 4.6 context window constraint**: Sonnet has a 200K token context window vs
   Opus's 1M. Deep-research sub-agents that accumulate many source files may hit this
   limit. This is an acknowledged trade-off. Source: model-cost-optimization research,
   "Critical Review Notes".

5. **GLM models not suitable for Claude Code sub-agents**: GLM-4 models use a different
   tool-use protocol than Claude Code's sub-agent system. Using them as Claude Code
   sub-agents would require a compatibility layer that does not currently exist.
   Source: model-cost-optimization research, section 5.

6. **LiteLLM for cost tracking, not for cross-provider routing**: Setting
   `ANTHROPIC_BASE_URL` to a LiteLLM proxy can provide cost monitoring without routing
   sub-agents to non-Claude models. Transparent GLM routing through Claude Code is not
   feasible due to API format incompatibility. Source: model-cost-optimization research,
   section 6.

7. **Cloudflare AI Gateway already active**: The `heaps-ai` gateway is configured via
   `ANTHROPIC_BASE_URL` and provides aggregate token/cost metrics. It does not provide
   per-request latency breakdowns. Source: `docs/research/api-proxy-observability.md`.

8. **Estimated daily cost with optimal model mix**: ~$2.19/day for 10 sub-agent tasks
   (3 PR reviews on Sonnet, 3 code changes on Sonnet, 2 research tasks on Sonnet,
   2 background tasks on Haiku). vs ~$11.31/day if all tasks run on Opus.
   Source: model-cost-optimization research, section 7.

9. **CLAUDE_SETTINGS_DIR isolation required before multi-agent**: Running multiple
   agents on a shared machine with a shared `~/.claude/` causes cross-contamination of
   settings, plugin configs, and credentials. Per-agent settings directories must be
   implemented before safely adding more agents. Source: nsheaps/agents issue #116.

## Open Questions

- Does the `Task` tool support specifying a model for sub-agents, or only hook agents?
  The `model` parameter is confirmed for hook agents (`TaskCompleted` hook uses
  `claude-haiku-4-5-20251001`), but Task-tool-launched agents may inherit the parent
  model.
- What are the actual per-task token counts for the current Jack workload? Real data
  from OTEL telemetry is needed to validate the cost projections.
- Should Jack (the orchestrator) be run on Sonnet instead of Opus? Quality impact of
  doing so is unvalidated.

## References

- `docs/research/model-cost-optimization.md` in ai-agent-jack — full model comparison
- `docs/research/api-proxy-observability.md` in ai-agent-jack — Cloudflare AI GW status
- nsheaps/agents issue #116 (CLAUDE_SETTINGS_DIR isolation)
- nsheaps/.ai-agent-jack `settings.json` — Haiku configured for TaskCompleted hook
