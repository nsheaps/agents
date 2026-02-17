# Writing Agent Team Agents

How to create and maintain agent files for the agent-team project.

## Agent File Structure

Agent files live at `.claude/agents/<agent-name>.md`. Each file has two parts: YAML frontmatter (configuration) and a Markdown body (system prompt).

### Template

```markdown
---
name: agent-name
description: |
  One-paragraph summary of what this agent does and when to use it.

  <example>
  Context: [Situation where this agent is appropriate]
  user: "[What the user says]"
  assistant: "[How Claude responds and uses this agent]"
  <commentary>
  [Why this agent is the right choice]
  </commentary>
  </example>

  <example>
  Context: [Different situation]
  user: "[Different request]"
  assistant: "[Different response]"
  <commentary>
  [Why this triggers the agent]
  </commentary>
  </example>

  <example>
  Context: [When NOT to use this agent]
  user: "[Request that seems related but isn't]"
  assistant: "[Handles it without this agent]"
  <commentary>
  [Why this does NOT warrant this agent]
  </commentary>
  </example>
color: blue
---

<system-message>
Your full name is [Character Name].
You are named after the [franchise] character, but do not act like [Character Name] — [brief disclaimer].
[Personal quirk or trait — 1 line]
[Another personal trait — 1 line]
[A belief or value — 1 line]
[An endearing detail — 1 line]
</system-message>

# [Character Name] ([Role Title])

**Persona**: `.claude/personas/<agent-name>.md` — defines public-facing identity for Slack, GitHub, and external communications.

One-sentence summary of what this agent does.

## Role

Paragraph describing the agent's purpose, approach, and what makes them effective. Written in second person ("You are..."). Covers their philosophy and working style.

## Responsibilities

1. [Primary responsibility]
2. [Secondary responsibility]
3. [Additional responsibilities...]

## What You Do NOT Do

- [Boundary 1 — prevents scope creep]
- [Boundary 2 — prevents role confusion]
- [Boundary 3 — delegates to others]

## Process

### [Primary Workflow]

Step-by-step procedure for the agent's main activity.

1. [Step 1]
2. [Step 2]
3. [Step 3]

### [Secondary Workflow]

Another procedure the agent performs.

## Quality Standards

- [Standard 1 — what "good" looks like]
- [Standard 2 — evidence requirements]
- [Standard 3 — communication expectations]

## Output

- **[Deliverable type]**: [Where it goes, e.g., `.claude/tmp/report.md`]
- **[Message type]**: [Who receives it and when]

## Edge Cases

- **[Scenario]**: [How to handle it]
- **SendMessage silent success**: Verify recipients exist before sending. The tool returns success even for non-existent recipients.

## Session Start

Start your session by reading the files in .claude/docs/.

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
```

### Frontmatter Fields

| Field             | Required    | Purpose                                                                                                                          |
| :---------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | Yes         | Agent identifier. Lowercase, hyphens, 3-50 chars.                                                                                |
| `description`     | Yes         | When to trigger this agent. Must include 2-3 `<example>` blocks. Include one negative example showing when NOT to use the agent. |
| `color`           | Recommended | UI color: `blue`, `cyan`, `green`, `yellow`, `magenta`, `red`                                                                    |
| `model`           | Optional    | `inherit`, `sonnet`, `opus`, `haiku`. Omit to inherit from parent.                                                               |
| `tools`           | Optional    | Allowlist of tools. Omit for all tools.                                                                                          |
| `disallowedTools` | Optional    | Denylist of tools. Alternative to `tools`.                                                                                       |
| `permissionMode`  | Optional    | Permission mode for the agent session.                                                                                           |
| `maxTurns`        | Optional    | Maximum API round-trips before stopping.                                                                                         |
| `skills`          | Optional    | Skills to preload into conversation context (NOT system prompt).                                                                 |
| `mcpServers`      | Optional    | MCP servers available to the agent.                                                                                              |
| `hooks`           | Optional    | Agent-specific hooks.                                                                                                            |
| `memory`          | Optional    | Memory configuration.                                                                                                            |

## Key Technical Facts

These findings come from research conducted during the looney-tunes team session (Feb 2026). Understanding them prevents common mistakes.

### The Agent File Body IS the System Prompt

The Markdown body after the frontmatter `---` becomes the agent's **system prompt** — the persistent instructions that survive context compaction. This is the single most important thing to understand about agent files.

> "Subagent files use YAML frontmatter for configuration, followed by the system prompt in Markdown... The body becomes the system prompt that guides the subagent's behavior."

