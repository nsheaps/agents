# OpenAI Codex: Agent Platform Research Report

**Source**: OpenAI Developer Documentation, GitHub, OpenAI Blog
**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #44 (Orchestration Platforms Survey)

---

## 1. What It Is

OpenAI Codex is an autonomous software engineering agent platform — evolved from the 2021 code completion model into a full agent orchestration system.[^1]

- **Maker**: OpenAI
- **Maturity**: High production (1M+ users, usage doubled since GPT-5.3 release Feb 2026)[^2]
- **License**: Apache 2.0 (CLI)[^3]
- **Components**:
  - **Codex CLI**: Local command-line agent harness[^3]
  - **Codex App**: Native macOS desktop app (launched Feb 2, 2026)[^4]
  - **Agents SDK Integration**: MCP-based orchestration[^5][^6]

| Date     | Milestone                                        |
| :------- | :----------------------------------------------- |
| Aug 2021 | Original Codex announced (powers GitHub Copilot) |
| May 2025 | Relaunched as autonomous agent[^7]               |
| Apr 2025 | CLI published to GitHub (Apache 2.0)[^3]         |
| Dec 2025 | GPT-5-Codex; usage doubled[^2]                   |
| Feb 2026 | GPT-5.3-Codex + macOS desktop app[^2][^4]        |

## 2. Architecture and Design Patterns

### MCP-First Service Design

Codex CLI exposes itself as an **MCP server**, enabling external orchestrators to call it as a service:[^5]

- `codex()` — Start a new session with config parameters
- `codex-reply()` — Continue existing session via thread ID

This means any MCP-compatible orchestrator can use Codex as an agent backend.[^5]

### Two-Layer Security

| Layer                       | Implementation                                                |
| :-------------------------- | :------------------------------------------------------------ |
| **Sandbox** (OS-enforced)   | macOS: Seatbelt; Linux: Landlock + seccomp; Windows: WSL      |
| **Approval** (policy-based) | `on-request` / `untrusted` / `never` — configurable per agent |

Admin-level controls via `/etc/codex/requirements.toml` enforce org policies.[^8]

### Execution Environments

- **Local** (default): OS-enforced sandbox, workspace-scoped, interactive approval[^3]
- **Cloud** (`codex cloud exec`): Isolated OpenAI containers, `--attempts N` for parallel candidates[^3]
- **Non-interactive** (`codex exec`): Headless CI/CD mode, pipes results to stdout[^3]

### Stateful Sessions

- Thread IDs track state across multi-agent handoffs[^7]
- `codex resume` restarts prior session
- Previously-approved operations don't re-prompt
- Partial results accumulate across turns

## 3. Agent Communication Model

### Hierarchical Handoff via Agents SDK

```
PM Agent (Orchestrator)
  ├── Designer Agent (MCP) ──→ Codex MCP Server
  ├── Developer Agent (MCP) ──→ Codex MCP Server
  └── Tester Agent (MCP)   ──→ Codex MCP Server
```

1. PM verifies required deliverables before advancing[^6]
2. Each agent gets MCP access to `codex()` and `codex-reply()`[^5]
3. Agent calls Codex with scoped context and permissions
4. Codex executes, returns results with traces
5. PM gates next stage based on quality checks

### Traces and Observability

> "Codex automatically records traces that capture every prompt, tool call, and hand-off."[^7]

- Traces dashboard captures full execution timeline
- Audits every state transition
- Immutable audit logs for compliance and debugging

### Stateful Handoffs

Thread IDs preserve conversation context across agents. `codex-reply()` resumes prior execution with existing approvals. Agents can inherit partial results from predecessors.[^6]

## 4. Task Management

| Phase      | Mechanism                                              |
| :--------- | :----------------------------------------------------- |
| Assignment | MCP tool call: orchestrator calls `codex(task_config)` |
| Tracking   | Thread ID + Traces dashboard                           |
| Execution  | Autonomous up to 30 minutes before hand-off            |
| Approval   | Policy-based: `on-request` / `untrusted` / `never`     |
| Hand-off   | PM verifies completion before next stage               |
| Audit      | Full execution history in Traces                       |

**30-minute autonomy window** — Codex can run up to 30 minutes independently before returning to operator. Longer than most agent platforms.[^3]

**Parallel tasks**: Codex App runs multiple tasks in parallel via Git worktrees — isolated branches prevent merge conflicts.[^9]

## 5. Unique Features

### OS-Enforced Sandboxing

Dual-layer security (OS + policy) is more sophisticated than policy-only approval. Kernel-level access control via Seatbelt/Landlock.[^8]

