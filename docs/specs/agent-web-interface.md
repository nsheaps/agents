---
name: agent-web-interface
status: draft
description: Web interface for managing agents — viewing status, sending messages, reviewing work, and controlling agent lifecycle
parent:
related:
  - agent-harness-lifecycle
  - agent-team-architecture
  - observability
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

## Known Requirements

- View agent status (running, idle, error) for all registered agents
- Send messages to agents and view their responses
- Browse recent task history and associated commits/PRs
- Start, stop, and restart agents
- View live logs

## Open Questions

- What auth mechanism? (handler SSO, shared secret, local-only?)
- Should it be read-only first, or include full control from day one?
- Self-hosted only or deployable to a cloud endpoint?
- Needs design input from handler before implementation begins.
