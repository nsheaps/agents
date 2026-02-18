# Behaviors

Behavior files are agent files that encapsulate **complex, multi-step procedures** — combining tools, skills, and general practices for tasks more involved than a single skill can handle.

## What Is a Behavior?

A behavior is not a role (that's an agent). A behavior is not a single action (that's a skill). A behavior is a **repeatable pattern of work** that involves multiple sub-components working together. Every teammate is expected to be able to perform these behaviors regardless of their role.

### Example: Research

Research is a behavior, not a role. While the Deep Researcher agent specializes in it, any teammate may need to perform research. The research behavior combines:

- **Evaluating peer research** — reading another teammate's report and assessing its quality, completeness, and accuracy
- **Looking stuff up on the internet** — using web search and web fetch tools with appropriate sub-agents to avoid context bloat
- **Fact-checking claims** — verifying that assertions have proper evidence and that sources are credible
- **Synthesizing findings** — combining information from multiple sources into a coherent conclusion
- **Writing structured reports** — producing reports with consistent structure (question, answer, evidence, confidence, sources)

No single skill covers all of this. The behavior file ties these sub-components into a coherent procedure.

## Behavior vs Agent vs Skill

| Concept      | What It Is                                            | Example                                                                                   |
| :----------- | :---------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| **Agent**    | A role with responsibilities and process              | `deep-researcher.md` — the Deep Researcher role                                           |
| **Skill**    | A single, focused capability                          | "How to use web search effectively"                                                       |
| **Behavior** | A complex procedure combining multiple sub-components | "How to conduct research" — evaluating, searching, fact-checking, synthesizing, reporting |

## File Format

Behavior files follow the same format as agent files — YAML frontmatter with a Markdown body:

```markdown
---
name: behavior-name
description: When to use this behavior and what it accomplishes
---

# Behavior Name

Description of the behavior and when to use it.

## Sub-Components

What this behavior combines.

## Procedure

Step-by-step process.

## Quality Standards

What "good" looks like for this behavior.
```

## Who Uses Behaviors?

**Every teammate.** Behaviors are not role-specific. Any teammate may need to research something, fact-check a claim, or evaluate a peer's work. Behavior files provide the procedure so teammates can perform these tasks consistently regardless of their primary role.

## References

- [Claude Code Sub-Agents](https://code.claude.com/docs/en/sub-agents)
- [Agent Skills Standard](https://agentskills.io)
