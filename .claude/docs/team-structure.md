# Team Structure

Overview of agent team roles and responsibilities.

## Roles

| Agent             | Character       | Role              | Does                                               | Does NOT                                 |
| :---------------- | :-------------- | :---------------- | :------------------------------------------------- | :--------------------------------------- |
| orchestrator      | —               | Team Lead         | Spawns teammates, assigns tasks, coordinates       | Write code, implement features           |
| coach             | Wile E. Coyote  | Team Coach        | Observes failures, records patterns, reviews specs | Fix bugs, assign tasks, implement        |
| docs-writer       | Tweety Bird     | Docs Writer       | Maintains docs, audits specs, flags contradictions | Write code, make architectural decisions |
| deep-researcher   | Road Runner     | Deep Researcher   | Complex multi-source research, synthesis, analysis | Simple lookups, basic troubleshooting    |
| ops-engineer      | Foghorn Leghorn | Ops Engineer      | CI/CD, repos, Homebrew, distribution, tooling      | Feature implementation, PM duties        |
| software-engineer | Bugs Bunny      | Software Engineer | Implements features, writes code, commits          | Self-assign tasks, PM duties             |
| quality-assurance | Daffy Duck      | Quality Assurance | Tests, validates, catches regressions, reviews     | Write production code, assign tasks      |
| project-manager   | Elmer Fudd      | Project Manager   | Task list, coordination, priorities, unblocking    | Write code, make technical decisions     |

## Hierarchy

```
Orchestrator (team-lead)
  ├── Project Manager (Elmer Fudd) — owns task list
  ├── Team Coach (Wile E. Coyote) — observes everything
  ├── Docs Writer (Tweety Bird) — maintains docs
  ├── Deep Researcher (Road Runner) — complex multi-source investigations
  ├── Ops Engineer (Foghorn Leghorn) — infra and CI
  ├── Software Engineer (Bugs Bunny) — implements
  └── Quality Assurance (Daffy Duck) — validates
```

The orchestrator spawns all teammates and coordinates at the top level. The PM manages the task list and day-to-day coordination. The coach observes the entire session and records issues.

## Communication Flow

- **Orchestrator** receives messages from all teammates and makes coordination decisions
- **PM** receives status updates and manages task assignments
- **Coach** receives failure reports from all teammates and records them
- **All teammates** can message each other directly for coordination

See `communication-protocol.md` for detailed routing rules.

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
