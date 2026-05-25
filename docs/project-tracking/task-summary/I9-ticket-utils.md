# I9 — ticket-utils plugin (file-backed ticket-manage skill, mirrors task-utils)

## Original message

From [MASTER.md `## make ticket-utils` section bullet `I9`](https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md#I9):

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

**Architecture answers** from Nate Discord [`1508286485273640980`](https://discord.com/channels/1490863845252665415/1497431286661517353/1508286485273640980) (2026-05-25 01:52Z), cross-referenced from [I31 per-task doc](./I31-per-ticket-file-structure.md):

- **API surface:** mirror `task-utils` — `ticket-create`, `ticket-update`, `ticket-list`, `ticket-get`, `ticket-link-artifact` (PR/issue/Discord-msg). Skill `ticket-manage` uses `context: fork`.
- **Backend:** file-only for now (`docs/tickets/<team>/<ticket-id>-<slug>.md`), MCP server (preferred) or bash scripts (acceptable). Future: github issues + linear.
- **Skill location:** `plugins/ticket-utils/` in `nsheaps/agents` repo; iterate via local-worktree-as-marketplace pattern before PR back to upstream.
- **Milestone model:** Linear-style — each milestone is a collection of tickets; tickets have `team` and `milestone` fields baked into the ticket ID.

## Scope

Build a minimum-viable `ticket-utils` plugin that lets alex manage `docs/tickets/**/*.md` files via skill+script invocation rather than direct file edits. **Scrappy first**: scripts or MCP, whichever ships fastest; we'll harden to TS later.

**In scope:**

1. `plugins/ticket-utils/.claude-plugin/plugin.json` + `README.md`
2. Skill `skills/ticket-manage/SKILL.md` with `context: fork`
3. Backend: file CRUD on `docs/tickets/<team>/<ticket-id>-<slug>.md`. Pick ONE of:
   - Bash/Python scripts under `plugins/ticket-utils/bin/`
   - MCP server via `@modelcontextprotocol/sdk` under `plugins/ticket-utils/mcp/`
4. CLI/MCP tools:
   - `ticket-create <team> <title>` → returns ticket-id + path
   - `ticket-update <ticket-id> <field=value>...` → updates ticket frontmatter or sections
   - `ticket-list [--team=X] [--milestone=Y] [--status=Z]` → lists matching tickets
   - `ticket-get <ticket-id>` → returns ticket content as JSON
   - `ticket-link-artifact <ticket-id> <type> <url>` → appends to a "Linked artifacts" section
5. Milestone primitive (Linear-style):
   - `milestone-create <team> <name>` → milestone dir or file
   - `milestone-list-tickets <milestone-id>` → list of tickets in milestone
6. Skill `ticket-manage` documents:
   - When to use ticket-utils vs handling tickets manually
   - Artifact-linking workflow (PR closed, Discord msg referenced, etc.)
   - Relationship: `tasks` = internal alex tracker, `tickets` = organization-visible work

**Out of scope (deferred):**

- TypeScript/Bun monorepo (do bash/python first)
- Github Issues backend
- Linear backend
- Ticket templates beyond raw markdown
- TOC auto-generation (covered by `I34`)

## Scope review / ask

**Open questions for Nate:**

1. **MCP-server vs scripts trade-off:** MCP gives event-driven hooks (no polling) and works cross-platform from skills; scripts are simpler to bootstrap. Per directive "use what's easier" + plugin-dev MCP-channel directive at [02:20Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1508293612880920627) (I42), MCP-first seems right — confirm?
2. **Folder hierarchy under `docs/tickets/`:** Per I31 doc, "Design and define your own folder hierarchy but keep it organized" — propose `docs/tickets/<team>/<status>/<ticket-id>-<slug>.md`? OR `docs/tickets/<team>/<milestone>/<ticket-id>-<slug>.md`? (Status changes more often than milestone, so milestone-first may be cleaner.)
3. **Ticket ID format:** Linear uses `<TEAM>-<NUM>` (e.g. `ALEX-42`). Propose `<TEAM>-<NUM>` (e.g. `AGT-001` for `agents` team, `MKT-001` for `ai-mktpl` team) replacing the current `I/C/E` letter-prefix scheme — OR keep `I/C/E` as the "intake/cleanup/end-state" category-prefix and prepend team (`AGT-I001`)?
4. **Where do alex-internal N-numbers fit?** They're now mapped to MASTER.md I-numbers per the rule we just landed. Once ticket-utils is the source of truth, do N-numbers still exist or do they collapse into ticket-IDs?

## Deliverables

- [ ] PR on `nsheaps/agents` introducing `plugins/ticket-utils/` (mirror PR #142 task-utils as template)
- [ ] First migration: convert ~5 active MASTER.md I-bullets into per-ticket files via the new tool (proving the workflow)
- [ ] Update `project-tracking-workflow` skill to call ticket-utils instead of direct file edits
- [ ] Documentation: README, skill SKILL.md, and one journal entry on the architectural choices

## Plan

**Phase 1 — Scaffold (1 PR):**

1. Worktree on `nsheaps/agents` under `feat/ticket-utils-plugin`
2. Plugin skeleton: `plugins/ticket-utils/.claude-plugin/plugin.json` (version 0.1.0)
3. Skill `ticket-manage` with `context: fork` frontmatter, body stub
4. Decide tool backend (MCP vs scripts) — see scope-review Q1
5. Implement tool 1 (`ticket-create`) end-to-end as proof
6. PR with `request-review` label

**Phase 2 — CRUD (1 PR):**

1. Implement `ticket-update`, `ticket-list`, `ticket-get`, `ticket-link-artifact`
2. Implement milestone tools
3. Tests (jest or bash)
4. PR

**Phase 3 — Migration (1 PR):**

1. Convert 5 active MASTER.md I-bullets to per-ticket files via the tool
2. Verify drill-down + artifact-linking workflow end-to-end
3. Update `project-tracking-workflow` skill to use ticket-utils
4. PR

**Blocked-by:**

- [I31](./I31-per-ticket-file-structure.md) — defines the per-ticket file structure that ticket-utils will read/write. Needs to land first (or co-land).
- Nate's answers on scope-review Q1-Q4

## Status

🆕 Planning. Awaiting scope-review answers before Phase 1.
