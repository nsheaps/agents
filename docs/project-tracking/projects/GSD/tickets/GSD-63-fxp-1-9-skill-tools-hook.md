---
type: feature
id: GSD-63
legacy_ids:
  - FXP/1.9
created: 2026-05-28T02:30:00Z
state: triage
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-source
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
events:
  - { ts: 2026-05-28T02:30:00Z, by: alex, change: "created from fixprompt.md FXP/1.9 line" }
---

# FXP/1.9 — skill-tools-hook (tools-only-inside-skills enforcement)

## Original ask

From [fixprompt.md][^fixprompt-source]:

> PDITID make a ticket for this, and capture plans and designs within or linked from the ticket. Add a set of hooks to your repo. With a configurable whitelist of tools or entire mcp servers, make it so you can't call any tools outside of a skill. Later this will be replaced by hooks in the skill-utils plugin. Make the error say "use a skill specific to this tool. If using Bash(), use a skill specific to the CLI command(s) you are calling. If one doesn't exist you must make it. Call skills within skills to load instructions for all needed tools to complete this task, not just one.". Pretooluse on skill tracks the hierarchy of skills in use and ensures the hierarchy is >=1 in depth to allow tools). Posttooluse updates the tracking, and reminds the agent to update the skill with anything it's learned. I want to follow the ticket through PR creation, merging, and ticket completion.

## Goal

Enforce "tools must be invoked from within a Skill" at the PreToolUse layer, with a configurable whitelist for exempt tools/MCP servers. Capture per-tool-call skill hierarchy via Pre/PostToolUse hooks. Posttool reminds the agent to update the active skill with learnings.

## Scope

In:

- PreToolUse hook: maintains a skill-hierarchy stack (via SkillStart/SkillEnd signals or equivalent). On any non-whitelisted tool call, require `hierarchy_depth >= 1`. On violation, return the specific error message verbatim (see Original ask).
- PostToolUse hook: updates tracking; emits reminder to update the active skill.
- Configurable whitelist: tool names (e.g. `Read`, `Bash`) and/or entire MCP server prefixes (e.g. `mcp__plugin_discord_*`).
- Lives in alex's repo as `.claude/hooks/skill-tools-hook.{sh,py}` initially (per "in your repo"). Will be superseded by skill-utils plugin later — track as such.
- Plan + design captured in this ticket body (per ask).
- Followed through to PR + merge + ticket completion.

Out:

- The eventual skill-utils plugin port (separate work).
- Cross-agent rollout (alex-only initially; jack/henry adopt via plugin port).

## Blocked by

- FXP/1.8 (GSD-62) — MCP ticket server; loosely (this is independent code, but Nate's queue order puts 1.8 first).

## Open Questions

- (Q1) How is "currently inside a skill" detected? Options: (a) Skill tool's PreToolUse fires a marker; (b) inspect stack from `SkillStart`/`SkillEnd` lifecycle events if exposed; (c) parse session transcript live. Need to confirm what Claude Code exposes.
- (Q2) Whitelist source: JSON in `.claude/settings.json`, separate YAML, or env var?
- (Q3) How does the hook know about nested-skill depth? PreToolUse for the `Skill` tool itself increments; PostToolUse decrements?
- (Q4) Should the error message be EXACTLY the wording Nate gave, or templatable per-tool?

## Acceptance criteria

- Hook installed in alex's repo; whitelist configurable.
- Calling a non-whitelisted tool outside a Skill → blocked with the verbatim error.
- Calling the same tool from inside a Skill → allowed; PostToolUse appends a reminder.
- Skill-hierarchy stack correctly tracks nested skills (skill-within-skill).
- PR created, merged, ticket flipped to done.

## Related

- FXP/1.8 ([GSD-62](./GSD-62-fxp-1-8-bun-ts-mcp-ticket-server.md)) — predecessor in queue order.
- Future: skill-utils plugin in `nsheaps/ai-mktpl` (eventual home for these hooks).

[^fixprompt-source]: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md
