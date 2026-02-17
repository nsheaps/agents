# Persona System Design Spec

**Status**: Draft
**Author**: Tweety Bird (Docs Writer)
**Date**: 2026-02-16
**Repo**: nsheaps/agent-team

---

## 1. Problem Statement

Agents will act autonomously in public-facing contexts: posting to Slack, creating GitHub issues, writing blog articles, commenting on Reddit. Today, persona traits are embedded in `<system-message>` blocks inside agent files and in separate `.claude/personas/` files, but there is no runtime system for loading, applying, or enforcing persona consistency across external channels.

Without a persona system, autonomous agents will:

- Use inconsistent voice across channels (formal on GitHub, casual on Slack — or vice versa)
- Lack channel-appropriate formatting (Slack markdown vs GitHub markdown vs blog HTML)
- Have no mechanism for persona evolution based on feedback
- Be unable to switch personas for different audiences or contexts

---

## 2. Current State

### What Exists Today

| Component | Location | Purpose |
|:--|:--|:--|
| `<system-message>` block | `.claude/agents/<name>.md` | Core identity in system prompt (persists through compaction) |
| Persona file | `.claude/personas/<name>.md` | Public-facing identity (communication style, public voice, avatar) |
| Persona reference | Agent file body | `**Persona**: .claude/personas/<name>.md` pointer |

### How Personas Are Used Today

Personas are **documentation only**. An agent must manually read its persona file before performing public-facing work. There is no automated loading, enforcement, or channel adaptation.

### Gaps

1. No runtime loading mechanism — agents must remember to read their persona file
2. No channel-specific voice guidance — same persona for Slack, GitHub, and blog
3. No consistency enforcement — nothing prevents persona drift over a long session
4. No evolution mechanism — personas are static markdown files
5. No multi-persona support — one agent, one persona, always

---

## 3. Design: Persona File Format

### Current Format (v1 — implemented)

```markdown
# Character Name

## Identity
- **Full Name**: ...
- **Character Inspiration**: ...
- **Disclaimer**: ...

## Personality Traits
- Trait 1
- Trait 2

## Communication Style
- Style guideline 1
- Style guideline 2

## Public Voice
When representing the team externally:
- Guideline 1
- Guideline 2

## Avatar Concept
Description of visual identity.
```

### Proposed Format (v2 — channel-aware)

```markdown
# Character Name

## Identity
- **Full Name**: ...
- **Character Inspiration**: ...
- **Disclaimer**: ...

## Personality Traits
- Trait 1
- Trait 2

## Communication Style
- Style guideline 1
- Style guideline 2

## Channel Voices

### Slack
- **Tone**: Conversational, concise
- **Format**: Short messages, emoji reactions, thread-aware
- **Signature**: First name only (e.g., "— Tweety")
- **Constraints**: Max 2000 chars per message, use threads for long content

### GitHub
- **Tone**: Professional, technical
- **Format**: Markdown with headers, code blocks, task lists
- **Signature**: "Character Name (Role)" in PR/issue bodies
- **Constraints**: Follow repo's PR template, link to issues

### Blog / Long-Form
- **Tone**: Authoritative but approachable
- **Format**: Full markdown with sections, examples, references
- **Signature**: Full byline with role and team attribution
- **Constraints**: 500-2000 words, include TL;DR

### Reddit / Forums
- **Tone**: Casual, community-aware
- **Format**: Plain text with minimal formatting
- **Signature**: Username-based, no formal signature
- **Constraints**: Match subreddit conventions, avoid corporate voice

## Avatar Concept
Description of visual identity.

## Evolution Log
<!-- Append entries as persona adapts -->
- **2026-02-16**: Initial persona created
```

### Key Changes in v2

1. **Channel Voices section**: Replaces generic "Public Voice" with per-channel guidance
2. **Evolution Log**: Append-only section for tracking persona changes over time
3. **Constraints per channel**: Concrete limits (char count, formatting rules) prevent channel-inappropriate output

---

## 4. Runtime Loading

### How Personas Get Applied

