# Research: Braintrust + OTEL for Agent/Task Differentiation (#140)

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-17
**Question**: Which OTEL resource attributes should the agent-team launcher set per agent to differentiate agents and tasks in traces? How does Braintrust fit?

## Answer

The launcher should set **5 core OTEL env vars per agent** to enable full trace differentiation. Braintrust is a viable observability backend but is not the only option — the same OTEL attributes work with any compliant backend. The key insight is that Claude Code already emits rich telemetry natively; the launcher just needs to tag each agent's process with the right resource attributes.

## Recommended OTEL Resource Attributes Per Agent

### Must-Set (by the launcher, per agent process)

| Env Var                    | Value Pattern             | Purpose                                                                                        |
| :------------------------- | :------------------------ | :--------------------------------------------------------------------------------------------- |
| `OTEL_SERVICE_NAME`        | `agent-team.{agent-role}` | Differentiates agent type in traces (e.g., `agent-team.software-eng`, `agent-team.researcher`) |
| `OTEL_RESOURCE_ATTRIBUTES` | See below                 | Composite key-value pairs for fine-grained filtering                                           |

**Recommended `OTEL_RESOURCE_ATTRIBUTES` contents:**

```bash
OTEL_RESOURCE_ATTRIBUTES="agent.name={display_name},agent.role={role},team.name={team_name},team.session_id={session_id},agent.id={unique_agent_id}"
```

Example for Bugs Bunny:

```bash
OTEL_SERVICE_NAME=agent-team.software-eng
OTEL_RESOURCE_ATTRIBUTES="agent.name=Bugs_B_(software-eng),agent.role=software-eng,team.name=looney-tunes,team.session_id=2026-02-17-abc123,agent.id=bugs-bunny-01"
```

### Must-Set (global, same for all agents)

| Env Var                        | Value                     | Purpose                           |
| :----------------------------- | :------------------------ | :-------------------------------- |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1`                       | Enables Claude Code OTEL emission |
| `OTEL_METRICS_EXPORTER`        | `otlp`                    | Exports metrics via OTLP          |
| `OTEL_LOGS_EXPORTER`           | `otlp`                    | Exports events via OTLP           |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | `http://{collector}:4317` | Shared collector endpoint         |

### Optional (enhance granularity)

| Env Var                             | Value            | Purpose                                    |
| :---------------------------------- | :--------------- | :----------------------------------------- |
| `OTEL_LOG_USER_PROMPTS`             | `1`              | Logs actual prompts (privacy-sensitive)    |
| `OTEL_LOG_TOOL_DETAILS`             | `1`              | Logs MCP server/tool names and skill names |
| `OTEL_METRICS_INCLUDE_SESSION_ID`   | `true` (default) | Links metrics to specific sessions         |
| `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` | `true` (default) | Links to billing account                   |

## What Claude Code Already Emits (No Extra Work Needed)

Claude Code natively exports these via OTEL when telemetry is enabled:

### Standard Attributes on All Metrics/Events

- `session.id` — unique per Claude Code session (each agent gets one)
- `organization.id` — org UUID when authenticated
- `user.account_uuid` — account UUID
- `terminal.type` — will be `tmux` for agent-team agents
- `service.name` — defaults to `claude-code`, **overridable via `OTEL_SERVICE_NAME`**
- `service.version` — Claude Code version
- `os.type`, `os.version`, `host.arch`

### Metrics

| Metric                                | What It Measures                                                |
| :------------------------------------ | :-------------------------------------------------------------- |
| `claude_code.session.count`           | Sessions started                                                |
| `claude_code.token.usage`             | Tokens by type (input/output/cacheRead/cacheCreation) and model |
| `claude_code.cost.usage`              | Cost in USD per API request, by model                           |
| `claude_code.lines_of_code.count`     | Lines added/removed                                             |
| `claude_code.commit.count`            | Git commits                                                     |
| `claude_code.pull_request.count`      | PRs created                                                     |
| `claude_code.active_time.total`       | Active time in seconds                                          |
| `claude_code.code_edit_tool.decision` | Accept/reject decisions on Edit/Write/NotebookEdit              |

### Events

| Event                       | Key Attributes                                             |
| :-------------------------- | :--------------------------------------------------------- |
| `claude_code.user_prompt`   | prompt_length, prompt (if opted in)                        |
| `claude_code.tool_result`   | tool_name, success, duration_ms, decision, tool_parameters |
| `claude_code.api_request`   | model, cost_usd, duration_ms, input/output/cache tokens    |
| `claude_code.api_error`     | model, error, status_code, attempt                         |
| `claude_code.tool_decision` | tool_name, decision, source                                |

