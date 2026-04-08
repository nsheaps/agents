---
name: agent-web-interface
status: draft
description: Web interface for managing agents — viewing status, sending messages, reviewing work, and controlling agent lifecycle
parent:
related:
  - agent-harness-lifecycle
  - agent-team-architecture
  - observability
  - web-session-orchestration
owner: jack
created: 2026-04-08
updated: 2026-04-08
tags:
  - web
  - interface
  - management
---
# Agent Web Interface

## Problem Statement

Agents are currently managed entirely through Telegram and terminal. There is no
browser-based interface for viewing agent status, reviewing recent work, sending
messages, or controlling agent lifecycle. A web interface would make agent management
accessible without requiring Telegram access and would enable richer views (logs,
diffs, task history).

## Architecture

Two components:

### agents-api (backend)
- REST/GraphQL API serving agent state, transcripts, task history, PR/issue data
- Agents query this via MCP tools or skills — replaces manual transcript parsing and gh CLI calls
- Source of truth for cross-agent state (who's working on what, sub-agent message IDs, etc.)
- Aggregates data from: GitHub API, Discord/Telegram channels, agent transcripts, task databases

### agent-web / agent-ui (frontend)
- Web interface consuming agents-api
- Real-time updates via WebSocket/SSE
- Replaces Telegram/terminal for non-urgent agent management

## Known Requirements

- View agent status (running, idle, error) for all registered agents
- Send messages to agents and view their responses
- Browse recent task history and associated commits/PRs
- Start, stop, and restart agents
- View live logs and transcripts (including sub-agents)
- Query agent state programmatically (agents can self-query via skills/MCP)
- Sub-agent message ID tracking (eliminates need to parse transcripts manually)
- PR/issue cross-linking view (which threads, PRs, issues are related)

## Open Questions

- What auth mechanism? (handler SSO, shared secret, local-only?)
- Should it be read-only first, or include full control from day one?
- Self-hosted only or deployable to a cloud endpoint?
- agents-api framework? (Bun/Hono, Express, Fastify?)
- Database for agent state? (SQLite for local, Postgres for multi-agent?)
- How do agents authenticate to agents-api? (shared secret, agent-specific tokens?)
- Needs design input from handler before implementation begins.

## Source

- Discord thread: https://discord.com/channels/1490863845252665415/1491513321269235793
