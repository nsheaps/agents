> The following is the contents of the file as previously lived in docs/project-tracking/task-summary/xxxx.md. To triage this ticket, we'll need to appropriately file this as an actual ticket within the appropriate project.
> Review the summary, and MASTER.md, and build out the ticket to triage.
> Then, get the triage request to the actual ticket(s) in triage state and in the correct project(s). This will likely be one ticket per file for now, but you may choose to make more than one if you deem appropriate.
> The ticket should capture this original summary, and the original messaging as it appears in MASTER.md. It MUST also be linked to the appropriate milestone.
> When the ticket is ready, in the triage state, and is confirmed to have the needed information, update master.md appropriately to link to the ticket instead of keeping info in master.md. The link should be: `[$emojiState | $ticketShortDescription](relative/link/to/file/that/works/on/github/and/local/instead/of/link/to/github/directly.md)` the ticket short description.

---

# I38 — agentic-behavior self-rewrite skill with rubric scoring

## Original message

From Nate Discord [`1508284806859849889`](https://discord.com/channels/1490863845252665415/1497431286661517353/1508284806859849889) (2026-05-25 01:45Z):

> will get to your questions in a sec. Can you dispatch a sub-agent to make a PR for this in a worktree on the agentic-behavior skill in ai-mktpl? goal would be a skill you can run with context:fork that basically rewrites the skill as you think it should be, factoring in how stuff has gone since the last rewrite. Track this in a new ticket, since we're doing it async, we can do it immediately, but in the doc we'll put it after I31 in the same section. make sure the PR gets the ci review.
>
> agentic behavior rewrite skill, keep archive of rules in repo. Skill in plugin for managing that plugin + skills. That skill guides to move current ruleset into the archive and create a new one based on the behaviors of the old one and how tasks have been performed since the last recreate, especially in comparison to last bits. use a rubric to critique ruleset performance over time. The rubric can change, and so can scoring, but scoring must always be a categorical numeric scoring. Adjust the categories as needed, but document them and when the skill runs always evaluate those categories in the report, THEN adjust in the new ruleset. Ruleset in this case is not just rules, but also skills, agents, tools. The evals mgiht be affected by other plugins as well, all of which we create, so embrace it, but note the improvements and there priority (adjust as you see fit after each iteration, some problems may rise in priority and warrant escalating if not resolved. This will be similar to dreaming so take note in the appropriate docs.

## Scope

In:

- New skill inside `plugins/agentic-behavior/skills/<name>/SKILL.md` in [ai-mktpl](https://github.com/nsheaps/ai-mktpl). Skill runs with `context: fork` (its own model context, not pollution of caller).
- Archive dir under the plugin (e.g. `plugins/agentic-behavior/archive/YYYY-MM-DDThhmmss/`) containing snapshot of: rules/, skills/, plus references/snapshots of agents + tools the agentic-behavior plugin defines or affects.
- Rubric doc in the plugin (e.g. `plugins/agentic-behavior/rubric/RUBRIC.md`) describing the current scoring categories. Categories are themselves a tracked thing — when the skill runs, it MUST re-evaluate all documented categories AND may propose category changes for the next iteration.
- Scoring: categorical numeric (e.g. 1–5 per category). The skill emits a report that scores the prior ruleset against the rubric BEFORE proposing a new ruleset. Scores are stored alongside the archive snapshot for trend analysis.
- A PR against `ai-mktpl` `main` that adds the skill, the rubric, and an initial empty archive scaffold. PR requests `claude-review` (CI review label per repo convention).
- Dreaming-style note: skill output also writes to `docs/journal/` in the agents repo or appropriate docs dir, noting iteration improvements and their priority. Priorities may rise/fall per iteration; escalation guidance is part of the skill.

Out (this iteration):

- Actually RUNNING the rewrite (this ticket lands the SKILL, not the first execution).
- Generalizing to other plugins (e.g. common-sense, scm-utils self-rewrite) — future iteration.
- Cross-plugin rubric harmonization — for now, agentic-behavior owns its own rubric.
- Building eval harness for the rubric (manual evaluation by the skill-author for v1; later automated).

## Deliverables

1. PR on [ai-mktpl](https://github.com/nsheaps/ai-mktpl) with:
   a. New skill SKILL.md (with `context: fork`)
   b. Rubric markdown
   c. Archive directory scaffold (.gitkeep or initial README explaining structure)
   d. PR body documents the rationale + ticket link
   e. `claude-review` label requested
2. Per-task doc (this file) updated with PR URL once dispatched.
3. Discord ACK to Nate with PR link + sub-agent ID once PR is open.

## Plan

1. Land MASTER.md I38 ticket + this per-task doc, commit + push (agents repo). ✅ in progress.
2. Dispatch sub-agent `agentic-behavior-rewriter` (run_in_background, sonnet, NOT general-purpose) with explicit instructions to:
   - Use `git worktree add` on /home/nsheaps/src/nsheaps/ai-mktpl (or EnterWorktree).
   - Branch name: `agentic-behavior-self-rewrite-skill`.
   - Design + write the skill, rubric, and archive scaffold.
   - Commit + push + open PR with `claude-review` label.
   - Return PR URL.
3. On sub-agent return: update this doc + close I38, ACK Nate with PR link.

## Scope guardrails

- Do NOT modify any other plugins in ai-mktpl during this PR.
- Do NOT include actual archive contents — only the scaffold + README.
- Do NOT trigger the skill itself as part of this PR; that's a separate run.

## Open Questions

- (none open as of doc creation — Nate's message is detailed enough to execute)

## Log

- 2026-05-25 01:50Z: doc created. I38 ticket added to MASTER.md.
