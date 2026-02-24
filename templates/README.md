# Agent Team Templates

Blueprints for creating new agent teams. Templates separate the **role** (what an agent does) from the **persona** (who the agent is), making it easy to create themed teams with different characters while reusing the same role definitions.

## Structure

```
templates/
├── agents/              # Role-only agent templates (no persona/character theming)
├── system-prompts/      # Composable prompt fragments per role
│   ├── _shared/         # Shared building blocks (@references)
│   └── <role>/          # Role-specific prompt content
└── teams/               # Team manifests (YAML + personas)
    └── <team-name>/
        ├── team.yaml    # Role mappings, display names, system messages, settings
        ├── personas/    # Character persona files
        └── README.md    # Team description
```

## How Templates Work

1. **Agent templates** (`agents/<role>.md`) define the role: responsibilities, process, quality standards, edge cases. They contain `{{display_name}}` and `{{system_message}}` placeholders where team-specific values get injected.

2. **System prompts** (`system-prompts/<role>/PROMPT.md`) provide composable prompt fragments using `@_shared/` references for common sections (session start, communication protocol, quality standards) plus role-specific instructions.

3. **Team manifests** (`teams/<name>/team.yaml`) map roles to personas, define display names, and provide the `system_message` content that gives each agent its character identity.

## Creating a New Team Template

1. Create a directory under `teams/` with your team name
2. Create a `team.yaml` manifest mapping each role to a display name, persona file, and system message
3. Create persona files in `teams/<name>/personas/` for each role's public-facing identity
4. Add a `README.md` describing the team

You do not need to create new agent templates unless you are adding a new role. Existing roles in `agents/` are reusable across teams.

## Using a Template

```bash
# Aspirational -- not yet implemented
claude-team init --from-template <team-name>
```

This would read the team manifest, copy agent templates into `.claude/agents/`, apply persona and system message overrides, and configure the team.

## Available Templates

| Template                            | Description                              | Roles                                                                                        |
| :---------------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------- |
| [default](teams/default/)           | Professional, non-themed team identities | 8 roles (orchestrator, software-eng, ai-agent-eng, docs-writer, qa, pm, researcher, ops-eng) |
| [looney-toons](teams/looney-toons/) | Looney Tunes character theming           | 8 roles (orchestrator, software-eng, ai-agent-eng, docs-writer, qa, pm, researcher, ops-eng) |

## References

- [Agent Launcher Spec](../docs/specs/draft/agent-launcher.md)
- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
