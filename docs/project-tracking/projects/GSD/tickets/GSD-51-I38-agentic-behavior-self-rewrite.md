---
type: feature
id: GSD-51
legacy_ids:
  - I38
created: 2026-05-25T01:50:00Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508284806859849889
events:
  - { ts: 2026-05-25T01:50:00Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-51 (state=triage) per triager-v2 workflow",
    }
---

# I38 — agentic-behavior self-rewrite skill with rubric scoring

## Original ask

> will get to your questions in a sec. Can you dispatch a sub-agent to make a PR for this in a worktree on the agentic-behavior skill in ai-mktpl? goal would be a skill you can run with context:fork that basically rewrites the skill as you think it should be, factoring in how stuff has gone since the last rewrite. Track this in a new ticket, since we're doing it async, we can do it immediately, but in the doc we'll put it after I31 in the same section. make sure the PR gets the ci review.
>
> agentic behavior rewrite skill, keep archive of rules in repo. Skill in plugin for managing that plugin + skills. That skill guides to move current ruleset into the archive and create a new one based on the behaviors of the old one and how tasks have been performed since the last recreate, especially in comparison to last bits. use a rubric to critique ruleset performance over time. The rubric can change, and so can scoring, but scoring must always be a categorical numeric scoring. Adjust the categories as needed, but document them and when the skill runs always evaluate those categories in the report, THEN adjust in the new ruleset. Ruleset in this case is not just rules, but also skills, agents, tools. The evals might be affected by other plugins as well, all of which we create, so embrace it, but note the improvements and there priority (adjust as you see fit after each iteration, some problems may rise in priority and warrant escalating if not resolved. This will be similar to dreaming so take note in the appropriate docs.

Source: Nate Discord[^discord-ask] (2026-05-25 01:45Z)

## Goal

A self-rewrite skill inside `plugins/agentic-behavior/` that: archives the current ruleset, scores it against a rubric, and emits a new ruleset version as a PR. The rubric categories are themselves tracked and may evolve across iterations.

## Scope

In:

- New skill inside `plugins/agentic-behavior/skills/<name>/SKILL.md` in [ai-mktpl](https://github.com/nsheaps/ai-mktpl). Skill runs with `context: fork`.
- Archive dir under the plugin (e.g. `plugins/agentic-behavior/archive/YYYY-MM-DDThhmmss/`) with snapshots of rules/, skills/, referenced agents + tools.
- Rubric doc (`plugins/agentic-behavior/rubric/RUBRIC.md`) — current scoring categories. Categories are tracked; skill MUST re-evaluate all categories AND may propose changes per iteration.
- Scoring: categorical numeric (e.g. 1–5 per category). Skill emits a scored report BEFORE proposing a new ruleset.
- PR against `ai-mktpl` `main` with skill + rubric + archive scaffold. PR requests `claude-review` (CI review label).
- Dreaming-style note: skill output also writes to `docs/journal/` noting iteration improvements and their priority.

Out (this iteration):

- Actually RUNNING the rewrite (this ticket lands the SKILL, not the first execution).
- Generalizing to other plugins.
- Cross-plugin rubric harmonization.
- Building eval harness for the rubric (manual for v1).

## Connection to brain-utils / dreaming

Per GSD-37 (brain-utils): dreaming is a subcomponent of brain-utils. The agentic-behavior self-rewrite skill (this ticket) is a distinct deliverable in ai-mktpl scope — it's about ruleset archaeology + systematic improvement, not online thought capture. The two are related (both are "self-correction mechanisms") but they live in different repos/plugins and serve different purposes.

## Acceptance criteria

1. PR on [ai-mktpl](https://github.com/nsheaps/ai-mktpl) with:
   - New skill SKILL.md (with `context: fork`)
   - Rubric markdown
   - Archive directory scaffold
   - PR body with rationale + ticket link
   - `claude-review` label requested
2. First run of the skill produces a scored report + new-ruleset PR (separate from this ticket's PR).

## Status

Sub-agent `agentic-behavior-rewriter` was dispatched from the original I38 per-task doc. Check for an open PR on ai-mktpl `agentic-behavior-self-rewrite-skill` branch before re-dispatching.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508284806859849889
