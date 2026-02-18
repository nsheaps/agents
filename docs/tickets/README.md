# Tickets

File-based ticket system for tracking work across the agent-team project. Each ticket is a markdown file with YAML frontmatter for metadata.

## Ticket Format

```yaml
---
id: PHASE1-001
title: Short descriptive title
status: open | in-progress | blocked | done
assignee: Agent Name (Role)
priority: critical | high | medium | low
phase: 1 | 2 | 3 | ...
blocked_by: [PHASE1-000]  # ticket IDs this depends on
blocks: [PHASE1-002]       # ticket IDs waiting on this
created: 2026-02-17
updated: 2026-02-17
---

# PHASE1-001: Short descriptive title

Detailed description of the work to be done.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Notes

Any additional context, references, or discussion.
```

## Naming Convention

Files are named: `{PHASE}{NUMBER}-{SEQUENCE}-{short-slug}.md`

Examples:

- `PHASE1-001-system-prompt-research.md`
- `PHASE1-002-agent-launcher-spec.md`
- `PHASE2-001-agent-yaml-schema.md`

## Status Values

| Status        | Meaning                           |
| :------------ | :-------------------------------- |
| `open`        | Ready to be picked up             |
| `in-progress` | Someone is actively working on it |
| `blocked`     | Waiting on dependencies           |
| `done`        | Work complete, verified           |

## Workflow

1. PM creates tickets as markdown files
2. Assignee updates `status` to `in-progress` when starting
3. Assignee updates `status` to `done` when complete
4. Blocked tickets have `blocked_by` listing dependency ticket IDs
5. All changes committed to git for history
