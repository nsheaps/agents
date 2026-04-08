---
name: contacts-system
status: draft
description: Shared contacts/directory system for agents — people, other agents, and their capabilities, channels, and trust levels
parent:
related:
  - agent-directory
  - channel-management
  - agent-communication-protocol
owner: jack
created: 2026-04-08
updated: 2026-04-08
tags:
  - contacts
  - discovery
  - multi-agent
---
# Contacts System

## Problem Statement

Each agent currently maintains its own contacts in isolation (e.g. Jack's contacts
live in `.ai-agent-jack/.claude/contacts/` with files per person/agent). There is
no shared source of truth for who exists, how to reach them, or what capabilities
they have. This creates duplication and drift as contacts are updated in one agent
but not others.

## Known Contacts (as of 2026-04-08)

Jack's current contacts include: ai-agent-henry, ai-agent-pamela, jared, mark-cohen,
nate-heaps, rachel-heaps, sarah-huynh.

## Known Requirements

- Single shared contacts store usable by all agents in the org
- Each contact record includes: display name, channels (Telegram, GitHub, email), role, trust level
- Agent contacts include: capabilities, repo location, current status endpoint
- Contacts are version-controlled and human-editable

## Open Questions

- Where should the shared store live? (this repo, a dedicated contacts repo, or a service?)
- What format? (current per-file markdown, YAML, or structured JSON?)
- Access control: can any agent write, or is it append-only with handler approval?
- Needs handler input on ownership model before implementation begins.
