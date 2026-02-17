# SystemPrompt.io Playbooks: Research Report

**Source**: [SystemPrompt.io Playbooks](https://systemprompt.io/playbooks?category=guide)
**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #41

---

## 1. What is SystemPrompt.io? What Are Playbooks?

### The Platform

SystemPrompt.io is a **production-ready Rust framework** for deploying AI agents. It is NOT a SaaS platform or prompt library — it's a self-hosted library that compiles to a single ~50MB binary.

> "Claude and ChatGPT are AI models. systemprompt.io is a Rust framework for deploying AI to production."

**Creator**: Ed J Burton (solo, unfunded project)
**License**: BSL-1.1 (converts to Apache 2.0 after 4 years)
**Repository**: [github.com/systempromptio](https://github.com/systempromptio)

Core infrastructure in one binary:

- **Authentication**: OAuth2/OIDC, WebAuthn
- **Agent orchestration**: A2A (Agent-to-Agent) protocol
- **MCP hosting**: Works with Claude Code, Claude Desktop, ChatGPT
- **Memory systems**: Long-term, short-term, working memory
- **Observability**: Logging, audit trails, cost tracking
- **Playbooks**: Deterministic execution guides

Multi-model support: Anthropic Claude, OpenAI, Google Gemini with fallback routing.

### What Are Playbooks?

Playbooks are **deterministic, self-repairing, machine-executable instruction guides**. They are the central operational concept of the platform.

> "Users should NOT guess how to interact with agents. Instead: Find the agent's playbook, read the playbook, use the CLI following the playbook."

Core characteristics:

1. **Deterministic**: Exact commands in JSON format, not suggestions
2. **Self-repairing**: When commands fail, agents fix the playbook directly, then resume
3. **Machine-executable**: Structured JSON command blocks, not prose
4. **Bounded**: Each playbook covers a single domain
5. **Bloat-free**: No inline comments or unnecessary documentation

Three-layer workflow:

1. Users **read playbooks** to learn interaction patterns
2. Users **send tasks via CLI** following playbook syntax exactly
3. **Agents execute** using skills, MCP servers, and tools per playbook guidelines

Mandatory rules: "DO NOT skip steps. DO NOT guess commands. ALWAYS use playbooks."

## 2. What Guide Playbooks Are Available?

### Guide Category (9 playbooks)

| Playbook                                                      | Description                                                                                                          |
| :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------- |
| **START HERE** (`guide-start`)                                | Required foundational reading. Master index mapping tasks to playbook IDs. Establishes mandatory rules.              |
| **Playbook Authoring Guide** (`guide-playbook`)               | How to write machine-executable playbooks. Five rules: deterministic, testable, bounded, self-repairing, bloat-free. |
| **Multi-Agent Mesh Architecture** (`guide-mesh-architecture`) | Hub-and-spoke coordination. A2A protocol. Port allocation strategy. The most relevant guide for our work.            |
| **Workflow Recipes** (`guide-recipes`)                        | Complete examples: blog publishing, CSS/JS integration, homepage config, content refresh.                            |
| **AI Provider Configuration** (`guide-ai-provider`)           | Setup for Anthropic, OpenAI, Gemini. Provider capabilities matrix.                                                   |
| **Coding Standards** (`guide-coding-standards`)               | Master index linking to language-specific standards.                                                                 |
| **Documentation Authoring** (`guide-documentation`)           | Standards for creating and editing documentation.                                                                    |
| **Discord Integration** (`guide-discord`)                     | Discord messaging and gateway integration for notifications.                                                         |
| **Migrate from OpenClaw** (`guide-migrate-openclaw`)          | Migration path preserving operational context.                                                                       |

### Other Categories

| Category    | Count | Focus                                                                                     |
| :---------- | :---- | :---------------------------------------------------------------------------------------- |
| **CLI**     | 23    | Command operations: agents, sessions, mesh, skills, MCP, cloud, analytics                 |
| **Build**   | 37    | Extensions, MCP servers, web infrastructure, Rust standards, checklists                   |
| **Domain**  | 12    | Operations and troubleshooting: agents, AI, MCP, skills, content, scheduling              |
| **Content** | 10    | Platform-specific creation: blog, Medium, LinkedIn, HackerNoon, Twitter, Reddit, Substack |

**Total**: ~91 playbooks across 5 categories.

## 3. Playbooks Relevant to Agent Orchestration

### Tier 1 — Directly Relevant

**Multi-Agent Mesh Architecture Guide** is the most important. It defines:

- **Hub-and-spoke pattern**: SystemPrompt Hub (Port 9020) as coordination center
- **Port allocation**:
  - 9000-9019: Core agents
  - 9020-9029: Hub functions
  - 9030-9039: Orchestrators
  - 9040-9099: Specialized workers
- **A2A protocol**: Agent-to-agent communication with blocking mode, timeouts, and shared context IDs

```
Hub (Port 9020) — coordination center
  ├── Blog Orchestrator (Port 9030) — routes requests
  │     ├── Blog Technical (Port 9040) — specialized agent
  │     └── Blog Narrative (Port 9050) — specialized agent
  └── Discord notifications, memory management
```

> "Hub memory is the brain — use it for important decisions and workflow tracking."

Operational best practices:

- Notify hub at workflow start and completion
- Use longer timeouts for extended processes
- Create named contexts to track workflow state
- Implement proper error logging in hub memory

**Agents Management CLI Playbook**: Create, configure, communicate with agents via A2A protocol.

**Agent Mesh Management CLI Playbook**: Start, stop, monitor, troubleshoot mesh deployments.

### Tier 2 — Supporting Patterns

**Playbook Authoring Guide**: Structural patterns for instruction sets — YAML frontmatter, JSON command blocks, self-repair protocol.

**Skills Development (Domain)**: Create and manage reusable agent capabilities — parallels our behaviors/skills distinction.

**MCP Server Configuration (Domain)**: Agent capability layer setup — relevant to our MCP-as-abstraction-layer vision.

## 4. Patterns for Structuring Agent Prompts/Behavior

SystemPrompt uses several patterns we don't currently employ:

### Deterministic Command Documentation

Every operation documented as an exact JSON command block:

```json
{ "command": "admin agents list --enabled" }
```

No ambiguity, no suggestions. Placeholders use angle brackets: `<name>`, `<id>`.

### Self-Repair Protocol

When playbook commands fail, agents must:

1. Stop execution (don't cascade errors)
2. Find correct syntax via help command
3. Edit the playbook file directly
4. Sync changes to the system
5. Verify the fix works
6. Resume tasks

This prevents playbook staleness — agents maintain their own documentation.

### Master Index Navigation

The START HERE guide provides a task-to-playbook mapping. Users find the right playbook by looking up their task, not by guessing which playbook to read.

### Platform-Specific Voice Operationalization

Content creation playbooks standardize agent personality per platform:

- Target audience (CTOs, senior developers, etc.)
- Tone (contrarian, data-backed, narrative-driven, satirical)
- Structure ratios (60% story / 40% technical)
- Word counts (3500-5000 words)

Each platform gets custom guidance tailored to its audience — showing how SystemPrompt operationalizes "agent personality."

### Hub as Stateful Memory

> "Hub memory is the brain — use it for important decisions and workflow tracking."

The hub maintains:

- Workflow state (named contexts)
- Decision history
- Notification routing
- Error logs for analysis

## 5. Comparison to Our Agent Files, Behaviors, and Skills

### Structural Comparison

| Dimension       | SystemPrompt Playbooks                    | Our Agent Files                      | Our Behaviors            | Our Skills                 |
| :-------------- | :---------------------------------------- | :----------------------------------- | :----------------------- | :------------------------- |
| **Format**      | YAML frontmatter + JSON command blocks    | YAML frontmatter + Markdown body     | Markdown                 | Markdown with `!`command`` |
| **Purpose**     | Deterministic machine execution           | System prompt for LLM                | Role-agnostic procedures | Task-specific knowledge    |
| **Audience**    | Both machines and humans                  | LLMs (via system prompt)             | LLMs (via conversation)  | LLMs (via conversation)    |
| **Execution**   | Agents execute exact commands             | Agent follows behavioral guidance    | Agent follows procedure  | Agent follows instructions |
| **Self-repair** | Built-in (agents fix playbooks)           | None                                 | None                     | None                       |
| **Validation**  | CLI help verification, URL checks         | Manual review                        | Manual review            | Manual review              |
| **Persona**     | Implicit (content playbooks define voice) | Explicit (`<system-message>` block)  | None                     | None                       |
| **Scope**       | Single domain per playbook                | One agent per file                   | One procedure per file   | One topic per file         |
| **Persistence** | Versioned files synced to DB              | System prompt (persistent)           | Conversation context     | Conversation context       |
| **Categories**  | 5 (Guide, CLI, Build, Content, Domain)    | By role (engineer, researcher, etc.) | By procedure type        | By topic                   |

### Key Differences

**Determinism vs Guidance**: SystemPrompt playbooks are deterministic — exact commands agents execute verbatim. Our agent files are guidance — behavioral instructions the LLM interprets. This reflects fundamentally different execution models.

**Machine-first vs LLM-first**: Playbooks are written for reliable machine parsing (JSON commands). Our files are written for LLM comprehension (Markdown prose). Playbooks prevent hallucination by eliminating interpretation; our files rely on LLM understanding.

**Self-repair vs Manual**: Playbooks self-repair when broken. Our agent files, behaviors, and skills require human/manual updates. The self-repair pattern is worth adopting.

**Hub-centric vs Leader-centric**: SystemPrompt uses a stateful hub for coordination. Our current Claude Code teams use a leader-centric model. The hub pattern adds persistent state — relevant to our provider-agnostic vision.

### What's Similar

- Both use YAML frontmatter for metadata
- Both organize by domain/role
- Both emphasize following instructions over guessing
- Both have a concept of skills/capabilities as modular units
- Both support multi-model/multi-provider (SystemPrompt natively, us via PRD vision)

## 6. Reusable Patterns to Adopt

### Pattern 1: Self-Repairing Instructions

**What**: When instructions fail, agents fix them before continuing.
**Why**: Prevents stale documentation. Playbooks/behaviors improve over time instead of degrading.
**How for us**: Add a self-repair protocol to behaviors — when a behavior's steps produce errors, the agent should update the behavior file and notify the team.

### Pattern 2: Master Index / Task-to-Playbook Mapping

**What**: A single START HERE document maps tasks to their exact playbook.
**Why**: Eliminates guessing about which document to read.
**How for us**: Our CLAUDE.md serves a similar role but could benefit from a more explicit task-to-behavior/skill mapping table.

### Pattern 3: Hub Memory for Workflow State

**What**: Central hub maintains named contexts for workflow state, decisions, and error logs.
**Why**: Enables workflow tracking across multi-step, multi-agent operations.
**How for us**: Our team config + task list serves a similar purpose. Could formalize "named contexts" for workflow state that persists beyond individual task completion.

### Pattern 4: Deterministic Command Documentation

**What**: Every CLI operation documented as an exact JSON command.
**Why**: Eliminates agent hallucination of CLI syntax.
**How for us**: For our shell scripts and CLI operations, we could document exact command patterns in skills/behaviors. Not as JSON blocks (different execution model), but as copy-pasteable command templates.

### Pattern 5: Platform-Specific Voice Templates

**What**: Content playbooks define exact voice/tone per platform.
**Why**: Consistency across agents and platforms.
**How for us**: Our persona `<system-message>` blocks serve a similar purpose for individual agents. Could formalize team-wide voice consistency guidelines.

### Pattern 6: Validation Protocol

**What**: Playbooks validate themselves via CLI help verification and URL checking.
**Why**: Catches staleness before it causes errors.
**How for us**: Could add validation checks to our behavior files — verify referenced tools exist, paths are correct, commands work.

### Patterns to NOT Adopt

| Pattern                                | Why Not                                                                                                      |
| :------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **JSON command blocks**                | Our agents interpret Markdown, not execute JSON. Different execution model.                                  |
| **Hub-and-spoke with port allocation** | Relevant for process-based agents, not Claude Code's in-process/tmux model. Consider for agent-team project. |
| **Database-backed playbook sync**      | Over-engineered for our file-based approach. Git versioning is sufficient.                                   |
| **BSL licensing**                      | Our project is MIT/open.                                                                                     |

## 7. Agent/Behavior/Skill Distinction Comparison

### SystemPrompt's Model

SystemPrompt has three related concepts:

| Concept      | SystemPrompt                 | Description                                                                |
| :----------- | :--------------------------- | :------------------------------------------------------------------------- |
| **Agent**    | Agent (A2A participant)      | Autonomous process with skills, MCP access, and communication capabilities |
| **Skill**    | Skill (loaded at startup)    | Reusable capability an agent can perform                                   |
| **Playbook** | Playbook (operational guide) | Deterministic instruction set for a domain                                 |

Agents load skills at startup, then follow playbooks to execute tasks. The A2A protocol enables inter-agent communication.

### Our Model

| Concept      | Our System                  | Description                                                 |
| :----------- | :-------------------------- | :---------------------------------------------------------- |
| **Agent**    | `.claude/agents/*.md`       | Autonomous role with persona, own session, responsibilities |
| **Behavior** | `.claude/behaviors/*.md`    | Role-agnostic procedure any agent can execute               |
| **Skill**    | `.claude/skills/*/SKILL.md` | Task-specific knowledge recalled on demand                  |

### Key Distinctions

**Playbooks ≠ Behaviors**: SystemPrompt playbooks are deterministic machine instructions. Our behaviors are interpretive guidance for LLMs. Closest parallel: playbooks combine aspects of both our behaviors (procedures) and skills (task knowledge).

**Skills overlap**: Both systems have "skills" as modular capabilities. SystemPrompt skills are loaded at agent startup (persistent); our skills are recalled on demand (conversation context, compactable).

**Persona separation**: We explicitly separate persona (`<system-message>`) from role (body). SystemPrompt implicitly defines voice in content playbooks but doesn't have a dedicated persona mechanism.

**Agent autonomy**: Both systems define agents as autonomous participants. SystemPrompt agents communicate via A2A protocol; ours via SendMessage. Both support fire-and-forget spawning and peer-to-peer communication.

### Mapping

```
SystemPrompt          →  Our System
─────────────────────────────────────────
Agent (A2A)           →  Agent (.claude/agents/*.md)
Skill (startup)       →  Skill (.claude/skills/) + Behavior (.claude/behaviors/)
Playbook (guide)      →  Behavior (procedure) + Skill (knowledge)
Hub (coordinator)     →  Orchestrator agent (team-lead)
A2A protocol          →  SendMessage tool
Shared contexts       →  Task list + team config
Self-repair protocol  →  (not implemented — should adopt)
Master index          →  CLAUDE.md with @references
```

## Conclusions

### Most Valuable Insights

1. **Self-repairing instructions** is the standout pattern. We should adopt it for our behaviors and skills.
2. **Hub memory / named contexts** for workflow state — more structured than our current task list approach.
3. **Deterministic command documentation** — reduce agent hallucination of CLI syntax in our shell script skills.
4. **Validation protocols** — automated staleness detection for our documentation.

### What SystemPrompt Does That We Don't (Yet)

- Self-repairing documentation
- Machine-parseable command format
- Database-backed state with named contexts
- Automated validation of instruction accuracy
- Port-based agent isolation (process-level separation)

### What We Do That SystemPrompt Doesn't

- Explicit persona separation (`<system-message>`)
- Three-way distinction (agent/behavior/skill) vs two-way (agent/playbook)
- LLM-native instruction format (Markdown prose for system prompts)
- tmux-based visual teammate management
- Git-based versioning without database dependency

### Relevance to Provider-Agnostic Vision

SystemPrompt's multi-provider support (Anthropic, OpenAI, Gemini with fallback routing) validates our PRD's direction. Their A2A protocol and hub-and-spoke architecture provide a concrete reference for how provider-agnostic agent communication can work. The MCP integration aligns with our planned MCP abstraction layer.

The `systemprompt-code-orchestrator` repository (MCP server for coordinating AI coding agents targeting Claude Code CLI and Gemini CLI) is particularly worth monitoring — it's the closest external implementation to what our agent-team project aims to build.

## References

### Official Resources

- [SystemPrompt.io Homepage](https://systemprompt.io)
- [SystemPrompt.io Playbooks](https://systemprompt.io/playbooks)
- [SystemPrompt.io Documentation](https://systemprompt.io/documentation)
- [GitHub: systempromptio](https://github.com/systempromptio)

### Key Repositories

- [systemprompt-core](https://github.com/systempromptio/systemprompt-core) — Rust infrastructure library
- [systemprompt-template](https://github.com/systempromptio/systemprompt-template) — Quick-start agent mesh
- [systemprompt-code-orchestrator](https://github.com/systempromptio/systemprompt-code-orchestrator) — MCP for coordinating AI coding agents
- [systemprompt-mcp-server](https://github.com/systempromptio/systemprompt-mcp-server) — Production-ready MCP implementation

### Comparative Analysis

- [AI Agent Orchestration Frameworks — n8n Blog](https://blog.n8n.io/ai-agent-orchestration-frameworks/)
- [What is AI Orchestration? 21+ Tools — Akka](https://akka.io/blog/ai-orchestration-tools)
- [Comparative Study of AI Agent Orchestration Frameworks — Medium](https://medium.com/@kzamania/a-comparative-study-of-ai-agent-orchestration-frameworks-f61cd49b687e)

### Internal References

- Agent-team PRD: `docs/specs/draft/agent-team-project.md` in nsheaps/claude-utils
- Writing agent team agents skill: `.claude/skills/writing-agent-team-agents/SKILL.md`
- OpenCode porting research: `docs/research/opencode-agent-teams-porting.md`
