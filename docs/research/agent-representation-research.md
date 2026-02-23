> **Note (2026-02-23):** `delegate` permission mode was removed in Claude Code v2.1.50. The replacement is `bypassPermissions`. This document reflects findings at the time of writing.

# Agent Representation with Exclusive Plugins Research

**Status**: Complete Research Report
**Created**: 2026-02-17
**Researcher**: File Exploration Task
**Data Sources**: Agent definitions from `.claude/agents/`, plugin structures from `.claude-plugin/`, team structure docs

---

## 1. Existing Agent Definitions: Frontmatter Fields

Agent definition files are YAML-fronted Markdown files located in `.claude/agents/` directories. All agents examined follow a consistent schema with these fields:

### Required Fields

- **name** (string): Unique identifier, kebab-case (e.g., `software-eng`, `orchestrator`, `deep-researcher`)
- **description** (string, multi-line): User-facing description with examples of when to use

### Optional Fields (Common Across Agents)

- **model** (string): Model override (e.g., `sonnet`, `claude-opus-4-6`); defaults to Claude Opus 4.6 if not specified
- **color** (string): Hex or named color for UI display (e.g., `green`, `blue`, `cyan`, `yellow`, `magenta`)
- **prompt_mode** (string): `extend` or `replace` for system prompt behavior
- **base_prompt** (string): `_builtin` or custom prompt name
- **framework** (string): Always `claude-code` for Claude Code agents
- **permission_mode** (string): `delegate`, `standard`, or other permission models
- **dangerously_skip_permissions** (boolean): Legacy flag for permission override (rarely used; orchestrator sets `true`)
- **display_name** (string): Human-readable name with role in parentheses (e.g., "Bugs B (software-eng)")
- **role** (string): Special field for team leads; orchestrator sets `role: orchestrator`

### Tool Configuration

- **tools** (array): Explicit list of allowed tools (Read, Edit, Write, Bash, Grep, Glob, WebSearch, WebFetch, Task, SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet, TeamCreate, AskUserQuestion)
- **disallowed_tools** (array): Explicit list of forbidden tools (inverse of tools list)

### System Message (Content Block)

- **\<system-message\>** block: YAML-wrapped XML-style block containing identity, personality, and core behavioral traits (Name, character inspiration, personality quirks)

---

## 2. Agent Definitions Found

### Found in `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/agents/`

| Agent Name            | Display Name | Model           | Color       | Role                     | Key Traits                                                                       |
| --------------------- | ------------ | --------------- | ----------- | ------------------------ | -------------------------------------------------------------------------------- |
| **orchestrator**      | Orchestrator | claude-opus-4-6 | blue        | orchestrator (team-lead) | Calm, decisive; spawns teammates; does NOT write code                            |
| **software-eng**      | Bugs B       | claude-opus-4-6 | green       | Software Engineer        | Quiet, confident; reads code before writing; prefers consistency over cleverness |
| **deep-researcher**   | Road R       | claude-opus-4-6 | cyan        | Deep Researcher          | Patient, methodical, evidence-obsessed; complex multi-source synthesis only      |
| **quality-assurance** | Daffy D      | claude-opus-4-6 | yellow      | QA                       | Skeptical; thorough testing; sharp eye for edge cases                            |
| **project-manager**   | Elmer F      | claude-opus-4-6 | magenta     | Project Manager          | Methodical, organized; owns task list; coordinates handoffs                      |
| **docs-writer**       | Tweety B     | (inherited)     | (inherited) | Documentation Writer     | Maintains docs, audits specs, flags contradictions                               |
| **ops-eng**           | Foghorn L    | (inherited)     | (inherited) | Operations Engineer      | CI/CD, Homebrew, distribution, tooling                                           |
| **ai-agent-eng**      | Wile E       | (inherited)     | (inherited) | AI Agent Engineer        | Observes failures, records patterns, reviews specs                               |

### Found in `/Users/nathan.heaps/src/nsheaps/ai/.ai/agents/`

| Agent Name                      | Model       | Key Traits                                                                    |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| **research-subagent**           | sonnet      | OODA loop methodology; focused deep investigation; spawned by lead researcher |
| **internet-researcher**         | haiku       | Multi-source research; current information from web; API documentation lookup |
| **conversation-history-search** | (inherited) | Searches conversation history; context preservation                           |

### Found in `/Users/nathan.heaps/src/nsheaps/ai-old/.ai/agents/` (Legacy)

Multiple legacy agents existed: `ai-engineer`, `code-reviewer`, `debugger`, `dev-tools`, `docs-specialist`, `general-engineer`, `project-manager`, `refactor-engineer`, `researcher`, `system-architect`

---

## 3. Plugin Structure Patterns

Plugins use `.claude-plugin/plugin.json` manifest files with the following structure:

### Plugin.json Schema (Minimal)

```json
{
  "name": "string (kebab-case)",
  "version": "semver string (e.g., 0.2.24)",
  "description": "string",
  "author": {
    "name": "string",
    "email": "string (optional)",
    "url": "string (optional)"
  },
  "homepage": "string (URL)",
  "repository": "string (URL)",
  "keywords": ["array", "of", "tags"]
}
```

