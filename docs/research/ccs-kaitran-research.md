# Research: CCS (Claude Code Switch) — ccs.kaitran.ca

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-17
**Question**: What is ccs.kaitran.ca, how does it relate to Claude Code / agent orchestration, and is it relevant to the agent-team project?

## Answer

CCS is a **CLI profile manager and account switcher** for Claude Code and other AI coding tools. It allows developers to run multiple Claude accounts (work, personal, team) in parallel with isolated credentials. It is **not directly relevant** to agent-team's orchestration goals, but has a narrow overlap worth noting.

## What CCS Actually Is

**Architecture**: Three layers —

1. **Profile management** — isolated configs per account in `~/.ccs/`, uses symlinks to swap credential directories
2. **OAuth proxy integration** — leverages CLIProxyAPI for browser-authenticated providers (Gemini, Copilot, etc.)
3. **CLI wrapper** — intercepts Claude CLI commands and routes through selected profiles

**Core capability**: Run `ccs work` / `ccs personal` to switch Claude accounts without logging out or cross-contaminating sessions. Supports 15+ providers including OpenRouter (300+ models), Gemini, Copilot, GLM, DeepSeek, Ollama.

**Confidence**: High — verified from both the marketing site and GitHub README.

## Technical Profile

| Attribute    | Value                        |
| :----------- | :--------------------------- |
| Language     | TypeScript/Node.js           |
| Install      | `bun add -g @kaitranntt/ccs` |
| License      | MIT                          |
| GitHub stars | ~1.1k                        |
| Forks        | ~93                          |
| Commits      | 2,039+ on main               |
| Maintenance  | Active, recent updates       |
| Dashboard    | localhost:3000 web UI        |

## Relevance to agent-team Project

### Low Direct Relevance

CCS solves a **different problem** than agent-team. CCS is about account/credential switching for individual developers. Agent-team is about orchestrating multi-agent workflows with roles, tasks, and coordination.

### Narrow Overlap: Per-Agent Identity

One area of tangential interest: CCS's profile isolation mechanism (symlink-based config swapping) could theoretically be used to give each agent in a team a **separate Claude identity/account**. This connects to the research topic in `docs/research-topics.md`:

> "gh apps per agent, name 'persona (agent-team@org-name)'"

If each agent needed its own API key, billing identity, or OAuth session, CCS's approach to profile isolation is one way to achieve it. However, this is a future concern — the current agent-team architecture uses a single Claude session with teammates spawned as sub-processes.

### Model Routing — Not Applicable

CCS's "model delegation" (using cheaper models for routine tasks) sounds superficially similar to agent-team's model-per-role concept (`docs/research/model-selection-per-role.md`), but the mechanisms are completely different. CCS routes at the CLI invocation level; agent-team configures model selection in agent frontmatter.

## Open Questions

- None blocking. CCS is a useful ecosystem tool but not a dependency or competitor for agent-team.

## Confidence Levels

| Finding                                   | Confidence |
| :---------------------------------------- | :--------- |
| CCS is a profile/account switcher         | High       |
| Low relevance to agent-team orchestration | High       |
| Per-agent identity overlap is tangential  | Medium     |
| Model routing is not applicable           | High       |

## Sources

- [CCS landing page](https://ccs.kaitran.ca/)
- [GitHub: kaitranntt/ccs](https://github.com/kaitranntt/ccs) — README, repo metrics
- [CCS docs: Multiple Claude Accounts](https://docs.ccs.kaitran.ca/providers/claude-accounts)
- [ClaudeKit docs: CCS](https://docs.claudekit.cc/docs/tools/ccs)
