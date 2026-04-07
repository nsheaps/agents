---
status: draft
---
# Plugin System Design

## Problem Statement

The `ai-mktpl` marketplace is the primary mechanism for distributing shared agent
behaviors across multiple agents. Plugins configure rules, skills, hooks, agents, and
MCP servers. The relationship between the marketplace, individual plugins, and agent
harness configuration needs to be codified so new agents can be set up consistently.

## Design Decisions

1. **Plugin marketplace as the distribution mechanism**: Shared agent behaviors are
   packaged as plugins in `nsheaps/ai-mktpl` and installed into each agent via
   `claude plugin marketplace add`. This is the established pattern in use across
   Jack and Henry. Source: `docs/research/ai-mktpl-deep-dive.md` in ai-agent-jack;
   `docs/research/behavioral-plugins.md`.

2. **Plugin components** (as of ai-mktpl current structure):
   - `rules/` — markdown files loaded into every Claude Code API call as CLAUDE.md
     system context
   - `skills/` — step-by-step task instructions recalled via the Skill tool
   - `hooks/` — lifecycle scripts (SessionStart, PreToolUse, PostToolUse, Stop)
   - `agents/` — agent definitions with frontmatter (model, tools, etc.)
   - `mcpServers/` — MCP server configuration
   Source: `docs/research/ai-mktpl-deep-dive.md`.

3. **Secret injection via `plugins.settings.yaml`**: Each agent declares 1Password
   item references (`op://vault/item`) in its `plugins.settings.yaml`. The `1pass`
   plugin's `op-exec` reads these at launcher startup and injects the resolved values
   as environment variables before `claude` is invoked.
   Source: `docs/research/1pass-opexec-injection.md`.

4. **`userSettings` injection target is NOT used on shared machines**: Writing agent-
   specific secrets to `~/.claude/settings.local.json` would leak them to other agents
   (Jack, Henry, Pamela) sharing the same machine. The `sessionStartBashEnv` target
   (via `CLAUDE_ENV_FILE`) is used instead.
   Source: `docs/research/1pass-opexec-injection.md`; `.claude/rules/secrets-and-shared-machine.md`.

5. **CLAUDE_ENV_FILE hook timing issue**: Secrets written to `CLAUDE_ENV_FILE` from a
   `SessionStart` hook are not available to the Bash tool at runtime because Claude Code
   does not re-source the file after hooks complete. The workaround is to run `op-exec`
   in the launcher script before invoking `claude`, ensuring secrets are in the process
   environment from the start.
   Source: `docs/research/1pass-opexec-injection.md`.

6. **`marketplace remove` is destructive**: Running `claude plugin marketplace remove`
   removes the marketplace config AND all associated `enabledPlugins` entries, instantly
   unconfiguring all plugins. To update a marketplace URL, use
   `claude plugin marketplace update` or edit `settings.json` directly.
   Source: `.claude/rules/plugin-safety.md` in ai-agent-jack;
   incident `incidents/behavioral/2026-03-25--marketplace-remove-destructive.md`.

7. **Agents monorepo vision** (long-term): The handler's vision combines agents, MCP
   servers, and the agent-team orchestrator into a single monorepo. Plugin distribution
   would be part of this unified structure. This is tracked as agents#111 and is not
   currently implemented. Source: `.claude/memory/vision-architecture.md` in ai-agent-jack;
   nsheaps/agents issue #111.

8. **PR review automation via claude-agent workflow**: The `ai-mktpl` repo has a
   `claude-agent-trigger.yaml` workflow that triggers Claude Code on `@claude` mentions
   in PR comments. A PR opened by Henry (`henry-nsheaps[bot]`) that contained
   `plugin-dev@claude-plugins-official` (substring match on `@claude`) caused a false
   positive trigger. Source: `docs/research/pr390-critical-investigation.md`.

## Open Questions

- Should agent-specific plugin configurations (e.g., which Telegram bot to use per
  agent) live in the agent's repo or in `ai-mktpl`?
- What is the migration path from the current per-repo `bin/agent` + `plugins.settings.yaml`
  setup to the agents monorepo vision?
- The `marketplace remove` bug: should there be a confirmation step or dry-run option
  added to the `claude plugin` CLI?

## References

- `docs/research/ai-mktpl-deep-dive.md` in ai-agent-jack
- `docs/research/behavioral-plugins.md` in ai-agent-jack
- `docs/research/1pass-opexec-injection.md` in ai-agent-jack
- `.claude/rules/plugin-safety.md` in ai-agent-jack
- `.claude/rules/secrets-and-shared-machine.md` in ai-agent-jack
- nsheaps/ai-mktpl — marketplace source
- nsheaps/agents issue #111 (monorepo vision)
- [nsheaps/ai-mktpl PR #311](https://github.com/nsheaps/ai-mktpl/pull/311) — op-exec whole-item injection
