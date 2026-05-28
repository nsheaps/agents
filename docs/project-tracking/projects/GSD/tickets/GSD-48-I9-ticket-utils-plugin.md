---
type: feature
id: GSD-48
legacy_ids:
  - I9
aliases:
  - "I9"
created: 2026-05-25T02:00:00Z
state: triage
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-611"
    note: "#611: AGENT(triager-v2): Process to-triage chronologically per new spec (14 items)"
  - id: master-md-bullet
    type: doc
    url: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md
  - id: discord-arch-answers
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508286485273640980
  - id: to-triage-source
    type: doc
    url: ../../to-triage/I9-ticket-utils.md
events:
  - {
      ts: 2026-05-25T02:00:00Z,
      by: alex,
      change: "created from MASTER.md I9 bullet + per-task doc I9-ticket-utils.md",
    }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-48 (state=triage) per triager-v2 workflow",
    }
---

# I9 — ticket-utils plugin (file-backed ticket-manage skill, mirrors task-utils)

## Original ask (MASTER.md I9)

> 🆕 `I9`: extract the project-tracking task skill stuff into scripts and skills if they're not already that will help you make the changes without manually making updates to each file. be scrappy. minimum needed changes. task-utils basically does this so we're just optimizing your token use. At minimum capture the updates in an sonnet agent instead of you doing the work 10. make the task updating skill use context:fork
>
> - This is ticket-utils. look this up in other files, we're not starting from scratch. we just need basic scripts that act like task-utils, but for tickets (right now we'll just use a file backend in the repo). Look at agents#157 for an idea of how task-utils does it, right now we just need fast and scrappy, we'll do ts later. Since this is also all encapsulated in a skill ticket-manage, with context:fork, running scripts is okay
>   - If you think it's easier, scripts can be ts/bun scripts for later integration
>   - Or if it's even easier, use the modelcontextprotocol.io sdk to make an mcp server to use with the skill instead of scripts
> - unlike tasks, tickets are more complex objects. For now the added complexity is a milestone, and a team (like linear, this ends up being part of the ticket ID), which the ticket-utils should also allow you to create and track.
> - the plugin should make it as easy as calling your task utils to create and update tickets, rather than you managing and editing the files yourself
> - You should also describe how to track work in the tickets, and link artifacts (like PRs, chat messages, etc) into the ticket.
> - Think of Tasks as your internal tracking, and Tickets being within the organization
> - Tickets support multiple backends in the future, including github issues and linear, but for now we're doing file only

## Architecture answers (Nate Discord 01:52Z)[^discord-arch-answers]

- **API surface:** mirror `task-utils` — `ticket-create`, `ticket-update`, `ticket-list`, `ticket-get`, `ticket-link-artifact` (PR/issue/Discord-msg). Skill `ticket-manage` uses `context: fork`.
- **Backend:** file-only for now (`docs/tickets/<team>/<ticket-id>-<slug>.md`), MCP server (preferred) or bash scripts (acceptable). Future: github issues + linear.
- **Skill location:** `plugins/ticket-utils/` in `nsheaps/agents` repo; iterate via local-worktree-as-marketplace pattern before PR back to upstream.
- **Milestone model:** Linear-style — each milestone is a collection of tickets; tickets have `team` and `milestone` fields baked into the ticket ID.

## Scope

Build a minimum-viable `ticket-utils` plugin that lets alex manage ticket files via skill+script invocation rather than direct file edits. **Scrappy first**: scripts or MCP, whichever ships fastest.

**In scope:**

1. `plugins/ticket-utils/.claude-plugin/plugin.json` + `README.md`
2. Skill `skills/ticket-manage/SKILL.md` with `context: fork`
3. Backend: file CRUD on `docs/project-tracking/projects/<project>/tickets/<ticket-id>-<slug>.md`. Pick ONE: Bash/Python scripts OR MCP server via `@modelcontextprotocol/sdk`
4. CLI/MCP tools: `ticket-create`, `ticket-update`, `ticket-list`, `ticket-get`, `ticket-link-artifact`
5. Milestone primitive (Linear-style): `milestone-create`, `milestone-list-tickets`
6. Skill `ticket-manage` documents the artifact-linking workflow + Tasks vs Tickets relationship

**Out of scope:**

- TypeScript/Bun monorepo (do bash/python first)
- Github Issues backend, Linear backend
- Ticket templates beyond raw markdown

## Open questions for grooming

1. **MCP-server vs scripts trade-off:** MCP gives event-driven hooks and works cross-platform from skills; scripts are simpler. Propose MCP-first.
2. **Folder hierarchy:** `docs/tickets/<team>/<status>/<ticket-id>-<slug>.md` OR `docs/tickets/<team>/<milestone>/<ticket-id>-<slug>.md`?
3. **Ticket ID format:** `<TEAM>-<NUM>` (e.g. `GSD-001`) — aligns with current GSD-N convention.

## Acceptance criteria

- `ticket-create`, `ticket-update`, `ticket-list`, `ticket-get`, `ticket-link-artifact` tools exist and work.
- `ticket-manage` skill uses `context: fork`.
- Milestone primitive works (create + list-tickets).
- Plugin installs from `nsheaps/agents` marketplace entry.
- At least 5 active tickets migrated via the tool as proof-of-workflow.

## Blocked by

- GSD-49 (I31) — defines the per-ticket file structure that ticket-utils will read/write. Needs to land first (or co-land).

[^discord-arch-answers]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508286485273640980
