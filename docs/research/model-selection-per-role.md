# Model Selection Per Role

**Purpose**: Living document tracking which models work best for which agent roles, with recommendations for cost/quality optimization.

**Owner**: Wile E. Coyote (AI Agent Engineer)
**Created**: 2026-02-17
**Last updated**: 2026-02-17

---

## Current State

All agents are assigned `claude-opus-4-6`. This is the baseline — every role uses the same model regardless of task complexity.

| Agent | Role | Current Model | Notes |
|:------|:-----|:--------------|:------|
| Orchestrator | Team lead / coordinator | claude-opus-4-6 | Needs strong reasoning for delegation |
| Bugs B | Software Engineer | claude-opus-4-6 | Core implementation work |
| Road R | Deep Researcher | claude-opus-4-6 | Web search, synthesis, multi-source analysis |
| Wile E | AI Agent Engineer | claude-opus-4-6 | Pattern detection, spec review, failure analysis |
| Elmer F | Project Manager | claude-opus-4-6 | Spec writing, task decomposition, coordination |
| Foghorn L | Ops Engineer | claude-opus-4-6 | Infrastructure, CI/CD, deployment |
| Daffy D | Quality Assurance | claude-opus-4-6 | Code review, test writing, validation |
| Tweety B | Docs Writer | claude-opus-4-6 | Documentation, research synthesis |

## Available Models

As of 2026-02-17, Claude Code supports these model selections in agent frontmatter:

| Model ID | Tier | Strengths | Cost Tier |
|:---------|:-----|:----------|:----------|
| `claude-opus-4-6` | Flagship | Deep reasoning, complex multi-step tasks, nuanced analysis | Highest |
| `claude-sonnet-4-5-20250929` | Mid-tier | Good balance of capability and speed, strong coding | Medium |
| `claude-haiku-4-5-20251001` | Fast | Quick responses, simple tasks, high throughput | Lowest |

## Recommendations

### Phase 1: Current (All Opus)

**Rationale**: During early team development, using Opus everywhere provides maximum capability while we establish baselines for what each role actually needs. Premature optimization to cheaper models risks degraded output quality before we understand the minimum viable capability per role.

**Status**: Active. Gathering observations.

### Phase 2: Targeted Optimization (Proposed)

Once we have enough session data, consider these model changes:

| Agent | Proposed Model | Rationale | Risk |
|:------|:---------------|:----------|:-----|
| Orchestrator | **Keep Opus** | Delegation, judgment calls, and multi-agent coordination require top-tier reasoning | Low — this role justifies the cost |
| Software Eng | **Keep Opus** | Code generation, debugging, and architectural decisions benefit from Opus's reasoning depth | Medium — Sonnet 4.5 may be sufficient for routine coding |
| Deep Researcher | Sonnet 4.5 candidate | Research tasks are often breadth-first (many searches) rather than depth-first reasoning | Medium — synthesis quality may drop |
| AI Agent Eng | **Keep Opus** | Pattern detection across failures and spec contradictions requires nuanced analysis | Low — this role is high-judgment |
| Project Manager | Sonnet 4.5 candidate | Spec writing and task decomposition are structured tasks with clear patterns | Medium — quality of spec gap detection may drop |
| Ops Engineer | Sonnet 4.5 candidate | Infrastructure work follows established patterns; less novel reasoning needed | Low — most ops tasks are well-defined |
| Quality Assurance | **Keep Opus** | Code review requires understanding intent, not just syntax; bug detection benefits from deep reasoning | Medium — Sonnet may miss subtle issues |
| Docs Writer | Sonnet 4.5 candidate | Documentation follows templates and established patterns | Low — writing quality difference is small |

### Phase 3: Dynamic Model Selection (Future)

The agent launcher could support per-task model overrides:

```yaml
# Hypothetical: agent file with conditional model selection
model: claude-sonnet-4-5-20250929
model_overrides:
  - condition: "task contains 'architecture' or 'design'"
    model: claude-opus-4-6
  - condition: "task contains 'quick lookup' or 'simple fix'"
    model: claude-haiku-4-5-20251001
```

This requires launcher support (not yet in spec) and is future work.

## Observations Log

Track session-by-session observations about model performance here.

### Session: 2026-02-17 (looney-tunes team, first full session)

- **All agents on Opus**: Baseline session, no model variation to compare
- **Observation**: Researcher (Road R) spent significant tokens on web searches that returned structured data — Sonnet would likely handle this equally well
- **Observation**: Docs Writer (Tweety B) produced high-quality research docs — the quality bar was set high by the task, not the model
- **Observation**: QA (Daffy D) caught real issues in code review — Opus-level reasoning appeared to add value here
- **Observation**: Compaction events caused behavioral drift regardless of model — this is a prompt/convention issue, not a model issue (see Failures #9, #10)

## Optimization Techniques

### Sub-Agent Model Delegation

Agents can already spawn sub-agents with specific models via the `Task` tool's `model` parameter. This allows Opus agents to delegate simple lookups to Haiku without changing their own model assignment.

**Current practice**: AI Agent Engineer and Orchestrator already use Haiku sub-agents for quick searches (per user rules).

### Cost Monitoring

No built-in cost tracking per agent exists yet. Recommendations for implementation:

1. **Session-level**: Track total tokens per agent per session (requires API-level instrumentation)
2. **Task-level**: Track tokens per task completion (requires launcher support)
3. **Comparative**: Run the same task with different models and compare output quality

## References

- [Claude Model Documentation](https://docs.anthropic.com/en/docs/about-claude/models)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- Agent definitions: `.claude/agents/*.md` in this repo
- Related research: `docs/research/language-comparison.md` (infrastructure decisions)
