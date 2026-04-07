---
status: draft
---
# Model Routing Strategy

## Problem Statement

As agent workloads grow, running all tasks on the most capable (and most expensive)
model is not sustainable. A tiered routing strategy is needed to assign the right model
to each task type, balancing quality and cost.

## Design Decisions

1. **Primary orchestrator stays on Opus 4.6**: Jack (the main orchestrator) uses Opus
   4.6 with 1M context window. The orchestrator benefits from maximum reasoning
   capability and large context for reading many files. No change recommended here.
   Source: `docs/research/model-cost-optimization.md`, "Recommended Strategy".

2. **Quality sub-agents use Sonnet 4.6**: PR reviews, code changes, research synthesis,
   and planning tasks are routed to Sonnet 4.6 (`claude-sonnet-4-6-20250514`) with
   high thinking effort. Quality is ~90% of Opus at ~20% of cost.
   Source: model-cost-optimization research, sections 2–3.

3. **Mechanical sub-agents use Haiku 4.5**: Background tasks (dashboard updates, file
   formatting, simple git operations, template filling) use Haiku 4.5
   (`claude-haiku-4-5-20251001`). Already in use for the TaskCompleted hook.
   Source: model-cost-optimization research, section 3.

4. **Thinking effort levels**:
   - Orchestrator: medium (saves tokens while maintaining decision quality)
   - Quality sub-agents: high (Sonnet+high ≈ Opus+low in practice)
   - Mechanical sub-agents: not applicable (Haiku lacks extended thinking)
   Source: model-cost-optimization research, section 2.

5. **Task-type suitability matrix** (from research):
   - Complex architecture decisions → Opus
   - PR review with nuanced feedback → Sonnet (high thinking)
   - Code edits, commit, push → Sonnet (medium thinking)
   - Research synthesis → Sonnet (high thinking)
   - Dashboard updates → Haiku
   - Simple git operations → Haiku
   - File reading/summarization → Haiku
   - Tool-heavy orchestration → Sonnet
   Source: model-cost-optimization research, section 3.

6. **No automatic complexity-detection routing**: LiteLLM and other routers do not
   provide built-in complexity detection. Model selection must be explicit at the
   call site. A lightweight classifier could be built as a future step but is not
   currently designed. Source: model-cost-optimization research, section 6.

7. **Cost monitoring via Cloudflare AI Gateway** (already active): The `heaps-ai`
   gateway provides aggregate request count, token usage, and cost estimates. It does
   not support per-request latency or custom attributes. Adding Claude Code's built-in
   OTEL telemetry (pointing to New Relic free tier) is the recommended next step for
   per-request latency and `prompt.id` correlation.
   Source: `docs/research/api-proxy-observability.md`.

8. **LiteLLM as ANTHROPIC_BASE_URL proxy**: LiteLLM can serve as a cost-tracking proxy
   by setting `ANTHROPIC_BASE_URL` to the LiteLLM endpoint with Anthropic as backend.
   This does not enable cross-provider routing for Claude Code sub-agents; it only adds
   a tracking layer. Not currently deployed.
   Source: model-cost-optimization research, section 6.

## Open Questions

- What are the actual per-task token counts for the current Jack workload? Real OTEL
  data is needed to replace the cost estimates in the research doc.
- Does the `Task` tool support a `model` parameter, or do Task-tool sub-agents always
  inherit the parent session's model?
- Should a model selection skills document be created to help sub-agents self-select
  the right tier for their task type?

## References

- `docs/research/model-cost-optimization.md` in ai-agent-jack — full analysis
- `docs/research/api-proxy-observability.md` in ai-agent-jack — Cloudflare AI GW,
  OTEL telemetry options
- [Anthropic API Pricing](https://www.anthropic.com/pricing)
- [Anthropic Extended Thinking docs](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
- [Claude Code monitoring docs](https://code.claude.com/docs/en/monitoring-usage)