Persona loading should happen automatically, not rely on agents remembering to read a file. Three mechanisms, in order of preference:

#### Option A: SessionStart Hook (Recommended for near-term)

A `SessionStart` hook reads the agent's persona file and injects it as `additionalContext`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "cat .claude/personas/$(echo $CLAUDE_AGENT_NAME).md",
        "additionalContext": true
      }
    ]
  }
}
```

**Pros**: Automatic, no agent action needed, works with current Claude Code
**Cons**: `additionalContext` persistence through compaction is unclear; may be lost on long sessions
**Mitigation**: Combine with "Session Start" instruction in agent file to re-read persona after compaction

#### Option B: CLAUDE.md @references (Recommended for long-term)

If/when Claude Code supports per-agent CLAUDE.md inheritance or conditional `@references`, persona files could be automatically included in the agent's system prompt:

```markdown
<!-- In a hypothetical per-agent CLAUDE.md override -->
@personas/docs-writer.md
```

**Pros**: Persists through compaction (system prompt level), zero runtime cost
**Cons**: Not currently supported — would require Claude Code changes

#### Option C: MCP Server (Recommended for autonomous actions)

An MCP server that provides persona data as a tool:

```
Tool: get_persona
Parameters: { agent_name: "docs-writer", channel: "slack" }
Returns: { voice guidelines, formatting rules, constraints, signature }
```

**Pros**: Channel-aware, queryable, can include dynamic data (evolution state)
**Cons**: Requires building and maintaining an MCP server
**Best for**: The autonomous action use case — agent queries persona before posting to a specific channel

### Recommended Phased Approach

| Phase | Mechanism | When |
|:--|:--|:--|
| **Now** | Manual read + SessionStart hook | Current implementation |
| **Soon** | MCP tool for channel-specific persona queries | When agents start posting externally |
| **Later** | CLAUDE.md per-agent inheritance | When/if Claude Code supports it |

---

## 5. Channel Interaction Model

### How Personas Adapt to Channels

Each public channel has different conventions, audiences, and formatting requirements. The persona system must adapt the agent's voice without changing their core identity.

```
                    ┌─────────────────┐
                    │  Core Identity   │
                    │ (system-message) │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Persona File    │
                    │  (personality,   │
                    │   comm style)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────┴───┐  ┌──────┴─────┐  ┌────┴────────┐
     │   Slack     │  │   GitHub   │  │    Blog     │
     │   Voice     │  │   Voice    │  │   Voice     │
     │ (casual,    │  │ (technical,│  │ (authority, │
     │  concise)   │  │  precise)  │  │  narrative) │
     └─────────────┘  └────────────┘  └─────────────┘
```

### Channel-Specific Behaviors

| Aspect | Slack | GitHub | Blog | Reddit |
|:--|:--|:--|:--|:--|
| **Formality** | Low-medium | Medium-high | High | Low |
| **Length** | Short (1-3 sentences) | Medium (structured) | Long (sections) | Medium (conversational) |
| **Formatting** | Slack mrkdwn | GitHub Markdown | Full Markdown/HTML | Plain text |
| **Emoji** | Encouraged | Sparingly | Avoid | Contextual |
| **Signature** | First name | Name (Role) | Full byline | Username |
| **Response time expectation** | Fast | Reasonable | Async | Async |
| **Error handling** | Acknowledge quickly, fix in thread | File follow-up issue | Errata/correction post | Edit or reply |

### Consistency Rule

Across all channels, these elements MUST remain constant:

1. **Core personality traits** — a skeptical agent stays skeptical everywhere
2. **Expertise level** — don't simplify beyond the persona's domain knowledge
3. **Honesty stance** — if the persona values directness, that applies on Slack too
4. **Name and identity** — same character everywhere, adapted formality

What changes per channel is **format, length, and tone** — never **substance or character**.

---

## 6. Voice Consistency

### The Problem

Over a long session (or across sessions), agents can drift from their established persona voice. This is especially problematic for autonomous public-facing actions where inconsistency is visible to external audiences.

### Consistency Mechanisms

#### 1. Persona Anchoring (Passive)

The `<system-message>` block in the agent file serves as a persistent anchor — it survives compaction and stays in the system prompt. This provides baseline personality consistency even when detailed persona files are lost from context.

#### 2. Pre-Action Persona Check (Active)

Before any public-facing action, the agent should:

1. Read its persona file (or query the MCP persona tool)
2. Read the channel-specific voice guidance
3. Draft the content
4. Self-review against persona guidelines
5. Post

This could be formalized as a behavior (`.claude/behaviors/public-action.md`):

```markdown
# Public-Facing Action Behavior

