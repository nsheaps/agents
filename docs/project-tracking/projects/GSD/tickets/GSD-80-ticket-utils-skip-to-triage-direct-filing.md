---
type: chore
id: GSD-80
state: in-progress
created: "2026-05-28T19:46:53Z"
project: GSD
priority: 2
assignee: "contacts://nsheaps-org/byAgentName/alex"
requester: "contacts://nsheaps-org/byGithubUsername/nsheaps"
references:
  - id: nate-discord-2026-05-28
    type: discord-message
    url: "https://discord.com/channels/1490863845252665415/1497431286661517353/1509642468315103233"
  - id: pr-alex-26
    type: github-pr
    url: "https://github.com/nsheaps/.ai-agent-alex/pull/26"
  - id: pr-agents-192
    type: github-pr
    url: "https://github.com/nsheaps/agents/pull/192"
events:
  - ts: "2026-05-28T19:46:53Z"
    by: "contacts://nsheaps-org/byAgentName/alex"
    change: "created; state=in-progress; PRs filed: nsheaps/.ai-agent-alex#26, nsheaps/agents#192"
  - ts: "2026-05-28T19:48:00Z"
    by: "contacts://nsheaps-org/byGithubUsername/nsheaps"
    change: "review comment on PR #192 — add Step 0 determine-project callout before triage"
  - ts: "2026-05-28T20:00:00Z"
    by: "contacts://nsheaps-org/byAgentName/alex"
    change: "addressed review comment; commit ef3c575 on nsheaps/agents#192; PR comment https://github.com/nsheaps/agents/pull/192#issuecomment-4567779361"
---

## Goal

Update ticket-utils process skills so that new asks file directly into
`projects/GSD/tickets/GSD-NNN-*.md` with `state: triage`, skipping the
intermediate `to-triage/` staging step entirely.

## Original ask

Per Nate Discord [2026-05-28T19:40Z][nate-discord-2026-05-28]:

> "fix the ticket-utils process skills (even before the mcp server) so that you
> just go straight to a ticket in the triage state, rather than the to-triage
> pattern which will be what the mcp server does anyway"

## Scope

**In:**

- `project-tracking-workflow` SKILL.md in `.ai-agent-alex` — replace the
  IDs-at-INTAKE/TRIAGE rule with a direct-to-tickets/ rule.
- `ticket-updater.md` agent prompt in `.ai-agent-alex` — remove stale
  `to-triage/` example path and directive.
- `docs/project-tracking/CLAUDE.md` in `agents` — mark `to-triage/` as legacy.
- `docs/project-tracking/to-triage/CLAUDE.md` in `agents` — rewrite as
  deprecated-folder doc; add "New intake flow" section.

**Out:**

- Cleaning up existing `to-triage/` backlog files (separate sweep).
- schema-ticket.yaml changes (schema already has `state: triage` as initial
  state — no changes needed).
- Triager/triager-v2 agent deprecation — those are scratch files, not agent
  definitions. No action needed.

## Deliverables

- [PR #26 in nsheaps/.ai-agent-alex][pr-alex-26]: skill + agent prompt updates
- [PR #192 in nsheaps/agents][pr-agents-192]: doctrine + CLAUDE.md updates

## Validation

- [ ] SKILL.md no longer mentions creating a file in `to-triage/` first
- [ ] `ticket-updater.md` example path references `projects/GSD/tickets/`
- [ ] `docs/project-tracking/CLAUDE.md` marks `to-triage/` as legacy
- [ ] `to-triage/CLAUDE.md` has clear "New intake flow" section
- [x] Step 0 "determine project (default GSD)" added before triage step in both CLAUDE.md files (commit [`ef3c575`](https://github.com/nsheaps/agents/commit/ef3c575))
- [ ] Both PRs merged

[nate-discord-2026-05-28]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509642468315103233
[pr-alex-26]: https://github.com/nsheaps/.ai-agent-alex/pull/26
[pr-agents-192]: https://github.com/nsheaps/agents/pull/192
