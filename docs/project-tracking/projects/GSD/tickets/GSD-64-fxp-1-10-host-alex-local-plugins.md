---
type: feature
id: GSD-64
legacy_ids:
  - FXP/1.10
aliases:
  - "FXP/1.10"
created: 2026-05-28T02:30:00Z
state: triage
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-633"
    note: "#633: FXP/1.10: host alex-local hooks/skills into nsheaps/agents plugins (design call "
  - id: task-633
    type: task
    url: alex-task://633
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
events:
  - {
      ts: 2026-05-28T02:30:00Z,
      by: alex,
      change: "created from alex-task #633 (Nate Discord 18:47Z) — promoted to FXP/1.10 numbering",
    }
---

# FXP/1.10 — host alex-local hooks/skills into nsheaps/agents plugins

## Original ask

From alex-task #633 (Nate Discord 2026-05-27 18:47Z)[^task-633]:

> promote alex-local artifacts from this exercise (task-sync hook, developing-plugins-locally skill, hookify configs incl auto-commit-watched.py, agent-task-binding hook) into nsheaps/agents plugins so jack/henry get parity. He explicitly wants to talk about it before dispatch — no work yet.

## Goal

Migrate the alex-only hooks/skills/configs that have stabilized in `nsheaps/.ai-agent-alex/.claude/` into shared plugins under `nsheaps/agents/plugins/` (or `nsheaps/ai-mktpl/`) so jack and henry get them automatically.

## Scope (preliminary — design call required before execution)

Candidates to promote:

- `task-sync` hook (auto-sync $CLAUDE_CONFIG_DIR/tasks → repo)
- `developing-plugins-locally` skill
- `hookify` configs including `auto-commit-watched.py`
- `agent-task-binding` hook

Per-candidate decision needed:

- Promote as-is to which plugin? (existing plugin vs new plugin)
- Generalize beyond alex-specific paths? (most use `$HOME/.agents/alex/...` patterns)
- Roll out to jack/henry — automatic via `enabledPlugins`, or opt-in?

Out:

- Promoting unstable or experimental artifacts (anything <1 week old in alex's repo).
- Cross-agent identity-specific configs (those stay agent-local).

## Blocked by

- **Design call with Nate** (per "He explicitly wants to talk about it before dispatch — no work yet"). Do not start migration until Nate green-lights specific items.

## Open Questions

- (Q1) Which plugin(s) absorb these? `agentic-behavior`, `claude-utils`, new `agent-orchestration` plugin?
- (Q2) How to generalize `$HOME/.agents/alex/...` paths to work for arbitrary agent identity?
- (Q3) Do jack/henry pick this up via their `enabledPlugins` settings (and we just enable post-merge), or do we need a coordinated install rollout?
- (Q4) Should task-sync be part of `task-utils` plugin (where the task tools live) rather than a standalone hook?

## Acceptance criteria

- Design call held; per-artifact promotion decisions captured in this ticket.
- For each green-lit artifact: PR to nsheaps/agents (or ai-mktpl) with the migration.
- jack + henry verifying parity in their next session after rollout.

## Related

- FXP/1.8 ([GSD-62](./GSD-62-fxp-1-8-bun-ts-mcp-ticket-server.md))
- FXP/1.9 ([GSD-63](./GSD-63-fxp-1-9-skill-tools-hook.md)) — produces another candidate (skill-tools-hook itself) for eventual promotion to skill-utils.
- FXP/1.11 ([GSD-65](./GSD-65-fxp-1-11-subagentstop-reflection-hook.md)) — SubagentStop reflection hook (already done; may be a promotion candidate too).

## Note on dashboard absence

This item never made it to the [fixprompt dashboard][^fixprompt-dashboard] (issue #20) because the source `fixprompt.md` caps at numbered bullet 9; FXP/1.10+ items were added in subsequent Discord conversations and tracked only as alex-tasks until now. This ticket closes that gap.

[^task-633]: alex-task://633 — local agent task, see also Nate Discord 2026-05-27 18:47Z

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
