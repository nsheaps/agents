# Swarm Review: Architecture & Industry Alignment

**Reviewer**: Road Runner (Deep Researcher)
**Date**: 2026-02-18
**Repo**: nsheaps/agent-team (main branch)
**Perspective**: Architecture decisions, tech debt, industry alignment

## Executive Summary

The agent-team repository is a well-structured proof-of-concept for declarative agent lifecycle management, built on TypeScript/Bun with 54 passing tests across 4 modules. The architecture cleanly separates discovery, prompt assembly, spawning, and lifecycle into focused modules with good test coverage. However, the project has a significant gap between its ambitious 16-phase roadmap and its current POC state: the `launch` command does not actually spawn agents yet, `health` always reports UNKNOWN, and the `teamName` parameter is threaded through but never used in spawning. The shell-based tmux approach is validated by community tools (Claude Flow at 14.1k stars uses similar patterns), but the industry is moving toward MCP-native communication and container isolation, which the roadmap correctly anticipates. The most pressing concern is that the codebase relies on Claude Code's undocumented `~/.claude/teams/{name}/config.json` format, creating a fragile coupling to internal implementation details.

## Architecture Assessment

### Strengths

1. **Clean module separation**: The four source modules (`discover.ts`, `prompt.ts`, `spawn.ts`, `lifecycle.ts`) have clear, non-overlapping responsibilities with well-defined interfaces. Each module is under 310 lines. The CLI entrypoint (`bin/agent-launch.ts`) is a thin orchestration layer that delegates to these modules.

2. **Declarative agent definitions**: Using YAML frontmatter in markdown files (`.claude/agents/*.md`) is a pragmatic choice that piggybacks on Claude Code's existing agent file format. This avoids a new config format while adding launcher-specific fields. The `AgentFrontmatter` -> `AgentDefinition` resolution with explicit defaults is correct and well-tested.

3. **Testable spawn design**: `buildSpawnArgs()` returns `{ args, env, warnings }` rather than spawning directly. This pure-function design makes the spawn logic fully testable without side effects (13 spawn tests verify every flag combination).

4. **Comprehensive validation**: Discovery validates required fields, enum values, and duplicate names with clear error messages. The error/warning distinction (errors halt, warnings continue) is appropriate for a CLI tool.

5. **Exhaustive specification documents**: The agent-launcher spec (14 sections), architecture doc (11 sections), mesh MCP server PRD, and 16-phase plan demonstrate thorough design thinking. The specs reference specific GitHub issues, external docs, and prior research reports.

6. **Thorough research foundation**: The `docs/research/` directory contains 25+ research reports covering the competitive landscape (OpenAI Codex, Gemini, OpenHands, LangGraph, CrewAI, AutoGen, Claude Flow), tmux orchestration patterns, language comparison, and system prompt behavior. This is an unusually well-researched POC.

### Concerns

1. **Critical gap: spawning is not implemented.** The `launch` command (line 138-160 of `agent-launch.ts`) builds spawn args but prints "Direct spawning not yet implemented." and exits. The `spawnAgent()` function in `spawn.ts` exists but is never called from the CLI. The `relaunch` command has the same issue. This means the primary purpose of the tool -- launching agents -- does not work end-to-end.

2. **Team config path hardcoded to `~/.claude/teams/{name}/config.json`**: The `teamConfigPath()` function in `lifecycle.ts` constructs the path from `$HOME`. This is an undocumented Claude Code internal path. If Claude Code changes its storage location (or if the format changes), all lifecycle features break silently. There is no version check or format validation beyond JSON parsing.

3. **`buildSpawnArgs` does not use `teamName`**: The team name parameter is accepted but never included in the spawn args output. Looking at the spec (section 5), agents should join a team, but neither `--team-name` nor any equivalent flag appears in the built args. The env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, but team membership is not configured.

4. **Health check always returns UNKNOWN**: The `health` subcommand (lines 88-118) iterates config members but reports "UNKNOWN" for every agent with the comment "Without tmux pane tracking in config, status is UNKNOWN." Meanwhile, `listAgents()` does call `isTmuxPaneAlive()` and correctly reports RUNNING/DEAD/UNKNOWN/NOT_SPAWNED. The `health` subcommand should use the same logic.

