---
type: feature
id: GSD-62
legacy_ids:
  - FXP/1.8
aliases:
  - "FXP/1.8"
created: 2026-05-28T02:24:40Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-642"
    note: "#642: FXP/1.12 PARENT pr-status-cli + skill (broken down — see #643+)"
  - id: fixprompt-source
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L28
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
  - id: discord-next-task
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509379165923709049
events:
  - {
      ts: 2026-05-28T02:24:40Z,
      by: alex,
      change: "created from fixprompt.md FXP/1.8 line; Nate Discord 02:13Z designated this as the next FXP task",
    }
---

# FXP/1.8 — quick-and-scrappy MCP ticket server (bun/ts)

## Original ask

From [fixprompt.md L28][^fixprompt-source]:

> PDITID build a quick and scrappy mcp server using bun/ts/modelcontextprotocol-sdk that offers the same basic ticket tooling functionality we've been trying to get all night. I don't want any manual management. The mcp server will be run in watch mode so any changes you make immediately become visible to you (after the mcp server finishes restarting). I don't want to lose any of the tickets or triage stuff we've done now, so make sure it gets absorbed into the new structure for the tickets. Lets simplify it as much as we can without losing fidelity, For example we can ditch the frontmatter references, and just use the footnote format. Update the ticket management skills appropriately. Simplify them greatly, and put the management effort on the mcp server.

Nate Discord 2026-05-28 02:13Z[^discord-next-task]: "Next task is gonna be FXP/1.8."

## Goal

Stand up a Bun/TypeScript MCP server (using `@modelcontextprotocol/sdk`) that exposes ticket CRUD primitives directly to claude — replacing the current bash/python/skill-driven workflow with native tool calls. Run in `--watch` mode so iteration is hot-reload.

## Scope

In:

- New repo or new dir (TBD — likely a new `apps/ticket-mcp/` in `nsheaps/agents` or a fresh `nsheaps/ticket-mcp` repo per Nate's preference)
- `@modelcontextprotocol/sdk` server skeleton, stdio transport (matches existing MCP plugin pattern)
- Tool surface (minimum):
  - `ticket_list` (filter by state/project/priority/assignee)
  - `ticket_get` (by id)
  - `ticket_create` (new ticket — auto-assign next GSD-N)
  - `ticket_update` (frontmatter + body edits, event-log append)
  - `ticket_promote` (state transition: triage → in-progress → done; emits event)
- Absorb existing 61 GSD tickets without data loss (read on startup, no migration step required)
- Drop frontmatter `references` field; use markdown footnote format `[^id]` exclusively (per the ask)
- Watch mode (`bun --watch` or `tsx --watch` equivalent)
- Update the project-tracking-workflow skill + ticket-updater agent to delegate to MCP tools where overlap exists; deprecate manual file-edit paths

Out:

- Web UI (CLI/MCP only)
- Auth/multi-user (single-agent local server)
- Cross-repo ticket federation
- Backend swap (still markdown files under `projects/<P>/tickets/`)

## Blocked by

- FXP/1.7 — agent teams enabled (1.7.1 ✅ done; 1.7.2/1.7.3 spawn-auth-gap is task #631, may not block this — to confirm at design step)

## Open Questions

- (Q1) Home: new dir in `nsheaps/agents` (e.g. `apps/ticket-mcp/`) or new repo `nsheaps/ticket-mcp`?
- (Q2) Should the MCP server enforce the schema in `.metadata/schema-ticket.yaml`, or just accept dicts and trust the writer?
- (Q3) Drop the `references` frontmatter list entirely AND retro-migrate existing 61 tickets to footnotes? Or new-tickets-only?
- (Q4) Watch-mode UX: when the MCP server restarts, claude has to reconnect. Acceptable cadence?
- (Q5) Does this supersede the `ticket-updater` agent, or does ticket-updater wrap MCP tools?

## Acceptance criteria (per PDITID)

- MCP server starts, registers tools via `mcp__plugin_<name>__<tool>` namespace, claude can call them.
- All 61 existing GSD tickets readable + listable via `ticket_list`.
- `ticket_create` writes a new ticket file with correct GSD-N, frontmatter matching schema, footnote-format references.
- `ticket_update` correctly appends events without clobbering body.
- Watch mode reloads on source edit; claude's MCP connection survives or reconnects within ≤5s.
- Skill `project-tracking-workflow` updated to reference MCP tools.
- PR green, approved, merged, MCP server installed in alex's `.mcp.json` and verified working end-to-end (per OPDPITID).

## Related

- [Fixprompt dashboard][^fixprompt-dashboard] — issue #20
- FXP/1.9 (GSD-63) — skill-tools-hook, blocked by this
- FXP/1.10 (GSD-64) — host alex-local plugins (different scope, parallel)
- task-utils plugin (`nsheaps/agents/plugins/claude-code/task-utils/`) — file-based predecessor

[^fixprompt-source]: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L28

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20

[^discord-next-task]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509379165923709049
