# Agent-Team as Plugin Marketplace: Scoping Analysis

Analysis of how to turn agent-team's `.claude/` content into installable plugin(s), making the repo a "Claude marketplace" similar to nsheaps/.ai.

## Current Content Inventory

### Agents (`.claude/agents/`) — 8 files

| Agent                  | Purpose                             | Project-specific?                                                |
| :--------------------- | :---------------------------------- | :--------------------------------------------------------------- |
| `orchestrator.md`      | Team lead, spawns and coordinates   | **Reusable** with minor edits (remove looney-tunes persona refs) |
| `software-eng.md`      | Primary implementation agent        | **Reusable** — generic SWE role                                  |
| `quality-assurance.md` | Testing and validation              | **Reusable** — generic QA role                                   |
| `docs-writer.md`       | Documentation maintenance           | **Reusable** — generic docs role                                 |
| `project-manager.md`   | Task list and coordination          | **Reusable** — generic PM role                                   |
| `deep-researcher.md`   | Complex multi-source research       | **Reusable** — generic research role                             |
| `ops-eng.md`           | CI/CD, repos, tooling               | **Reusable** — generic ops role                                  |
| `ai-agent-eng.md`      | Observes failures, records patterns | **Reusable** — novel "coach" role                                |

**Assessment**: All 8 agents are reusable team roles. The looney-tunes naming/personas are project-specific flavor but the roles themselves are generic.

### Personas (`.claude/personas/`) — 8 files

Each persona adds a character identity (name, personality, communication style, public voice, avatar concept).

**Assessment**: Personas are opinionated flavor. They demonstrate the pattern but users would want their own. These are **example content**, not reusable utilities.

### Behaviors (`.claude/behaviors/`) — 16 files

| Behavior                        | Purpose                                 | Reusable?               |
| :------------------------------ | :-------------------------------------- | :---------------------- |
| `pre-task-checklist.md`         | Mandatory step-0 before any task        | **Highly reusable**     |
| `failure-reporting.md`          | Report failures to AI Agent Eng         | **Highly reusable**     |
| `research.md`                   | Deep investigation procedure            | **Highly reusable**     |
| `self-correction.md`            | Detect and fix own mistakes             | **Highly reusable**     |
| `verification.md`               | Verify work before declaring done       | **Highly reusable**     |
| `lifecycle-management.md`       | Agent spawn/shutdown/cleanup            | **Highly reusable**     |
| `team-member-cleanup.md`        | Detect/remove stale team members        | **Highly reusable**     |
| `communication-verification.md` | Verify message recipients exist         | **Highly reusable**     |
| `code-review.md`                | Code review procedure                   | **Highly reusable**     |
| `commit-hygiene.md`             | Commit message standards                | **Highly reusable**     |
| `documentation.md`              | Documentation standards                 | **Highly reusable**     |
| `ticket-hygiene.md`             | Task naming and formatting              | **Highly reusable**     |
| `task-subject-formatting.md`    | Task subject conventions                | **Highly reusable**     |
| `incremental-design.md`         | Incremental development approach        | **Highly reusable**     |
| `conversation-search.md`        | Search past conversations               | **Highly reusable**     |
| `verify-before-blaming.md`      | Verify state before blaming tools       | **Highly reusable**     |
| `requirements-verification.md`  | Verify requirements before implementing | **Highly reusable**     |
| `README.md`                     | Explains behavior vs agent vs skill     | **Reusable** (meta-doc) |

**Assessment**: ALL behaviors are reusable. They're role-agnostic procedures any team can use.

### Team Docs (`.claude/docs/`) — 3 files

| Doc                         | Purpose                              | Reusable?                                                         |
| :-------------------------- | :----------------------------------- | :---------------------------------------------------------------- |
| `team-structure.md`         | Role table, hierarchy, display names | **Template** — structure is reusable, content is project-specific |
| `team-rules.md`             | Standing orders for all teammates    | **Highly reusable** — generic team governance                     |
| `communication-protocol.md` | Message routing, escalation          | **Reusable** — generic team comms protocol                        |

