# agent-team

Provider-agnostic multi-agent orchestration framework. Currently uses Claude Code agent teams.

## Shared Team Documentation

@docs/team-structure.md
@docs/communication-protocol.md
@docs/team-rules.md

## Key Conventions

- Use `.claude/tmp/` for working files shared between teammates (NOT `/tmp/`)
- Save reports and deliverables to files — never return large outputs only in messages
- All teammates share a task list — use `TaskCreate`, `TaskUpdate`, `TaskList` to coordinate
- Message the AI Agent Engineer when something goes wrong
- Verify message recipients exist before sending (SendMessage silently succeeds for missing recipients)
