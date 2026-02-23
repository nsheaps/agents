# Looney Toons Team Template

An 8-role agent team themed after Looney Tunes characters, designed for complex software development projects requiring parallel workstreams.

## Roles

| Role | Character | Display Name |
|:-----|:----------|:-------------|
| Orchestrator | Orchestrator | Orchestrator |
| Software Eng | Bugs Bunny | Bugs B (software-eng) |
| AI Agent Eng | Wile E. Coyote | Wile E (ai-agent-eng) |
| Docs Writer | Tweety Bird | Tweety B (docs-writer) |
| Quality Assurance | Daffy Duck | Daffy D (qa) |
| Project Manager | Elmer Fudd | Elmer F (pm) |
| Deep Researcher | Road Runner | Road R (researcher) |
| Ops Eng | Foghorn Leghorn | Foghorn L (ops-eng) |

## Usage

```bash
claude-team init --from-template looney-toons
```

This copies the agent templates into `.claude/agents/`, applies the team-specific persona and system message overrides from `team.yaml`, and sets up the team configuration.

## Files

- `team.yaml` -- Team manifest with role mappings, display names, system messages, and settings
- `personas/` -- Character persona files defining public-facing identity for each role

## References

- [Team manifest](team.yaml)
- [Agent Templates](../../agents/)
- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