5. **No orchestrator auto-detection**: The spec (section 9) describes identifying the orchestrator by `role: orchestrator` in frontmatter or by filename `orchestrator.md`. Neither mechanism exists in the code. There is no `role` field in `AgentFrontmatter` types, and the `start` command described in the spec is not implemented.

6. **No graceful shutdown**: The spec (section 6.1) describes a graceful shutdown flow: SendMessage shutdown request, 10s timeout, then force kill. The actual `killAgent()` implementation goes straight to `killTmuxPane()` (force kill) with no graceful path.

## Tech Debt Inventory

| Item                                  | Severity | Location                                        | Description                                                                                                                                                         |
| :------------------------------------ | :------- | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Launch does not spawn                 | Critical | `bin/agent-launch.ts:138-160`                   | `launch` command prints args but never calls `spawnAgent()`. The tool's primary function is unimplemented.                                                          |
| Health always UNKNOWN                 | High     | `bin/agent-launch.ts:88-118`                    | `health` subcommand ignores tmux pane tracking. Should use `isTmuxPaneAlive()` like `listAgents()` does.                                                            |
| teamName unused in spawn              | High     | `src/spawn.ts:27-87`                            | `buildSpawnArgs()` accepts `teamName` but never includes it in output args or env. Team membership is unaddressed.                                                  |
| No `start` command                    | High     | `bin/agent-launch.ts`                           | Spec section 10 defines `start` to launch the orchestrator/lead session. Not implemented.                                                                           |
| No `--all` batch launch               | Medium   | `bin/agent-launch.ts`                           | Spec section 5 defines `launch --all`. Not implemented.                                                                                                             |
| No graceful shutdown                  | Medium   | `src/lifecycle.ts:140-184`                      | Goes straight to force kill. Spec requires 10s graceful timeout via SendMessage.                                                                                    |
| `relaunch` uses stale discovery       | Medium   | `bin/agent-launch.ts:163-196`                   | Comment says "Re-discover agent (file may have changed)" but reuses the `discoverResult` from line 121, which was computed before the kill.                         |
| No `role` field for orchestrator      | Medium   | `src/types.ts`                                  | `AgentFrontmatter` has no `role` field. Orchestrator identification logic from spec section 9 is missing.                                                           |
| No path traversal protection          | Medium   | `src/discover.ts:56-148`, `src/prompt.ts:83-89` | `base_prompt` file path from frontmatter is joined to project root without sanitization. A path like `../../etc/passwd` would be read.                              |
| Implicit Bun dependency               | Medium   | `src/lifecycle.ts`, `src/discover.ts`           | Uses `Bun.spawnSync()` and `Bun.spawn()` directly. Not abstracted behind an interface. If Bun API changes or someone runs with Node, it breaks with no clear error. |
| `gray-matter` is the only runtime dep | Low      | `package.json`                                  | Single dependency is clean, but the Bun-specific APIs (`Bun.spawnSync`, `Bun.spawn`, `Glob`) create implicit dependencies not tracked in package.json.              |
| Temp directories not cleaned in tests | Low      | `src/__tests__/discover.test.ts`                | `mkdtempSync` creates temp dirs that are never cleaned up. Not urgent but will accumulate over many test runs.                                                      |
| `--` passthrough not implemented      | Low      | `bin/agent-launch.ts`                           | Spec section 10 defines `--` separator for passing extra args to claude CLI. Not implemented.                                                                       |
| No `--verbose` flag                   | Low      | `bin/agent-launch.ts`                           | Spec defines `--verbose` global flag. Not implemented.                                                                                                              |
| No `--project-root` flag              | Low      | `bin/agent-launch.ts`                           | Spec defines `--project-root` override. Not in `parseArgs`.                                                                                                         |
| lint task duplicates fmt-check        | Low      | `mise.toml:12-14`                               | `lint` and `fmt-check` run identical commands. Lint should include type checking or additional checks.                                                              |

## Industry Alignment

### How This Compares to the Landscape