Source: [Claude Code Sub-Agents Docs](https://code.claude.com/docs/en/sub-agents#write-subagent-files)

### What Does NOT Work in Agent Files

| Mechanism                             | Works? | Where It Works Instead                                                              |
| :------------------------------------ | :----- | :---------------------------------------------------------------------------------- |
| `@references` (e.g., `@docs/file.md`) | No     | CLAUDE.md only                                                                      |
| `!`command`` dynamic injection        | No     | Skills only ([docs](https://code.claude.com/docs/en/skills#inject-dynamic-context)) |
| Template/variable substitution        | No     | Not supported anywhere                                                              |

### What Goes Where

| Content                                  | Location                                    | Persistence                                         |
| :--------------------------------------- | :------------------------------------------ | :-------------------------------------------------- |
| Agent persona + role instructions        | Agent file body                             | System prompt (persistent)                          |
| Shared team docs                         | `.claude/docs/` via CLAUDE.md `@references` | System prompt (persistent, inherited by all agents) |
| Preloaded skills (`skills:` frontmatter) | Conversation context                        | Compactable (may be lost)                           |
| Task tool `prompt` parameter             | First user message                          | Compactable (may be lost)                           |
| SessionStart hook `additionalContext`    | Context injection                           | Unclear persistence through compaction              |

**Implication**: Anything that MUST persist through compaction belongs in the agent file body or in CLAUDE.md. Everything else is supplementary.

Source: Persona loading research (conducted during looney-tunes session, Feb 2026; original report in claude-utils `.claude/tmp/`)

### CLAUDE.md Inheritance

All agents inherit the project's CLAUDE.md content (including its `@references`). This is useful for shared documentation like team rules, communication protocols, and project structure. But it means **all agents see all CLAUDE.md content** — don't put agent-specific instructions there.

## Agent vs Persona: The Core Distinction

Agent files and persona files serve fundamentally different purposes:

| Concept | Location | What It Is |
|:--------|:---------|:-----------|
| **Agent** (`.claude/agents/<name>.md`) | System prompt | The **job** — role, responsibilities, behaviors, process, quality standards |
| **Persona** (`.claude/personas/<name>.md`) | Reference doc | The **person** — identity, communication style, public voice, avatar concept |

**Why they're separate**: Agents will act autonomously in public-facing contexts — Slack messages, GitHub issues, blog articles, Reddit posts. The persona defines HOW the agent presents itself externally. The agent file defines WHAT the agent does professionally.

### `<system-message>` Block (Core Identity)

Located immediately after the frontmatter in agent files. Contains 5-7 lines of **core identity traits**:

- Full name
- Namesake disclaimer (e.g., "named after X, but do not act like X")
- Personal quirks, temperament, beliefs
- Endearing details that make the character feel distinct

**What does NOT go here**: Role descriptions, responsibilities, tool instructions, communication protocols, process steps.

The `<system-message>` block is embedded in the system prompt and persists through compaction. It provides the character core that shapes internal team interactions.

### Persona File (Public-Facing Identity)

Located at `.claude/personas/<agent-name>.md`. Contains:

- **Identity**: Full name, character inspiration, disclaimer
- **Personality Traits**: Core characteristics (mirrors `<system-message>` but with more detail)
- **Communication Style**: How the agent writes and speaks
- **Public Voice**: Specific guidance for external communications (Slack, GitHub, blogs)
- **Avatar Concept**: Visual identity description

Agent files reference their persona with:

```markdown
**Persona**: `.claude/personas/<agent-name>.md` — defines public-facing identity for Slack, GitHub, and external communications.
```

When performing autonomous public-facing actions, agents should read their persona file to adopt the appropriate voice and style.

### Role Section (Professional)

The rest of the agent file body. Contains:

- Role summary and philosophy
- Responsibilities (numbered list)
- Boundaries ("What You Do NOT Do")
- Process (step-by-step procedures)
- Quality standards
- Output locations
- Edge cases
- Session start instruction

**Why the three-way separation matters**: The `<system-message>` block creates character core in the system prompt. The persona file adds public-facing identity for external actions. The role section defines professional behavior. Mixing them dilutes all three — role instructions buried in persona traits get lost, public voice guidance clutters the system prompt, and persona traits scattered through role sections feel disconnected.

## Agent vs Behavior vs Skill

These three concepts serve different purposes. Conflating them leads to bloated agents, underused skills, or undocumented procedures.

| Concept      | What It Is                                                          | Owned By             | Example                                                                        |
| :----------- | :------------------------------------------------------------------ | :------------------- | :----------------------------------------------------------------------------- |
| **Agent**    | Autonomous role with its own session, persona, and responsibilities | One agent file       | `deep-researcher.md` — performs complex investigations                         |
| **Behavior** | Encapsulated multi-step procedure that any agent can execute        | `.claude/behaviors/` | "How to conduct research" — evaluating, searching, fact-checking, synthesizing |
| **Skill**    | Task-specific knowledge/instructions recalled on demand             | `plugins/*/skills/`  | "How to write agent files" (this document)                                     |

**Key distinctions**:

- An agent HAS a persona. A behavior and skill do not.
- A behavior is role-agnostic — any teammate can perform it. An agent's role section is specific to that agent.
- A skill is recalled explicitly (via the Skill tool). A behavior is referenced when the situation calls for it.

Source: `.claude/behaviors/README.md`

## Lessons Learned and Anti-Patterns

Hard-won knowledge from the looney-tunes team session.

### Don't Put Role Descriptions in Persona Traits

The `<system-message>` block is for personal character — name, quirks, beliefs. Do NOT put responsibilities, tool instructions, or workflow steps there. Those belong in the Role section. Similarly, don't put public voice or communication style guidance in the `<system-message>` — that belongs in the persona file (`.claude/personas/`).

### Don't Use `@references` in Agent Files

`@references` only work in CLAUDE.md. If you put `@docs/team-rules.md` in an agent file body, it will appear as literal text, not as imported content. Put shared references in CLAUDE.md instead — agents inherit CLAUDE.md automatically.

### Don't Assume Prettier Mangles Frontmatter

Prettier has handled YAML frontmatter correctly since v1.14 (July 2018). The only known active issue is with `--prose-wrap always` and folded multiline strings ([Issue #16126](https://github.com/prettier/prettier/issues/16126)). With the default `proseWrap: preserve`, agent files format correctly. Do not add `.prettierignore` entries for agent files without first confirming an actual formatting bug.

Source: Prettier frontmatter research (conducted during looney-tunes session, Feb 2026; original report in claude-utils `.claude/tmp/`)

### Always Verify Commit Scope

After committing, run `git show --stat HEAD` to verify only intended files were included. Unrelated files in a commit create noise, complicate reviews, and make rollbacks harder.

### Always Use TaskGet for Latest Requirements

Task descriptions can be updated after creation. Always call `TaskGet` before starting work to get the latest version. Don't rely on the original assignment message — it may be stale.

### Compaction Summaries Are Lossy

When your conversation context is compacted, the summary may lose details — especially teammate names, specific instructions, and nuanced requirements. After compaction:

1. Re-read the team config (`~/.claude/teams/{team-name}/config.json`) for correct teammate names
2. Use `TaskGet` to re-read your current task description
3. Message the team lead to confirm your understanding of current priorities

### Include a Negative Example in Description

Every agent's `description` should include at least one `<example>` showing when NOT to use the agent. This prevents over-triggering and helps Claude route work to the right specialist.

## Communication Patterns

### SendMessage Silent Success Gotcha

The `SendMessage` tool returns `{"success": true}` even when the recipient doesn't exist. Messages sent to non-existent recipients are silently lost. Always verify teammate names by reading the team config before sending.

Source: Observed during looney-tunes session — researcher sent findings to "Bugs Bunny (Team Lead)" (non-existent) instead of "team-lead" (actual recipient). Multiple messages were lost.

### Failure Reporting to Coach

When something goes wrong, message both the Coach AND the team lead:

- **Coach**: Records the failure for pattern analysis
- **Team lead**: Coordinates the fix

Include: what happened, what you expected, what you tried, and what's blocked.

### Lateral Collaboration

Teammates can and should message each other directly for coordination. Don't bottleneck on the orchestrator for every interaction. But always inform the Coach and orchestrator afterward.

### Chain of Authority

```
User (human)
  └── Orchestrator (team-lead)
        └── All teammates
```

Do NOT escalate directly to the user. Do NOT self-assign tasks. Do NOT override another teammate's work without coordination.

## Session Start Instruction

Every agent file should end with a "Session Start" section telling the agent to read shared docs:

```markdown
## Session Start

Start your session by reading the files in .claude/docs/.
```

This ensures every agent loads the shared team documentation (team rules, communication protocol, team structure) on startup, since `@references` don't work in agent files.

## References

### Research Reports

Research conducted during looney-tunes session (Feb 2026). Original reports stored in claude-utils `.claude/tmp/`:

- Persona loading research — how system prompts, SessionStart hooks, and skills interact
- Agent prompt best practices — effective agent prompting patterns
- Prettier frontmatter — YAML frontmatter handling in prettier

### Official Documentation

- [Claude Code Sub-Agents](https://code.claude.com/docs/en/sub-agents) — agent file format, frontmatter fields, system prompt behavior
- [Claude Code Skills](https://code.claude.com/docs/en/skills) — `!`command`` syntax, skill format
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks) — SessionStart `additionalContext`
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) — team primitives, communication, lifecycle
- [Agent Skills Standard](https://agentskills.io) — industry skill format

### GitHub Issues

- [Prettier #16126](https://github.com/prettier/prettier/issues/16126) — YAML folded multiline + prose-wrap (OPEN)
- [Prettier #15187](https://github.com/prettier/prettier/issues/15187) — flow vs block sequences (won't fix)
- [Prettier #4725](https://github.com/prettier/prettier/issues/4725) — format YAML frontmatter (implemented in v1.14)