Before posting to any public channel:

1. Read your persona file at `.claude/personas/<your-name>.md`
2. Identify the target channel and read its voice section
3. Draft your content following the channel's tone, format, and constraints
4. Self-review: Does this sound like your persona? Is the tone right for this channel?
5. Check constraints: character limits, formatting rules, signature format
6. Post
```

#### 3. Coach Review (Reactive)

The Team Coach can periodically review public-facing outputs for persona drift:

- Compare posted content against persona guidelines
- Flag inconsistencies in the failure log
- Recommend persona file updates if drift reveals a gap in the guidelines

#### 4. Feedback Loop (Evolutionary)

External feedback (user reactions, reviewer comments) can inform persona refinements:

```
Post → Feedback → Coach Review → Persona Update → Better Post
```

---

## 7. Persona Evolution

### Can Personas Learn and Adapt?

Yes, but with guardrails. Personas should evolve based on evidence, not drift based on convenience.

### Evolution Model

```
              ┌──────────────┐
              │   Feedback    │
              │  (reactions,  │
              │   reviews)    │
              └──────┬───────┘
                     │
              ┌──────┴───────┐
              │   Analysis    │
              │  (Coach or    │
              │   team lead)  │
              └──────┬───────┘
                     │
              ┌──────┴───────┐
              │   Decision    │
              │  (approve     │
              │   change?)    │
              └──────┬───────┘
                     │
              ┌──────┴───────┐
              │   Update      │
              │  (persona     │
              │   file edit)  │
              └──────┬───────┘
                     │
              ┌──────┴───────┐
              │ Evolution Log │
              │  (append-only │
              │   record)     │
              └──────────────┘
