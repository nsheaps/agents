# CLI Commands

Command-line tools for managing agent teams.

## Tools

| Tool                                    | Status            | Description                                     |
| :-------------------------------------- | :---------------- | :---------------------------------------------- |
| [`claude-team`](./claude-team.md)       | Current           | Shell scripts for launching agent team sessions |
| [`agent-launcher`](./agent-launcher.md) | Planned (Phase 1) | Declarative agent lifecycle manager             |

## Relationship

`claude-team` is the current entry point for launching teams. It will be replaced by `agent-launcher` as the project matures:

```
claude-team (current)  →  agent-launcher (Phase 1)  →  agent CLI (Phase 2+)
```

See the [Multi-Repo Phase Plan](../specs/draft/multi-repo-phase-plan.md) for the full migration timeline.

## Orchestration Mechanisms

See [Orchestration](./orchestration.md) for mermaid diagrams showing how agents are spawned and managed across different backends (tmux, in-process, Docker, Kubernetes).
