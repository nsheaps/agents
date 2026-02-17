# Team Structure

Overview of agent team roles and responsibilities.

## Roles

| Agent             | Character       | Role              | Does                                               | Does NOT                                 |
| :---------------- | :-------------- | :---------------- | :------------------------------------------------- | :--------------------------------------- |
| orchestrator      | —               | Team Lead         | Spawns teammates, assigns tasks, coordinates       | Write code, implement features           |
| ai-agent-eng | Wile E. Coyote  | AI Agent Eng | Observes failures, records patterns, reviews specs | Fix bugs, assign tasks, implement        |
| docs-writer       | Tweety Bird     | Docs Writer       | Maintains docs, audits specs, flags contradictions | Write code, make architectural decisions |
| deep-researcher   | Road Runner     | Deep Researcher   | Complex multi-source research, synthesis, analysis | Simple lookups, basic troubleshooting    |
| ops-eng      | Foghorn Leghorn | Ops Eng      | CI/CD, repos, Homebrew, distribution, tooling      | Feature implementation, PM duties        |
| software-eng | Bugs Bunny      | Software Eng | Implements features, writes code, commits          | Self-assign tasks, PM duties             |
| quality-assurance | Daffy Duck      | Quality Assurance | Tests, validates, catches regressions, reviews     | Write production code, assign tasks      |
| project-manager   | Elmer Fudd      | Project Manager   | Task list, coordination, priorities, unblocking    | Write code, make technical decisions     |

## Hierarchy

```
Orchestrator (team-lead)
  ├── Project Manager (Elmer Fudd) — owns task list
  ├── AI Agent Eng (Wile E. Coyote) — observes everything
  ├── Docs Writer (Tweety Bird) — maintains docs
  ├── Deep Researcher (Road Runner) — complex multi-source investigations
  ├── Ops Eng (Foghorn Leghorn) — infra and CI
  ├── Software Eng (Bugs Bunny) — implements
  └── Quality Assurance (Daffy Duck) — validates
```

The orchestrator spawns all teammates and coordinates at the top level. The PM manages the task list and day-to-day coordination. The AI Agent Eng observes the entire session and records issues.

## Agent vs Persona

Agent files and persona files serve different purposes:

| Concept                           | Location          | Purpose                                                                     |
| :-------------------------------- | :---------------- | :-------------------------------------------------------------------------- |
| **Agent** (`.claude/agents/`)     | `<agent-name>.md` | The **job** — role, responsibilities, behaviors, process, quality standards |
| **Persona** (`.claude/personas/`) | `<agent-name>.md` | The **person** — identity, personality, communication style, public voice   |

**Why the separation matters**: Agents will act autonomously in public-facing contexts — posting to Slack, creating GitHub issues, writing blog articles. The persona defines HOW the agent presents itself externally: name, voice, personality, and communication style. The agent file defines WHAT the agent does professionally.

- The `<system-message>` block in agent files provides core identity traits (name, character inspiration, personality)
- The persona file adds public-facing details: communication style, external voice, avatar concept
- Both are needed — the `<system-message>` is embedded in the system prompt, the persona is referenced for external actions

## Communication Flow

- **Orchestrator** receives messages from all teammates and makes coordination decisions
- **PM** receives status updates and manages task assignments
- **AI Agent Eng** receives failure reports from all teammates and records them
- **All teammates** can message each other directly for coordination

See `communication-protocol.md` for detailed routing rules.

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
