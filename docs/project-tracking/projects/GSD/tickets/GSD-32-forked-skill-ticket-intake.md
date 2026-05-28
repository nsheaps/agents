---
type: feature
created: 2026-05-26T00:49:00Z
id: GSD-32
legacy_ids:
  - "1779755955"
state: triage
project: GSD
priority: 0
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-605"
    note: "#605: AGENT(triager) Background sub-agent — execute #601 triage-promotion workflow"
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508633046063255563
events:
  - { ts: 2026-05-26T00:49:00Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:25:00Z,
      by: alex,
      change: "promoted to-triage → GSD-32 (state=triage) per #601 workflow",
    }
---

# Forked skill: ticket-intake (background, context-isolated)

## Original ask

> You can even make a forked skill for ticket-intake that can background it and remove it from your context so it gets done immediately.

Source: Discord msg[^discord-ask] (2026-05-26 00:49Z)

## Triage notes

- Skill at `.claude/skills/ticket-intake/SKILL.md` (alex repo first, then hoist into ticket-utils plugin).
- `context: fork` so it doesn't consume parent's tokens.
- Inputs: ask text, optional priority hint, optional drafts-vs-triage hint.
- Action: pick filename (epoch + slug), pick destination (drafts/ vs to-triage/), write file with proper frontmatter, commit, push, exit.
- Eliminates the "I'll file later" failure mode that prompted this very ticket.

## Footnote references

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508633046063255563
