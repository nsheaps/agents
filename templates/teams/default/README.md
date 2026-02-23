# Default Team Template

An 8-role agent team with professional, non-themed identities. Designed for complex software development projects requiring parallel workstreams.

## Roles

| Role              | Display Name       |
| :---------------- | :----------------- |
| Orchestrator      | Team Lead          |
| Software Eng      | Software Engineer  |
| AI Agent Eng      | AI Agent Engineer  |
| Docs Writer       | Docs Writer        |
| Quality Assurance | QA Engineer        |
| Project Manager   | Project Manager    |
| Deep Researcher   | Researcher         |
| Ops Eng           | Ops Engineer       |

## Usage

```bash
claude-team init --from-template default
```

This copies the agent templates into `.claude/agents/`, applies the team-specific persona and system message overrides from `team.yaml`, and sets up the team configuration.

## Files

- `team.yaml` -- Team manifest with role mappings, display names, system messages, and settings
- `personas/` -- Persona files defining public-facing identity for each role

## References

- [Team manifest](team.yaml)
- [Agent Templates](../../agents/)
- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