## Attribute Naming Strategy: OTEL Conventions

The evidence suggests aligning with the emerging [GenAI Agent Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) where possible:

| Our Attribute     | OTEL GenAI Convention    | Status                                                                                              |
| :---------------- | :----------------------- | :-------------------------------------------------------------------------------------------------- |
| `agent.name`      | `gen_ai.agent.name`      | Stable — "Human-readable name of the GenAI agent"                                                   |
| `agent.id`        | `gen_ai.agent.id`        | Stable — "Unique identifier of the GenAI agent"                                                     |
| `agent.role`      | (no standard yet)        | Custom — role/type classification                                                                   |
| `team.name`       | `gen_ai.team.*`          | Proposed in [Issue #2664](https://github.com/open-telemetry/semantic-conventions/issues/2664) — TBD |
| `team.session_id` | `gen_ai.conversation.id` | Stable — "Unique identifier for a conversation (session, thread)"                                   |

**Recommendation**: Use `gen_ai.*` prefixed names where conventions exist. Use `agent_team.*` prefix for custom attributes to avoid future collisions. As the GenAI SIG finalizes team/task conventions, migrate to the standard names.

**Updated attribute recommendation:**

```bash
OTEL_RESOURCE_ATTRIBUTES="gen_ai.agent.name=Bugs_B_(software-eng),gen_ai.agent.id=bugs-bunny-01,agent_team.role=software-eng,agent_team.team_name=looney-tunes,gen_ai.conversation.id=session-2026-02-17-abc123"
```

## Braintrust Integration

### What Braintrust Is

An AI observability platform with native OTEL support. It captures traces, evaluates outputs, and manages datasets for AI applications. Key differentiator: it converts production traces into eval datasets with one click.

### How It Integrates

Braintrust provides a `BraintrustSpanProcessor` that converts OTEL spans into Braintrust-native logs:

```typescript
import { BraintrustSpanProcessor } from "@braintrust/otel";
const sdk = new NodeSDK({
  serviceName: "agent-team",
  spanProcessors: [new BraintrustSpanProcessor({ filterAISpans: true })],
});
```

**Required env vars for Braintrust:**

```bash
BRAINTRUST_API_KEY=<api_key>
BRAINTRUST_PARENT=project_name:agent-team
```

### Relevance to agent-team

**Medium relevance.** Braintrust is one of many OTEL-compatible backends. Its unique value for agent-team would be:

1. **Turning agent failures into eval datasets** — systematic regression testing from real failures
2. **Per-agent cost tracking** — with proper `OTEL_SERVICE_NAME` per agent, Braintrust can show cost breakdown by role
3. **Prompt comparison** — seeing how different agents use prompts differently

However, Braintrust is a **paid SaaS product**, not open source. For self-hosted alternatives, Grafana + Prometheus + Loki (as in the claude-code-otel project) achieves similar observability with the same OTEL attributes.

### Confidence: Medium-High

Braintrust's OTEL integration is well-documented. The gap is that it's designed for SDK-instrumented applications, not CLI wrappers. The launcher would need to ensure the OTEL env vars are set before Claude Code starts — which is already the plan.

## Alternative: claude_telemetry (TechNickAI/claude_telemetry)

Worth noting: `claude_telemetry` is a thin wrapper around Claude Code that uses the SDK's hook system (UserPromptSubmit, PreToolUse, PostToolUse) to emit OTEL spans. It captures per-tool-call spans with inputs/outputs.

**Key insight**: This hook-based approach captures more granular data than Claude Code's native telemetry (which only emits metrics and events, not distributed traces with spans). If agent-team wants full distributed tracing (parent-child span relationships across tools), a hook-based approach like claude_telemetry's would be needed.

**Env vars:**

```bash
OTEL_SERVICE_NAME=my-claude-agents  # Overridable per agent
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-endpoint.com/v1/traces
OTEL_EXPORTER_OTLP_HEADERS=authorization=Bearer your-token
```

## Implementation Recommendation for the Launcher

### Phase 1: Resource Attributes (Minimal effort, high value)

The launcher should set these env vars per agent before spawning the Claude Code process:

```bash
# Per-agent (set by launcher based on agent config)
export OTEL_SERVICE_NAME="agent-team.${agent_role}"
export OTEL_RESOURCE_ATTRIBUTES="gen_ai.agent.name=${display_name},gen_ai.agent.id=${agent_id},agent_team.role=${role},agent_team.team_name=${team_name}"

# Global (set once in team config or launcher defaults)
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT="${collector_endpoint}"
```

This gives immediate per-agent filtering in any OTEL backend with zero code changes to Claude Code.

### Phase 2: Braintrust or Grafana Stack (Medium effort)

Choose an observability backend:

- **Braintrust** if the team wants eval/dataset capabilities and is willing to pay
- **Grafana + Prometheus + Loki** (self-hosted) for cost-free observability
- **Honeycomb/Datadog/SigNoz** for managed alternatives

### Phase 3: Hook-Based Tracing (Higher effort, richer data)

If the team needs distributed tracing with tool-level spans, consider integrating `claude_telemetry`'s hook approach or building custom hooks that emit spans per tool call.

## Open Questions

1. **Should `OTEL_SERVICE_NAME` be per-role or per-instance?** Per-role (e.g., `agent-team.software-eng`) groups all instances of a role together. Per-instance (e.g., `agent-team.bugs-bunny-01`) gives individual agent traces. Recommendation: per-role in `OTEL_SERVICE_NAME`, per-instance in `OTEL_RESOURCE_ATTRIBUTES.gen_ai.agent.id`.

2. **Should the launcher support Braintrust-specific env vars (`BRAINTRUST_API_KEY`, `BRAINTRUST_PARENT`) or stay backend-agnostic?** Recommendation: stay backend-agnostic. Let users configure Braintrust via a collector pipeline config, not in the launcher.

3. **Task-level tracing**: The GenAI SIG has proposed `gen_ai.task.*` attributes ([Issue #2665](https://github.com/open-telemetry/semantic-conventions/issues/2664)) but they're not yet standardized. Should we define `agent_team.task.id` and `agent_team.task.subject` now? Recommendation: yes, as custom attributes, and migrate when the standard lands.

## Confidence Levels

| Finding                                                               | Confidence                            |
| :-------------------------------------------------------------------- | :------------------------------------ |
| Claude Code natively supports OTEL metrics/events                     | High — official docs                  |
| `OTEL_SERVICE_NAME` + `OTEL_RESOURCE_ATTRIBUTES` differentiate agents | High — OTEL spec                      |
| GenAI agent conventions (`gen_ai.agent.*`) are the right namespace    | High — OTEL semconv                   |
| Braintrust integrates via `BraintrustSpanProcessor`                   | High — Braintrust docs                |
| Hook-based tracing gives richer data than native telemetry            | Medium-High — claude_telemetry README |
| GenAI team/task conventions are still TBD                             | High — Issue #2664 is open            |
| Launcher should stay backend-agnostic                                 | Medium-High — architectural judgment  |

## Sources

- [Claude Code Monitoring Docs](https://code.claude.com/docs/en/monitoring-usage) — official, definitive list of metrics/events/env vars
- [OTEL GenAI Agent Span Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — `gen_ai.agent.*` attributes
- [OTEL GenAI Agentic Systems Proposal (Issue #2664)](https://github.com/open-telemetry/semantic-conventions/issues/2664) — proposed `gen_ai.team.*`, `gen_ai.task.*`
- [OTEL Resource SDK Spec](https://opentelemetry.io/docs/specs/otel/resource/sdk/) — `OTEL_RESOURCE_ATTRIBUTES` format
- [OTEL AI Agent Observability Blog](https://opentelemetry.io/blog/2025/ai-agent-observability/) — standards direction
- [Braintrust OTEL Cookbook](https://www.braintrust.dev/docs/cookbook/recipes/OTEL-logging) — BraintrustSpanProcessor integration
- [claude_telemetry (TechNickAI)](https://github.com/TechNickAI/claude_telemetry) — hook-based OTEL for Claude Code
- [claude-code-otel (ColeMurray)](https://github.com/ColeMurray/claude-code-otel) — Grafana stack for Claude Code
- [Dash0: OTEL Service Attributes Best Practices](https://www.dash0.com/guides/opentelemetry-service-attributes-best-practices)
- [SigNoz: Claude Code Monitoring with OTEL](https://signoz.io/blog/claude-code-monitoring-with-opentelemetry/)
