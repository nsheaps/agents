---
type: chore
id: GSD-75
legacy_ids:
  - FXP/1.7.1
created: 2026-05-28T03:15:00Z
state: done
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-source
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L27
  - id: settings-local
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/.claude/settings.local.json
  - id: agent-env-sh
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/bin/lib/agent-env.sh#L63
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
events:
  - {
      ts: 2026-05-28T03:15:00Z,
      by: alex,
      change: "backfilled — env var enabled in settings.local.json (gitignored), ticket created retroactively per Nate Discord 02:30Z directive to GSD-link existing Phase-1 done items",
    }
---

# FXP/1.7.1 — CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 env var enabled

## Original ask

From [fixprompt.md L27][^fixprompt-source]:

> enable claude agent teams, and /restart yourself. Make an alex-brain team.

## Status

**state=done** — `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` added to alex's [`.claude/settings.local.json`][^settings-local] (gitignored, so not in the public commit history). The env var is also referenced in [`bin/lib/agent-env.sh` line 63][^agent-env-sh] for launcher-level injection. Agent teams feature is now active for the alex session.

Note: FXP/1.7 encompasses the broader "enable agent teams + restart + make alex-brain team" ask. This ticket (1.7.1) covers the env var enablement portion only. The alex-brain team setup is a separate sub-deliverable.

## Related

- [GSD-62](./GSD-62-fxp-1-8-bun-ts-mcp-ticket-server.md) — FXP/1.8 (ticket server, also enabled via agent teams capability)
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-source]: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L27

[^settings-local]: https://github.com/nsheaps/.ai-agent-alex/blob/main/.claude/settings.local.json

[^agent-env-sh]: https://github.com/nsheaps/.ai-agent-alex/blob/main/bin/lib/agent-env.sh#L63

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