### Structured Code Review

Production code review via structured JSON schemas — findings with line numbers, confidence scores, verdict. Integrates with GitHub Actions, GitLab CI/CD, Jenkins.[^12]

### PR Automation

Native GitHub Action (`openai/codex-action@v1`): detects labels → runs Codex → commits → opens PR → posts inline review comments.[^10]

### Parallel Task Execution

Desktop app + Git worktrees = true parallel work without merge conflicts. Automatic conflict detection.[^9]

### MCP as Service Interface

Codex treats itself as an MCP server, not a monolithic app. Any MCP-compatible orchestrator can use it.[^5]

### Extended Autonomy

30-minute autonomous runs enable complex multi-step tasks — longer than typical 5-10 minute agent timeouts.[^3]

## 6. Comparison to Claude Code Agent Teams

| Dimension              | Codex                            | Claude Code Agent Teams              |
| :--------------------- | :------------------------------- | :----------------------------------- |
| **Maturity**           | Production (1M+ users)           | Experimental                         |
| **Orchestration**      | Hierarchical, MCP-based          | Peer-to-peer via Task system         |
| **Security**           | OS-enforced + policy             | Policy-enforced approval             |
| **Communication**      | Stateful handoffs via thread IDs | SendMessage + file-based inbox       |
| **Task management**    | MCP tool calls + Traces          | Built-in task list with dependencies |
| **Parallel execution** | Git worktrees in desktop app     | tmux panes or in-process             |
| **Autonomy window**    | 30 minutes                       | Session-length (no hard limit)       |
| **Code review**        | Built-in, structured output      | Delegated to agent logic             |
| **Traces/Audit**       | First-class dashboard            | Conversation history                 |
| **Desktop app**        | Yes (macOS)                      | No (CLI focus)                       |
| **Multi-model**        | OpenAI only                      | Claude only                          |

### Complementary Strengths

> Codex = task runner + orchestrator (good for automation)
> Claude Code Teams = reasoning team + collaboration (good for complex reasoning)

Production workflows can combine both:[^13]

```
Claude Code Team → Plans architecture, debates approach
         ↓
Codex Agents    → Execute tasks, create PRs, review code
```

## 7. Lessons for Our Approach

### MCP as Universal Integration Layer

Codex's success comes from being an MCP service.[^5] Agent interfaces should be MCP servers, not tight coupling. This enables mix-and-match provider support.

### Explicit Handoff Protocol with State Preservation

Thread IDs + `codex-reply()` enable stateful orchestration.[^6] Our design should:

- Preserve context IDs across agent handoffs
- Allow agents to resume partial work
- Track session state explicitly (not just conversation history)

### Dual-Layer Security

OS-enforced sandbox + configurable approval policies + admin-level enforcement.[^8] More flexible than policy-only approval. Worth adopting for our architecture.

### Traces as First-Class Observability

Every action logged with metadata. Immutable audit logs. Dashboard for debugging, compliance, cost analysis.[^7] Build from day one.

### Parallel Execution with Conflict Detection

Git worktrees for agent isolation. Automatic conflict detection before merge.[^9] Safe horizontal scaling.

### What NOT to Copy

- GPT-5.3-Codex hardcoded model selection (vendor lock-in)
- macOS-only desktop app
- No native inter-agent messaging (relies on orchestrator for all coordination)

## References

[^1]: https://openai.com/codex/
[^2]: https://openai.com/index/introducing-gpt-5-3-codex/
[^3]: https://developers.openai.com/codex/cli/reference/
[^4]: https://openai.com/index/introducing-the-codex-app/
[^5]: https://developers.openai.com/codex/mcp
[^6]: https://developers.openai.com/codex/guides/agents-sdk/
[^7]: https://openai.com/index/unrolling-the-codex-agent-loop/
[^8]: https://developers.openai.com/codex/security/
[^9]: https://developers.openai.com/codex/app/
[^10]: https://developers.openai.com/codex/github-action/
[^11]: https://developers.openai.com/cookbook/examples/codex/codex_mcp_agents_sdk/building_consistent_workflows_codex_cli_agents_sdk
[^12]: https://developers.openai.com/cookbook/examples/codex/build_code_review_with_codex_sdk
[^13]: https://thoughts.jock.pl/p/claude-code-vs-codex-real-comparison-2026
[^14]: https://almcorp.com/blog/openai-codex-app-macos-guide-features-pricing-security/
[^15]: https://github.com/nyldn/claude-octopus
[^16]: https://github.com/bfly123/claude_code_bridge
[^17]: https://github.com/Dinesh7N/multi-agent-orchestration