### Existing Plugin (`plugins/agent-team-skills/`) — 2 skills

| Skill                                | Purpose                    | Reusable?                                       |
| :----------------------------------- | :------------------------- | :---------------------------------------------- |
| `writing-agent-team-agents/SKILL.md` | How to create agent files  | **Reusable** — meta-skill for agent development |
| `tmux-usage/SKILL.md`                | tmux usage for agent teams | **Reusable** — reference material               |

### Settings (`.claude/settings.json`)

Project-specific — not suitable for a plugin.

### CLAUDE.md

Project-specific entrypoint — not suitable for a plugin directly, but the pattern of `@docs/` imports is reusable.

---

## Plugin Architecture Options

### Option A: One Big Plugin — `agent-team-framework`

Everything in one installable unit.

```
agent-team-framework/
├── .claude-plugin/
│   └── plugin.json
├── agents/           # All 8 agent definitions
├── behaviors/        # All 16 behaviors + README
├── docs/             # team-structure, team-rules, communication-protocol
├── personas/         # All 8 personas (as examples)
└── skills/
    ├── writing-agent-team-agents/
    └── tmux-usage/
```

**Pros**: Single install gets everything. Simple.
**Cons**: Users get ALL content whether they want it or not. Opinionated personas forced on everyone.

### Option B: Three Focused Plugins (Recommended)

Split by concern and reusability level.

#### Plugin 1: `agent-team-behaviors` — The core value

Behaviors are the most universally reusable content. Every team benefits from these regardless of roles, personas, or project type.

```
agent-team-behaviors/
├── .claude-plugin/
│   └── plugin.json
└── behaviors/           # All 16 behaviors + README
```

**Install**: Any project using agent teams.
**Value**: Consistent team procedures across all projects.

#### Plugin 2: `agent-team-roles` — Starter team composition

Agent definitions (roles) and example personas. The team-docs that define structure and rules.

```
agent-team-roles/
├── .claude-plugin/
│   └── plugin.json
├── agents/              # All 8 agent definitions (genericized)
├── personas/            # All 8 personas (as examples/templates)
└── docs/                # team-structure, team-rules, communication-protocol
```

**Install**: Projects that want a ready-made team composition.
**Value**: Pre-built team with tested role definitions.
**Note**: Users can fork/customize — these are starting points.

#### Plugin 3: `agent-teams-skills` — Already exists in nsheaps/.ai

The skill we just migrated. Covers enabling, configuration, hooks, tmux integration.

```
agent-teams-skills/              # Already at nsheaps/.ai
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── agent-teams/
        ├── SKILL.md
        └── references/hooks-and-config.md
```

**Already done.** The existing plugin's scope is correct — it's the "how to use agent teams" reference.

### Option C: Four Plugins (Maximum Separation)

Same as Option B but split roles from docs:

- `agent-team-behaviors` — procedures
- `agent-team-agents` — role definitions only
- `agent-team-docs` — team structure, rules, comms protocol
- `agent-teams-skills` — already exists

**Assessment**: Over-split. Docs and agents are tightly coupled — team-structure.md directly references agent files.

---

## Recommendation: Option B (Three Plugins)

| Plugin                 | Location             | Content                                   | Install When                       |
| :--------------------- | :------------------- | :---------------------------------------- | :--------------------------------- |
| `agent-teams-skills`   | `nsheaps/.ai` (done) | Skills: enabling, config, hooks reference | Any project using agent teams      |
| `agent-team-behaviors` | `agent-team` repo    | 16 behaviors + README                     | Any project using agent teams      |
| `agent-team-roles`     | `agent-team` repo    | 8 agents, 8 personas, 3 team docs         | Want a ready-made team composition |

### Why This Split

1. **Behaviors are universally useful** — even solo Claude Code users benefit from pre-task-checklist and failure-reporting. They shouldn't require importing 8 role definitions.
2. **Roles are opinionated** — the looney-tunes naming, specific role splits (ai-agent-eng is unusual), and persona concept are choices. Separate plugin lets users opt in.
3. **Skills are already separated** — the agent-teams-skills plugin in nsheaps/.ai handles the "how to" reference.

