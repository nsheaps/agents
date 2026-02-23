# Research: OmoiOS (kivo360/OmoiOS) — Architecture & Relevance

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-17
**Question**: What is OmoiOS, what is its architecture, what patterns does it use, and how relevant is it to the agent-team project?

## Answer

OmoiOS is a **spec-driven multi-agent orchestration platform** for autonomous software development. It deploys swarms of AI agents in isolated sandboxes, coordinated through dependency graphs. It solves a problem highly relevant to agent-team — but at a fundamentally different scale and with different architectural assumptions. **High relevance as a reference architecture**, even though agent-team should not adopt its approach wholesale.

## What OmoiOS Is

A full-stack platform (FastAPI backend + Next.js frontend) that automates software development by:

1. Reading your codebase and generating specifications
2. Breaking specs into tasks with dependency graphs (DAGs)
3. Spawning isolated agent workspaces (via Daytona containers)
4. Running agents in parallel with active supervision ("IntelligentGuardian")
5. Merging completed work back via a convergence merge service
6. Delivering PRs to your repository

**Tagline**: "Stop babysitting AI agents. Run structured swarms instead."

## Architecture Deep Dive

### Three-Layer Stack

| Layer          | Technology                                 | Scale                                      |
| :------------- | :----------------------------------------- | :----------------------------------------- |
| Frontend       | Next.js 15, React Flow, WebSocket          | ~94 pages, 140+ components                 |
| Backend        | FastAPI, SQLAlchemy 2.0, Taskiq            | ~100 service modules, 61 models, 39 routes |
| Infrastructure | PostgreSQL 16 + pgvector, Redis 7, Daytona | Containerized sandboxes per agent          |

### Core Patterns

**1. Spec State Machine**
Every feature request flows through a state machine:
`EXPLORE → REQUIREMENTS → DESIGN → TASKS → SYNC`

Each phase transition has a quality gate — humans approve at strategic decision points while execution runs autonomously between gates. This is the "spec-driven" part: no freeform prompts, everything grounded in codebase-analyzed specifications.

**Relevance to agent-team**: Agent-team currently uses freeform task descriptions. A lightweight spec-to-task pipeline could improve task quality. However, agent-team's scope is orchestration tooling, not a full development platform — adopting this pattern wholesale would be over-engineering.

**2. DAG-Based Task Scheduling**
Tasks form dependency graphs. The `TaskQueueService` determines critical paths and assigns work respecting prerequisites. Agents can run in parallel on independent branches of the DAG.

**Relevance to agent-team**: Agent-team's task system (`TaskCreate`/`TaskUpdate`) supports `blockedBy`/`blocks` relationships — this IS a lightweight DAG. OmoiOS validates that DAG-based scheduling is the right pattern. Agent-team could benefit from automatic critical-path detection, but the current manual approach works for the team sizes involved.

**3. Isolated Sandboxes (Daytona)**
Each agent gets its own containerized workspace with separate Git branches. Prevents interference and enables safe experimentation. The `OrchestratorWorker` spawns these workspaces.

**Relevance to agent-team**: Agent-team uses tmux panes with shared filesystem — a lightweight equivalent. OmoiOS's container isolation is heavier but prevents the merge conflicts and file collision issues agent-team experiences. This is the biggest architectural gap agent-team should consider as it scales.

**4. Active Supervision ("IntelligentGuardian")**
Analyzes agent trajectories every 60 seconds. Detects drift and injects steering interventions mid-execution. Not a post-hoc review — real-time course correction.

**Relevance to agent-team**: Agent-team's AI Agent Eng (Wile E. Coyote) plays a similar observational role but is reactive (records failures after they happen) rather than proactive (steers agents mid-task). The Guardian pattern is worth considering for agent-team's evolution, though the current team-message-based approach works for human-in-the-loop workflows.

**5. Adaptive Discovery**
As agents execute, new tasks spawn automatically based on findings. The workflow graph grows dynamically.

**Relevance to agent-team**: Agent-team teammates can create tasks (`TaskCreate`), so this capability exists informally. OmoiOS formalizes it.

**6. Convergence Merge Service**
A dedicated service handles merging work from multiple agents back into the main branch. This is non-trivial when N agents are editing code in parallel.

**Relevance to agent-team**: Agent-team currently relies on teammates committing to a shared branch with manual coordination. As the team scales, a merge strategy becomes critical. This is an area where agent-team should invest.

## Key Differences: OmoiOS vs. agent-team

| Dimension   | OmoiOS                                         | agent-team                             |
| :---------- | :--------------------------------------------- | :------------------------------------- |
| Scope       | Full dev platform (frontend + backend + infra) | CLI orchestration tooling              |
| Scale       | 100+ service modules, 61 DB models             | Single launcher script + agent configs |
| Isolation   | Container-per-agent (Daytona)                  | tmux pane-per-agent (shared FS)        |
| Scheduling  | Automated DAG with critical path               | Manual task assignment with blockedBy  |
| Supervision | Real-time Guardian (60s interval)              | Reactive AI Agent Eng (message-based)  |
| LLM         | Claude Agent SDK                               | Claude Code CLI                        |
| State       | PostgreSQL + Redis                             | Team config JSON + task files          |
| Status      | 16 stars, 695 commits, Apache 2.0              | In development                         |

## What agent-team Should Learn From OmoiOS

### Adopt (adapt to agent-team's scale)

1. **Quality gates between phases** — even informal "human approves before agents execute" checkpoints
2. **Formalized merge strategy** — as the team grows, ad-hoc branch sharing won't scale
3. **Task dependency visualization** — even a simple DAG printout would help

### Study Further

1. **IntelligentGuardian pattern** — proactive drift detection is powerful but complex
2. **Spec state machine** — could improve task quality if adapted as a lightweight skill
3. **Daytona integration** — container isolation may be worth exploring for the agent-team project's longer-term vision (see `docs/research-topics.md` re: separate environments)

### Skip

1. **Full-stack platform** — agent-team is CLI tooling, not a web app
2. **PostgreSQL/Redis persistence** — agent-team's file-based approach is appropriate for its scale
3. **61 SQLAlchemy models** — way too much infrastructure for orchestration tooling

## Open Questions

1. How does OmoiOS handle agent failures mid-task? (The Guardian detects drift, but what about hard crashes?)
2. What's the actual user experience for spec approval gates? Is it friction-heavy?
3. Could Daytona's sandbox API be used from agent-team's launcher without the full OmoiOS platform?

## Confidence Levels

| Finding                                                        | Confidence  |
| :------------------------------------------------------------- | :---------- |
| OmoiOS is a full-stack agent orchestration platform            | High        |
| DAG-based scheduling validates agent-team's blockedBy approach | High        |
| Container isolation is a meaningful gap in agent-team          | Medium-High |
| Guardian pattern is worth studying for proactive supervision   | Medium      |
| Agent-team should NOT adopt OmoiOS's full-stack approach       | High        |
| Convergence merge is an underinvested area for agent-team      | Medium-High |

## Sources

- [GitHub: kivo360/OmoiOS](https://github.com/kivo360/OmoiOS) — README, repo structure, metrics
- [Daytona: Sandbox Infrastructure for RL Agents](https://www.daytona.io/dotfiles/sandbox-infrastructure-for-reinforcement-learning-agents)
- [Claude Code Swarm with Daytona](https://scottspence.com/posts/claude-code-swarm-daytona-sandboxes)
- [AgenticOS 2026 Workshop](https://os-for-agent.github.io/) — related academic context