```

### What Can Evolve

| Aspect | Can Evolve? | Approval Required? |
|:--|:--|:--|
| Communication style details | Yes | Team lead |
| Channel-specific guidelines | Yes | Team lead |
| Avatar concept | Yes | User (human) |
| Core personality traits | Rarely | User (human) |
| Full name / identity | No | N/A — immutable |
| Character inspiration | No | N/A — immutable |

### Evolution Log

Every persona change is recorded in the Evolution Log section at the bottom of the persona file:

```markdown
## Evolution Log
- **2026-02-16**: Initial persona created
- **2026-03-01**: Added Reddit voice section based on first community posts
- **2026-03-15**: Softened Slack tone after feedback that messages felt too formal
- **2026-04-01**: Added emoji guidelines for GitHub based on repo conventions
```

### Anti-Patterns

- **Evolving too fast**: Don't change persona based on a single interaction. Wait for patterns.
- **Evolving core traits**: If Wile E. Coyote's core trait is "warm but blunt," don't make them diplomatic. That's a different persona.
- **Evolving without logging**: Every change must be in the Evolution Log. Unlogged changes are drift, not evolution.
- **Auto-evolution without approval**: Agents should NOT modify their own persona files. Changes require team lead or user approval.

---

## 8. Multi-Persona Scenarios

### Can One Agent Switch Personas?

**Design answer: Not in v1. Consider for v2.**

### Why Not in v1

The current design assumes 1:1 mapping between agent and persona. This is simpler to implement, easier to reason about, and sufficient for the current team structure. An agent named "Tweety Bird" posting as "Road Runner" would confuse teammates and external audiences.

### When Multi-Persona Makes Sense

| Scenario | Example | Value |
|:--|:--|:--|
| **Audience adaptation** | Technical persona for GitHub, casual persona for community Slack | Same agent, different presentation |
| **Role rotation** | An agent fills both "docs writer" and "community manager" roles | Different voice for different jobs |
| **A/B testing** | Testing which persona resonates better with an audience | Experimentation |
| **Anonymity** | Agent posts without team attribution | Privacy/security |

### v2 Multi-Persona Design (Future)

If implemented, multi-persona would work as:

1. **Default persona**: The agent's primary persona (current behavior)
2. **Context personas**: Additional personas the agent can adopt for specific channels or tasks
3. **Persona selection**: Agent chooses persona based on channel + task context
4. **Consistency rule**: Within a single thread/conversation, the agent MUST maintain one persona — no mid-conversation switching

```markdown
# In agent file (v2 hypothetical)
**Default Persona**: `.claude/personas/docs-writer.md`
**Context Personas**:
- Community channels: `.claude/personas/community-writer.md`
- Internal docs: `.claude/personas/docs-writer.md` (default)
```

### Can One Persona Fill Multiple Agent Roles?

**Yes, this is already possible.** Nothing prevents two agent files from referencing the same persona file. Example: a "Tweety Bird" persona could be used by both a `docs-writer` agent and a `community-manager` agent. The persona (who they are) stays the same; the role (what they do) changes.

---

## 9. Implementation Phases

| Phase | Scope | Deliverable |
|:--|:--|:--|
| **Phase 0** (Done) | Static persona files, manual loading | `.claude/personas/` with 8 files |
| **Phase 1** | SessionStart hook for auto-loading | Hook config in agent settings |
| **Phase 2** | Channel-aware persona format (v2) | Updated persona files with Channel Voices sections |
| **Phase 3** | Public-facing action behavior | `.claude/behaviors/public-action.md` |
| **Phase 4** | MCP persona tool | MCP server returning persona data per channel |
| **Phase 5** | Evolution framework | Coach review process, feedback loop, Evolution Log |
| **Phase 6** | Multi-persona support (v2) | Context persona selection, per-channel persona mapping |

---

## 10. Open Questions

1. **SessionStart additionalContext persistence**: Does content injected via `additionalContext` survive compaction? If not, the SessionStart hook approach has a significant gap for long sessions.

2. **MCP tool latency**: If agents query persona data before every public action, what's the latency impact? Is caching needed?

3. **Cross-team persona sharing**: If we have multiple agent teams (e.g., dev team and marketing team), can personas be shared across teams? Where do shared personas live?

4. **Persona versioning**: Should persona files be versioned independently? If a persona evolves, should old versions be preserved for audit trails?

5. **Human override**: When a human user directly instructs an agent to "be more formal" or "use a different tone," does that override the persona file? For how long?

6. **Persona conflicts with rules**: If a global rule says "never use emoji" but the persona's Slack voice says "emoji encouraged," which wins? Need a precedence model.

---

## References

### Current Implementation

- Persona files: `.claude/personas/*.md` (8 files, created commit `ae83a35`)
- Agent file references: `**Persona**: .claude/personas/<name>.md` in all 8 agent files
- Team structure docs: `.claude/docs/team-structure.md` ("Agent vs Persona" section)
- Writing skill: `plugins/agent-team-skills/skills/writing-agent-team-agents/SKILL.md` ("Agent vs Persona: The Core Distinction")

### Related Research

- Persona loading research — how system prompts, SessionStart hooks, and skills interact (conducted during looney-tunes session, Feb 2026; original report in claude-utils `.claude/tmp/`)
- Agent prompt best practices — research on effective agent prompting (conducted during looney-tunes session, Feb 2026; original report in claude-utils `.claude/tmp/`)
- [Claude-Flow research](../research/claude-flow.md) — multi-agent orchestration patterns, artifact-centric communication

### External References

- [Claude Code Sub-Agents](https://code.claude.com/docs/en/sub-agents) — agent file format, system prompt behavior
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks) — SessionStart hook, additionalContext
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) — team primitives, communication
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP server pattern for persona tool