### Relationship Between the Three

```
agent-teams-skills (nsheaps/.ai)     — "How do I use agent teams?"
         ↓ references
agent-team-behaviors (agent-team)    — "How should teammates behave?"
         ↓ referenced by
agent-team-roles (agent-team)        — "What roles make up a team?"
```

- `agent-teams-skills` is independent — pure reference material
- `agent-team-behaviors` is independent — procedures that any team member follows
- `agent-team-roles` benefits from both but doesn't require them

---

## Existing Plugin Consolidation

The existing `plugins/agent-team-skills/` in agent-team contains `writing-agent-team-agents` and `tmux-usage` skills. These should be:

- `writing-agent-team-agents` → moves into `agent-team-roles` plugin (it's about creating agents, closely tied to the role definitions)
- `tmux-usage` → moves into `agent-teams-skills` plugin in nsheaps/.ai (it's a reference skill about using tmux with agent teams)
- The existing `plugins/agent-team-skills/` plugin structure is then retired

---

## Content That Needs Genericization

Before packaging as plugins, some content references project-specific details:

1. **Agent files**: Reference "looney-tunes" naming, specific `.claude/personas/` paths, project-specific code standards (`claude.lib.sh`)
2. **Team docs**: `team-structure.md` lists the specific looney-tunes roster — needs to become a template
3. **Personas**: These are inherently project-specific but serve as examples of the pattern

### Approach

- **Behaviors**: No changes needed — already generic
- **Agents**: Create "clean" versions that strip project-specific references but keep the role structure. Original looney-tunes versions stay as examples.
- **Team docs**: Keep as templates with [CUSTOMIZE] markers where project-specific content goes
- **Personas**: Include as examples with clear "this is a template" documentation

---

## Open Questions for Team Lead

1. **Where do behaviors plugins live?** In the agent-team repo (alongside the POC code), or in nsheaps/.ai (alongside agent-teams-skills)?
2. **Genericize now or later?** The content works as-is for nsheaps projects. Should we clean it up for general consumption now, or just package the current content?
3. **Plugin discovery**: How will users find these plugins? A registry, a README, or just `.claude.json` paths?
4. **Behaviors as rules?** nsheaps/.ai CLAUDE.md notes "rules cannot be included as part of plugins." Some behaviors overlap with rules semantically. Are behaviors (loaded as agent files via `.claude/behaviors/`) affected by this limitation, or is it only `.claude/rules/` that can't be in plugins?
5. **`writing-agent-team-agents` skill**: Move to `agent-team-roles` plugin, or keep in existing `agent-teams-skills` in nsheaps/.ai?

---

## Estimated Scope

| Work                                                     | Effort                                   |
| :------------------------------------------------------- | :--------------------------------------- |
| Create `agent-team-behaviors` plugin structure           | Small — mkdir + plugin.json + move files |
| Create `agent-team-roles` plugin structure               | Small — mkdir + plugin.json + move files |
| Move `tmux-usage` to `agent-teams-skills` in nsheaps/.ai | Small — file move + commit               |
| Retire old `plugins/agent-team-skills/`                  | Small — git rm                           |
| Genericize agent files (strip project-specific refs)     | Medium — 8 files to review and edit      |
| Template-ize team docs                                   | Small — 3 files to add markers           |
| Update `.claude.json` in consuming repos                 | Small — add new plugin paths             |
| **Total**                                                | **~1-2 hours of work**                   |

---

## References

- [Claude Code Plugins](https://code.claude.com/docs/en/plugins) — official plugin docs
- [Agent Skills Standard](https://agentskills.io) — skill format reference
- `agent-teams-skills` plugin: `/Users/nathan.heaps/src/nsheaps/ai/.ai/plugins/agent-teams-skills/`
- Existing POC plugin: `/Users/nathan.heaps/src/nsheaps/agent-team/plugins/agent-team-skills/`