### Observed Plugin Components

Plugins found contain:

- **Skills** (referenced in SKILL.md or referenced in plugin docs)
- **Commands** (slash commands, typically defined elsewhere but registered in plugin)
- **Rules** (behavior instructions, stored in `.ai/rules/` or referenced)
- **Agents** (agent definitions in `.claude/agents/` with plugin-specific branding)
- **Hooks** (configuration for session/event hooks, stored in JSON or referenced)
- **Settings** (stored in `.claude/settings.json` when agent-team specific)

### Observed Plugins

| Plugin Name            | Author       | Purpose                      | Components                                     |
| ---------------------- | ------------ | ---------------------------- | ---------------------------------------------- |
| **commit-skill**       | Nathan Heaps | Git commit automation        | Skill for /commit command                      |
| **commit-command**     | Nathan Heaps | Git commit with AI messages  | Command wrapper for commit                     |
| **memory-manager**     | Nathan Heaps | CLAUDE.md management         | Auto-detect preferences                        |
| **correct-behavior**   | Nathan Heaps | Behavior correction          | Command for /correct-behavior                  |
| **data-serialization** | Nathan Heaps | YAML/JSON/TOON conversion    | Utilities for data formats                     |
| **github-auth-skill**  | Nathan Heaps | GitHub auth via device flow  | Skill for GitHub CLI                           |
| **command-help-skill** | Nathan Heaps | Help with slash commands     | Discovery and help                             |
| **sync-settings**      | Nathan Heaps | Settings file sync           | Config management                              |
| **skills-maintenance** | Nathan Heaps | Skill lifecycle management   | Skill updates/deprecation                      |
| **feature-dev**        | Anthropic    | Feature development workflow | Multi-agent orchestration (from marketplace)   |
| **pr-review-toolkit**  | Anthropic    | PR code review               | Multiple code-review agents (from marketplace) |

---

## 4. Team Structure: Looney Tunes Roster (Agent-Team Project)

From `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/docs/team-structure.md`:

### Team Hierarchy

```
Orchestrator (team-lead, no cartoon namesake)
  ├── Project Manager (Elmer Fudd) — owns task list, coordinates
  ├── AI Agent Eng (Wile E. Coyote) — observes failures, records patterns
  ├── Docs Writer (Tweety Bird) — maintains specs, audits, flags contradictions
  ├── Deep Researcher (Road Runner) — complex multi-source investigations
  ├── Ops Eng (Foghorn Leghorn) — CI/CD, Homebrew, distribution
  ├── Software Eng (Bugs Bunny) — implements features, writes code
  └── Quality Assurance (Daffy Duck) — tests, validates, catches regressions
```

### Agent vs Persona Separation

| Concept     | Location                     | Purpose                                                              |
| ----------- | ---------------------------- | -------------------------------------------------------------------- |
| **Agent**   | `.claude/agents/<name>.md`   | Role, responsibilities, behaviors, process, quality standards (WHAT) |
| **Persona** | `.claude/personas/<name>.md` | Identity, personality, communication style, public voice (WHO)       |

### Display Name Pattern

Format: **"FirstName L (role)"** where L = last initial (or middle for "Wile E.")

Examples:

- Bugs B (software-eng)
- Road R (researcher)
- Wile E (ai-agent-eng)
- Daffy D (qa)
- Elmer F (pm)
- Tweety B (docs-writer)
- Foghorn L (ops-eng)

---

## 5. Agent Tool Permissions by Role

### Orchestrator

- **Allowed**: Read, Grep, Glob, Task, SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet, TeamCreate, AskUserQuestion
- **Disallowed**: Edit, Write, Bash
- **Rationale**: Coordination only, no implementation or file modification

### Software Engineer (Bugs)

- **Allowed**: Read, Edit, Write, Bash, Grep, Glob, WebSearch, WebFetch
- **Disallowed**: None by default; Task tools implied available
- **Rationale**: Full implementation capability

### Quality Assurance (Daffy)

- **Allowed**: Read, Grep, Glob, Bash, WebFetch
- **Disallowed**: Edit, Write
- **Rationale**: Testing and review only, no code creation

### Deep Researcher (Road Runner)

- **Allowed**: Read, Grep, Glob, WebSearch, WebFetch, Bash
- **Disallowed**: Edit, Write
- **Rationale**: Investigation only, no file modification

### Project Manager (Elmer)

- **Allowed**: Read, Grep, Glob, Task, SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion
- **Disallowed**: Edit, Write, Bash
- **Rationale**: Task management and coordination, no implementation

---

## 6. Frontmatter Patterns Summary

### Minimal Agent Definition

```yaml
---
name: agent-name
description: "Clear description with examples of when to use"
---
```

### Full Agent Definition (Team Lead)

```yaml
---
name: orchestrator
description: "..."
color: blue
prompt_mode: extend
base_prompt: _builtin
framework: claude-code
model: claude-opus-4-6
role: orchestrator
permission_mode: delegate
dangerously_skip_permissions: true
display_name: "Orchestrator"
tools:
  - Read
  - Grep
  - Glob
  - Task
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
  - TeamCreate
  - AskUserQuestion
disallowed_tools:
  - Edit
  - Write
  - Bash
---

<system-message>
Your full name is Orchestrator.
[Identity, personality, key traits]
</system-message>

# [Agent Name]

[Rest of markdown documentation...]
```

