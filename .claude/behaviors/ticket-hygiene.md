---
name: ticket-hygiene
description: Procedure for maintaining ticket state as you work. Every agent owns their ticket updates — don't wait for the PM. Use whenever you start, progress, or finish work on a ticketed task.
---

# Ticket Hygiene

Every agent is responsible for keeping their own tickets current. The PM creates and prioritizes tickets; you maintain their state as you work.

## Purpose

Tickets in `docs/tickets/` are the source of truth for project status. When agents don't update their tickets, the PM must chase status — wasting everyone's time. Self-service ticket updates keep the team informed without overhead.

## When to Use

- When you start working on a ticket
- When you make meaningful progress or hit a blocker
- When you finish the work
- When you discover the ticket needs scope changes

## Steps

1. **Starting work** — Update the ticket frontmatter:
   - Set `status: in-progress`
   - Set `updated:` to today's date
   - Also update the corresponding TaskUpdate (set `in_progress`)

2. **During work** — Add notes directly to the ticket file:
   - Append findings, decisions, or progress under a `## Progress` section
   - Flag blockers: add a `## Blockers` section with what's blocking and who can help
   - If scope changes are needed, note them and discuss with the PM

3. **Finishing work** — Update the ticket:
   - Set `status: done`
   - Set `updated:` to today's date
   - Ensure all acceptance criteria checkboxes are checked
   - Also update TaskUpdate (set `completed`)
   - Commit the ticket update alongside the work

4. **Blocked** — Don't just stop working:
   - Add the blocker to the ticket file
   - Message the blocking agent or PM
   - Move to another available task

## Ticket Frontmatter Fields

```yaml
---
id: PHASE1-003
title: "Implement: agent file discovery"
status: open          # open → in-progress → done
assignee: Bugs Bunny (Software Eng)
priority: high
phase: 1
blocked_by: [PHASE1-002]
blocks: [PHASE1-004]
created: 2026-02-17
updated: 2026-02-17   # Update this whenever you touch the ticket
task_id: "105"        # Links to TaskList task
---
```

## Anti-Patterns

- Leaving tickets in `open` status while actively working on them
- Finishing work without updating the ticket to `done`
- Waiting for the PM to update your ticket status
- Not noting blockers — just silently stopping work
- Updating TaskList but not the ticket file (or vice versa) — keep both in sync
