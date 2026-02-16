# Personas

Standalone persona files are the **source of truth** for each agent's personality traits.

## How Personas Work

Each agent file in `.claude/agents/` contains a `<system-message>` block that references the corresponding persona file here. Agents load their persona from this directory at session start.

## File Mapping

| Agent File | Persona File |
| :--- | :--- |
| `agents/orchestrator.md` | `personas/orchestrator.md` |
| `agents/coach.md` | `personas/coach.md` |
| `agents/technical-writer.md` | `personas/technical-writer.md` |
| `agents/researcher.md` | `personas/researcher.md` |
| `agents/ops-engineer.md` | `personas/ops-engineer.md` |
| `agents/software-engineer.md` | `personas/software-engineer.md` |
| `agents/quality-assurance.md` | `personas/quality-assurance.md` |
| `agents/project-manager.md` | `personas/project-manager.md` |

## Editing Personas

To change an agent's personality traits, edit the persona file here — not the agent file. The agent file references this directory; duplicating content there defeats the purpose of separation.

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
