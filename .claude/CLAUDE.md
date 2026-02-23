# agent-team

Provider-agnostic multi-agent orchestration framework. Currently uses Claude Code agent teams.

## Shared Team Documentation

@docs/team-structure.md
@docs/communication-protocol.md
@docs/team-rules.md

## Key Conventions

- Save reports and deliverables to files -- never return large outputs only in messages
- All teammates share a task list -- use `TaskCreate`, `TaskUpdate`, `TaskList` to coordinate
- Message the AI Agent Eng when something goes wrong
- Verify message recipients exist before sending (SendMessage silently succeeds for missing recipients)

## File Placement

Place files by permanence. Use `.claude/tmp/` only for truly disposable artifacts (NOT `/tmp/`).

| Content                        | Location           |
| :----------------------------- | :----------------- |
| Research findings              | `docs/research/`   |
| Specifications                 | `docs/specs/`      |
| Implementation plans           | `.claude/plans/`   |
| Working notes                  | `.claude/scratch/` |
| Intermediate/disposable output | `.claude/tmp/`     |

Completed work (research, specs, plans) always goes to a permanent location. See `.claude/rules/file-placement.md` for details.