---

## 7. Key Specifications Found

### Agent-Team Project Specs

Located in `/Users/nathan.heaps/src/nsheaps/claude-utils/docs/specs/draft/`:

1. **agent-orchestration.md** — Service that manages agent launch across patterns
2. **agent-team-project.md** — Provider-agnostic vision for agent-team extraction
3. **3-script-architecture-plan.md** — Separation: claude-team (infra), claude-team-orchestrator (config), run-claude (launch)

### Key Design Decisions

- **Agent-agent communication**: Via `SendMessage` tool with message/broadcast types
- **Task dependencies**: Set via `addBlocks` / `addBlockedBy` during TaskCreate
- **Teammate launch**: Orchestrator spawns via `Task` tool with `team_name` and `name` parameters
- **Session persistence**: `--continue` flag for session reuse
- **Permission model**: `--permission-mode delegate` for team sessions

---

## 8. Relevant Specs for "Agent Representation with Exclusive Plugins"

### What This Research Enables

The research shows:

1. **Agent definitions are YAML-fronted Markdown** with a consistent field schema (name, description, model, color, tools, display_name, etc.)

2. **Plugins use simple JSON manifests** that currently do NOT reference exclusive agents or permissions

3. **Team structure separates Agent (role) from Persona (identity)** — two files, one for job spec, one for public voice

4. **Tool permissions are hardcoded in agent frontmatter** — no plugin-based permission inheritance yet

5. **Display names follow a strict pattern** allowing agents to be referenced in messages and commits

### Gaps to Design For

- **No current mechanism for plugins to claim exclusive agents** — all agents are global
- **No plugin-based permission inheritance** — agents must explicitly list tools
- **No schema for agent-plugin associations** — agents aren't scoped to plugins
- **No mechanism for plugins to override agent behavior** — agent definitions stand alone
- **Team configuration is separate from plugin configuration** — no unified manifest

---

## 9. Data Points for Spec Design

### Agent Field Schema (To Reference)

```
- name (required, kebab-case)
- description (required, multi-line)
- model (optional, defaults to claude-opus-4-6)
- color (optional)
- prompt_mode (optional, extend/replace)
- base_prompt (optional, _builtin or name)
- framework (optional, claude-code)
- role (optional, used for team lead)
- permission_mode (optional, delegate/standard)
- display_name (optional, overrides pattern)
- tools (optional, explicit list)
- disallowed_tools (optional, explicit list)
- <system-message> (optional, XML block)
```

### Plugin.json Schema (To Extend)

```
- name (required, kebab-case)
- version (required, semver)
- description (required)
- author (required, object with name/email/url)
- homepage (optional)
- repository (optional)
- keywords (optional, array)
[NEW FIELDS NEEDED FOR EXCLUSIVE AGENTS]
```

### Team Role Examples

- orchestrator (team-lead)
- software-eng
- quality-assurance
- deep-researcher
- project-manager
- docs-writer
- ops-eng
- ai-agent-eng

---

## Files Read

1. `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/agents/software-eng.md`
2. `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/agents/orchestrator.md`
3. `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/agents/deep-researcher.md`
4. `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/agents/quality-assurance.md`
5. `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/agents/project-manager.md`
6. `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/docs/team-structure.md`
7. `/Users/nathan.heaps/src/nsheaps/ai/.ai/agents/research-subagent.md`
8. `/Users/nathan.heaps/src/nsheaps/ai/.ai/agents/internet-researcher.md`
9. `/Users/nathan.heaps/src/nsheaps/claude-utils/docs/specs/draft/agent-orchestration.md`
10. Multiple plugin.json files from ai.worktrees/claude-mention-agent/plugins/

---

## Recommendations for Spec Design

1. **Extend plugin.json** with an optional `agents` field (array) to list exclusive agents
2. **Create agent package format** that bundles agent.md + persona.md + references
3. **Define permission inheritance rules** — how agents gain permissions from plugins
4. **Establish naming conventions** for plugin-scoped agents (e.g., `plugin-name:agent-name`)
5. **Reference team structure schema** when designing multi-agent coordination within plugins
6. **Separate concerns** — keep Agent (role) and Persona (voice) definitions separate even in plugins

---

## Summary

**Agent definitions** are lightweight YAML-frontmatter Markdown files with fields for name, description, model, color, tools, and display_name. The system already has a mature 8-agent looney-tunes team with clear role separation. **Plugins use simple JSON manifests** but currently have no mechanism for claiming exclusive agents. **Team structure separates Agent from Persona**, enabling agents to act autonomously in public contexts. To design "agent representation with exclusive plugins," you'll need to extend both the agent definition schema and plugin.json to establish agent-plugin associations and permission inheritance rules.

**Report saved**: `/Users/nathan.heaps/src/nsheaps/claude-utils/.claude/tmp/agent-representation-research.md`