The agent-team project occupies a unique niche: **declarative agent lifecycle management for Claude Code's native agent teams feature**. No other tool in the surveyed landscape (per `orchestration-platforms-index.md`) does exactly this.

**Closest competitors and how they differ:**

| Tool                               | Similarity                                          | Key Difference                                                                                                                |
| :--------------------------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **Claude Flow** (14.1k stars)      | tmux orchestration, stage-based pipelines           | Self-optimizing; uses RuVector for knowledge graphs. More mature, but Claude-Code-specific and not declarative-config-driven. |
| **Oh My Claude Code** (6.4k stars) | Multi-agent Claude Code coordination                | Web dashboard approach vs CLI; session caching (93% token reduction). Different UX paradigm.                                  |
| **CrewAI**                         | Role-based agent teams with delegation              | Python framework, not shell-based. Heavier abstraction. Provider-locked to specific LLMs per agent.                           |
| **LangGraph**                      | Graph-based orchestration with state machines       | Much more structured; compiles to state machines. Overkill for the "launch/kill/relaunch" lifecycle use case.                 |
| **AutoGen**                        | Conversation-driven multi-agent groups              | Microsoft ecosystem. Group chat model vs hierarchical teams.                                                                  |
| **OpenHands**                      | Event-sourced immutable state, pluggable workspaces | Full platform (67.9k stars). Docker-based isolation. Much larger scope.                                                       |

**Where agent-team is well-positioned:**

- Declarative YAML-frontmatter agent definitions are simpler than any competitor's config format
- Tight integration with Claude Code's native agent teams (tmux panes, team config) is unmatched
- The spec's MCP abstraction layer for future provider-agnostic support is aligned with the industry trend (every major platform is adopting MCP)

**Where agent-team trails the industry:**

