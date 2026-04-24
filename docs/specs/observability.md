---
name: observability
status: draft
description: Observability stack for agent request latency, token usage, cost breakdowns, and tool execution timing
parent:
related:
  - model-routing-strategy
  - agent-harness-lifecycle
owner: jack
created: 2026-04-07
updated: 2026-04-07
tags:
  - observability
  - monitoring
  - cost
  - telemetry
---

# Observability

## Problem Statement

The handler needs visibility into why the agent is slow: request latency, token usage,
cost breakdowns, and tool execution timing. Currently the only active observability is
the Cloudflare AI Gateway, which provides aggregate metrics but no per-request detail
or latency data.

## Design Decisions

1. **Cloudflare AI Gateway already active** (aggregate metrics only): The `heaps-ai`
   gateway (`ANTHROPIC_BASE_URL` configured in `~/.claude/settings.json`) provides
   total request count, token usage, cost estimates, and error rates. It does not
   provide per-request latency or request/response bodies.
   Source: `docs/research/api-proxy-observability.md`.

2. **Claude Code built-in OTEL is the recommended next step**: Claude Code emits OTEL
   metrics and events natively when `CLAUDE_CODE_ENABLE_TELEMETRY=1` is set. Key events
   include `claude_code.api_request` (with `duration_ms`) and `claude_code.tool_result`
   (with `duration_ms`). The `prompt.id` attribute correlates all events from a single
   user prompt, enabling full lifecycle traces.
   Source: `docs/research/api-proxy-observability.md`, section 2.

3. **New Relic free tier as the OTEL backend**: The pattern from `nsheaps/claude-code-sessions`
   uses New Relic as the OTLP backend. Reusing this pattern for agent observability
   avoids new infrastructure. Self-hosted alternative:
   [claude-code-otel](https://github.com/ColeMurray/claude-code-otel) Docker Compose
   stack (Prometheus + Loki + Grafana).
   Source: `docs/research/api-proxy-observability.md`, section 2.

4. **OTEL and Cloudflare AI Gateway are complementary**: OTEL provides per-request
   detail; Cloudflare AI Gateway provides aggregate billing-level visibility. Both
   should be active simultaneously. Source: `docs/research/api-proxy-observability.md`,
   "Key Insight".

5. **ccusage for ad-hoc session analysis**: `npx ccusage@latest` reads local Claude
   Code session files to compute token usage per session, day, and project. Zero
   infrastructure, no latency data. Useful for quick spot-checks between OTEL queries.
   Source: `docs/research/api-proxy-observability.md`, section 3.

6. **otel-cli for custom hook spans**: `otel-cli exec` wraps CLI commands in OTEL spans
   and is already used in `nsheaps/claude-code-sessions` hooks. Can be added to Jack's
   hooks to track hook execution timing as custom spans in the same OTEL backend.
   Source: `docs/research/api-proxy-observability.md`, section 4.

7. **Cloudflare AI Gateway auth token must move to 1Password**: The
   `cf-aig-authorization` token is currently stored in plaintext in
   `~/.claude/settings.json`. It should be injected via `op://` reference.
   Source: `docs/research/api-proxy-observability.md`, "Security Note".

8. **LiteLLM proxy not recommended**: LiteLLM is heavy (Python server + database),
   overlaps with Cloudflare AI Gateway, and may interfere with Claude Code's streaming.
   The built-in OTEL provides the same per-request visibility with less overhead.
   Source: `docs/research/api-proxy-observability.md`, section 6.

9. **No queue wait time visibility**: Time spent in Anthropic's request queue is not
   observable from outside Anthropic's infrastructure. The `duration_ms` in OTEL
   events includes total round-trip time but not queue-specific breakdown.
   Source: `docs/research/api-proxy-observability.md`.

## Open Questions

- Which OTEL backend should be used: New Relic free tier (reuse existing pattern) or
  self-hosted claude-code-otel stack?
- Should OTEL telemetry be added to Jack's settings now, or wait until a dedicated
  monitoring setup task?
- Should otel-cli be added to Jack's hooks as a Phase 2 step, or is built-in OTEL
  sufficient for the handler's visibility needs?

## References

- `docs/research/api-proxy-observability.md` in ai-agent-jack — full comparison of options
- [Claude Code Monitoring docs](https://code.claude.com/docs/en/monitoring-usage)
- [claude-code-otel Docker Compose stack](https://github.com/ColeMurray/claude-code-otel)
- [Cloudflare AI Gateway Analytics](https://developers.cloudflare.com/ai-gateway/observability/analytics/)
- `nsheaps/claude-code-sessions` — reference OTEL + New Relic pattern