- No container isolation (OpenHands, Codex have this; it is planned for Phase 9)
- No event-sourced state (OpenHands' key advantage for replay/pause/resume)
- No token optimization (Oh My Claude Code's 93% reduction via session caching)
- No observability built-in (planned in architecture doc section 9, but not implemented)
- No human-in-the-loop gates beyond Claude Code's native permission system

### tmux-Based Approach: Competitive or Limiting?

**Competitive for the current scope.** The tmux approach is validated by multiple community tools (Claude Flow, ntm, ccswarm all use tmux). It is the natural integration point for Claude Code's `--teammate-mode tmux`. For local development with 3-10 agents, tmux provides low overhead, native terminal access, and easy debugging.

**Limiting for the vision.** The 16-phase roadmap targets Docker/K8s/cross-machine orchestration. tmux is inherently single-machine and requires a terminal. The architecture document correctly identifies this as a Phase 9+ concern, but the current code has tmux-specific assumptions baked in (`isTmuxPaneAlive`, `killTmuxPane`, pane ID tracking). These should be abstracted behind a backend interface before Phase 2 to avoid painful refactoring later.

### MCP Abstraction Layer

The mesh MCP server PRD is thorough and well-researched (topology analysis, security model, scalability characteristics, technology choices). The hub-and-spoke topology with Socket.io is the correct choice for the scale being targeted. The file-dumper bridge to Claude Code hooks is a clever integration pattern.

However, the MCP layer is entirely in spec form -- zero implementation exists. Given that MCP adoption is accelerating across the industry (Codex, Gemini, LangGraph, CrewAI all have MCP adapters), this is the most strategically important gap to close after the basic lifecycle works.

## Scalability Analysis

### Current Design Limits

**Agent count:** The current tmux-based design is practical for 3-10 agents. Beyond 10, tmux pane management becomes unwieldy, terminal real estate runs out, and the serial `discoverAgents()` -> iterate -> spawn pattern has no parallelism.

**Config file contention:** `lifecycle.ts` reads and writes `config.json` synchronously with `readFileSync`/`writeFileSync`. With multiple agents being managed concurrently (e.g., batch launch or concurrent cleanup), this creates a race condition. Two `cleanupStaleEntries()` calls running simultaneously could both read, both filter, and one overwrites the other's changes.

**Discovery performance:** `discoverAgents()` does synchronous `readFileSync` for each agent file inside an async function. For 50+ agent files, this would block. The Bun `Glob` iterator is async but each file parse is sync.

### Bottlenecks

1. **Sequential spawning**: Spec calls for sequential batch launch. No parallel spawn support.
2. **File-based team config**: No locking, no atomic updates. Race conditions with concurrent writes.
3. **Tmux pane enumeration**: `isTmuxPaneAlive()` shells out to `tmux list-panes -a` for every health check. With N agents, this is N subprocess spawns.
4. **No agent communication backpressure**: The mesh MCP server design (spec only) handles this with rate limiting, but the current file-based inbox has no mechanism.

### Will It Scale to 10+ Agents?

Not without the planned Phase 2+ work. Specifically:

- Need a backend abstraction (tmux vs Docker vs K8s) before scaling beyond single-machine
- Need file locking or a proper database for team config
- Need async/parallel discovery and spawning
- Need the mesh MCP server for real-time communication (file polling won't scale)

## Security Review

### Credential/Token Handling

**Current state:** No credentials are managed by the codebase. API keys for Claude are expected to be in the environment already. The `spawnAgent()` function passes `process.env` to child processes, which means all parent environment variables (including any secrets) are inherited by every agent. This is a security concern for multi-tenant or production use.

**Planned state:** The mesh MCP server PRD specifies JWT-based authentication with scoped group access. This is a solid design but is entirely unimplemented.

### `--dangerously-skip-permissions` Default

The spec correctly notes this as a migration concern (section 3): the orchestrator defaults to `true` (matching old `claude-team` behavior), while other agents default to `false` (security improvement). The code implements this correctly -- `dangerouslySkipPermissions` defaults to `false` in `parseAgentFile()`.

However, there is no enforcement mechanism to prevent an agent definition from setting `dangerously_skip_permissions: true`. Any agent file author can bypass all permission checks. The planned Security Consultant agent (Phase 13) would address this, but that is 12 phases away.

**Recommendation:** Add a `--require-permission-review` flag that warns or blocks when agent files use `dangerously_skip_permissions: true` without an explicit allowlist. This is a low-cost safety gate.

### Injection Risks

1. **Path traversal in `base_prompt`**: The `readBasePrompt()` function in `prompt.ts` joins the user-provided `base_prompt` path to `projectRoot` without any path traversal check. A frontmatter value like `base_prompt: ../../../etc/passwd` would read arbitrary files. Severity: Medium (attacker must control agent file content, which requires repo write access).

2. **Shell injection via prompt content**: The `bin/agent-launch.ts` dry-run output (lines 153, 289-291) attempts shell escaping with single-quote wrapping and `'\\''` replacement. This is the correct POSIX approach but is fragile. If prompt content contains specific byte sequences, the escaping could fail. Since this is display-only (dry-run), the risk is low. However, the actual `Bun.spawn()` call in `spawnAgent()` passes args as an array, which is safe from shell injection.

3. **Team name injection**: The `teamName` is used to construct file paths (`teamConfigPath()`). While `join()` normalizes paths, there is no validation that `teamName` doesn't contain path separators or special characters. A team name like `../../etc` would resolve to an unexpected path.

4. **Environment variable leakage**: `spawnAgent()` passes `{ ...process.env, ...env }` to child processes. This inherits all parent environment variables, including potential secrets not intended for child agents. Each agent should receive only the variables it needs.

## Recommendations

### Immediate (should fix before v1.0)

1. **Implement actual spawning in the `launch` command.** The `spawnAgent()` function exists. Wire it into the CLI. Without this, the tool's primary purpose is unimplemented. This is the single highest-priority item.

2. **Fix the `health` subcommand** to use `isTmuxPaneAlive()` instead of always reporting UNKNOWN. The logic already exists in `listAgents()` -- it just needs to be used consistently.

3. **Add path traversal protection** for `base_prompt` file reads. Resolve the path, then check it starts with the project root. Reject paths that escape.

4. **Fix the `relaunch` stale discovery bug.** Either re-run `discoverAgents()` after the kill, or document that file changes are not picked up until the next invocation.

5. **Add team name validation.** Reject team names containing path separators, null bytes, or characters that would break file path construction.

6. **Abstract the tmux backend behind an interface.** Create a `Backend` interface with `spawn()`, `kill()`, `isAlive()`, `listPanes()` methods. The current tmux implementation becomes one backend. This unblocks Phase 9 (Docker) without a full rewrite.

### Near-term (next few releases)

7. **Implement the `start` command** for orchestrator self-configuration. This is the entry point that ties the whole system together.

8. **Add file locking for team config writes.** Use `flock` or an atomic-write pattern to prevent concurrent config corruption.

9. **Wire `teamName` into spawn args.** Currently it is accepted but not used. Determine the correct Claude Code flag or Task tool parameter for team membership and include it.

10. **Implement the `--all` batch launch.** This is the primary way users will launch a full team.

11. **Add OTEL resource attributes at spawn time.** Per architecture doc section 9, this is "minimal effort, high value." Set `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` env vars per agent.

12. **Filter environment variables passed to child agents.** Instead of spreading `process.env`, pass only known-safe variables plus agent-specific ones.

### Long-term (architectural evolution)

13. **Implement the mesh MCP server.** This is the most strategically important gap. MCP adoption is accelerating; getting the mesh communication layer working will enable cross-machine teams and provider-agnostic orchestration.

14. **Event-sourced state management.** OpenHands' immutable event log pattern enables replay, pause/resume, and debugging. The current mutable config.json approach will not scale to production use.

15. **Token optimization.** Oh My Claude Code achieves 93% token reduction via session caching. For teams of 5+ agents, token costs are a primary concern. The architecture should track and optimize per-agent token usage.

16. **Container isolation backend.** The Docker/K8s backend (Phase 9/11) is necessary for production security and multi-tenant use. The backend abstraction from recommendation #6 is a prerequisite.

17. **Migrate from `~/.claude/teams/` config dependency.** The current reliance on Claude Code's undocumented internal storage format is the single biggest fragility risk. Consider maintaining a parallel team config in a documented format that the launcher owns, with sync to Claude Code's format as needed.

## Confidence Levels

| Finding                                       | Confidence                                                                                         |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| Launch command does not actually spawn agents | Verified -- read source, confirmed "not yet implemented" message                                   |
| Health always UNKNOWN for health subcommand   | Verified -- read source, confirmed hardcoded "UNKNOWN" on line 108                                 |
| teamName not used in spawn args               | Verified -- `buildSpawnArgs` source confirmed, no team-related flag in output                      |
| Path traversal risk in base_prompt            | High -- `join()` without path validation confirmed in source                                       |
| Config file race condition risk               | High -- synchronous read/write without locking confirmed in source                                 |
| Relaunch uses stale discovery                 | Verified -- `discoverResult` computed on line 121, relaunch on line 178 reuses it                  |
| 54 tests passing                              | Verified -- ran `bun test`, all pass (142ms)                                                       |
| Industry alignment assessment                 | High -- based on 25+ research reports in docs/research/ and direct source review                   |
| Scalability limits at 10+ agents              | Medium-High -- based on tmux architecture analysis and file I/O patterns                           |
| Environment variable leakage concern          | Verified -- `{ ...process.env, ...env }` spread in spawn.ts:104                                    |
| tmux approach is validated by community       | High -- Claude Flow (14.1k stars), ntm, ccswarm all use tmux patterns                              |
| MCP adoption trend                            | High -- documented in orchestration-platforms-index.md with references to Codex, Gemini, LangGraph |

## References

- Agent launcher spec: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/specs/draft/agent-launcher.md`
- Architecture doc: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/specs/draft/agent-team-architecture.md`
- Mesh MCP server PRD: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/specs/draft/mesh-mcp-server.md`
- Multi-repo phase plan: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/specs/draft/multi-repo-phase-plan.md`
- Orchestration platforms survey: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/research/orchestration-platforms-index.md`
- Community orchestration tools: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/research/community-orchestration-tools.md`
- Claude Flow research: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/research/claude-flow.md`
- [GitHub Issue #2692 -- --system-prompt unreliable in interactive mode](https://github.com/anthropics/claude-code/issues/2692)
- [Claude Code Agent Teams docs](https://code.claude.com/docs/en/agent-teams)
