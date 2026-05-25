---
type: milestone-request
created: 2026-05-25T19:47:57Z
created_epoch: 1779738477
state: to-triage
project: GSD
requester: contacts://heaps-group/byGithubUsername/nsheaps
source_doc: docs/project-tracking/MASTER.md
source_header: "defining scope and cleaning git state"
events:
  - {
      ts: 2026-05-25T19:47:57Z,
      by: alex,
      change: "created from MASTER.md milestone-extraction sweep (project-setup step 3, via sonnet subagent)",
    }
---

# Milestone request: defining scope and cleaning git state

## Original MASTER.md content

> <a id="I32"></a>
>
> - 🚧 [`I32`](./task-summary/I32-repos-md.md): define all repos in scope for this project tracking list in [`./REPOS.md`](../../REPOS.md) (needs Nate's eyes). MUST include: `/home/nsheaps/.openclaw`, `nsheaps/aitkit`, `nsheaps/claude-code-sessions` (per Nate Discord [1508325751265431552](https://discord.com/channels/1490863845252665415/1497431286661517353/1508325751265431552) — these were called out as research inputs for [`I44`](#I44) and should be tracked here too). v1 draft + 3 open questions in per-task doc; awaiting handler review.
>   <a id="I30"></a>
> - 🚧 `I30`: commit outstanding work in agents, agent repos, ai-mktpl and other repos in REPOS.md — **partial**: agents/ai-mktpl/alex/claude-code-sessions done; aitkit needs Nate's WIP resolution (workspace-file conflict); jack/henry need peer-coord (spun down); C3 not started.
>   - Read each file thoroughly before committing, taking notes in your journal about anything that will help with the next task, there's a lot of disparate ideasa, but don't go crazy here.
>   - ✅ `C2`: let's commit all the other changes to the agents repo to main. we're gonna make some rapid changes make sure it's in a clean state. **Done**: 9 scaffolding stubs committed [`7294b9b`](https://github.com/nsheaps/agents/commit/7294b9b); notes at [`alex docs/journal/2026/05/25/agents-stub-scaffolding-notes.md`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/agents-stub-scaffolding-notes.md).
>   - 🆕 `C3`: **(scope expanded 2026-05-25 04:50Z per Nate)** — _(a)_ audit ALL open PRs across ALL open repos (state + age) and produce a report for Nate to triage tomorrow morning's merge sweep; _(b)_ make sure anything easy to close PR-wise on agents, agent repos, mktpl, tools, etc in the nsheaps org IS closed. Most are not easy — programatically dump it, then see if anything is relevant and easy. Per Nate Discord [`1508331380239634652`](https://discord.com/channels/1490863845252665415/1497431286661517353/1508331380239634652) "is that C3? increase the scope".
>     <a id="I39"></a>
> - ✅ `I39`: audit nsheaps/agents, nsheaps/ai-mktpl, and all the agent repos — survey state (committed/uncommitted files, open PRs, branches, untracked directories, stray skills/plugins/scripts) before scoping I32 (REPOS.md) and downstream cleanup. Per Nate Discord [1508288275817959524](https://discord.com/channels/1490863845252665415/1497431286661517353/1508288275817959524) + correction [1508288401248489564](https://discord.com/channels/1490863845252665415/1497431286661517353/1508288401248489564) (02:00Z) — position is "after I30 and sub-bullets, not before I32". **Audit report landed in alex journal**: [`docs/journal/2026/05/24/repo-audit/repo-audit.md`](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/24/repo-audit/repo-audit.md) (task #478/#481).
> - 🚧 [`C1`](./task-summary/C1-reddit-fetcher-rename.md): rename this plugin to `reddit` from reddit-fetcher [PR #166](https://github.com/nsheaps/agents/pull/166) (OPEN) — get it merged, and added to all agents. This is the current checkout branch and there's pending changes to commit, but they should go to main. Per-task doc captures 3 approach options (A: ask Jack, B: take over PR, C: merge-then-rename) — Nate pick needed.
>
> <a id="I28"></a>
>
> - 🆕 `I28`: Now that we have a bit more definition to each section, lets also talk about the approach, then split them into actual sections with headers
>   - Lets correct the cleanup section items to be in correct sections
>     <a id="I33"></a>
>   - 🆕 `I33`: propose a structure before making it
>   - when you make it, update this to be a TOC to link to the other tracking docs per section, so you have smaller things to update
>     <a id="I12"></a>
>   - 🆕 `I12`: [remove ticket number?] We're gonna do this stuff in this list in this order. We'll start reading stuff, and have HIGH risk for getting off track. it's very important to keep this document up to date until another source of truth is established. TODO: move to rules?
>     <a id="I20"></a>
>   - `I20`: [remove ticket number?] all of this is ill defined. All of this should bubble back into a spec in the agents repo in the appropriate place, though we'll still use the tickets for tracking.
>
> <a id="I44"></a>
>
> - 🆕 `I44`: build `incident-utils` plugin in `nsheaps/agents` with empty skill scaffolds for `incident-manage`, `incident-search`, `incident-type-behavioral`, `incident-type-infrastructure`, `incident-writing-postmortem`, `incident-type-software`. Multiple backends supported — start file-based, **really abstract out shared stuff** so other backends (Linear, GH issues) slot in cleanly. Skills self-update after each use. Fill `incident-type-behavioral` with 5 bullets covering: (1) track noted bad behavior, (2) research it, (3) experiment + fix, (4) validate, (5) deploy / ensure rollout for others. Install on alex + restart to pick up — going forward EVERY correction Nate gives gets logged as an incident BEFORE fixing. Overlaps with `correct-behavior` (agentic-behavior plugin) — likely supersedes or wraps it. Research inputs: ALL repos in [`I32`](#I32) REPOS.md (once it ships) + specifically `/home/nsheaps/.openclaw`, `nsheaps/aitkit` all branches back 1.5y, `nsheaps/claude-code-sessions` all branches back 1.5y for past incident-\* attempts (these three are now also called out for inclusion in REPOS.md). Per Nate Discord [1508323366082187407](https://discord.com/channels/1490863845252665415/1497431286661517353/1508323366082187407) (2026-05-25 04:18Z) + scope clarification [1508325751265431552](https://discord.com/channels/1490863845252665415/1497431286661517353/1508325751265431552) (04:28Z).
>
> <a id="I45"></a>
>
> - 🆕 `I45`: basic `dreaming` plugin in `nsheaps/agents` ("to do tonight"). Own plugin (not folded into agentic-behavior — but agentic-behavior likely-to-be-migrated rather than discarded). Flow: (1) **transcript triage** — review day's transcripts via haiku/sonnet sub-agents, extract tool failures, behavior corrections, user-upset moments into per-instance excerpts; (2) **daily retro** — comprehensive report: what went well, what didn't, behaviors to continue/stop/improve; (3) **improvement plan** — outline-first iteration on HOW to improve; (4) **ticket+task breakdown** — break plan into tickets, assign to self, tasks, work them with **max 1 PR per repo**, test thoroughly before new→open/draft→open; (5) **CI review** via review-utils dispatch; (6) **morning standup** — bring PRs up at start-of-work-day to merge BEFORE that day's work so improvements compound. Skills should **recursively call other skills** (both with + without `context:fork`). Run via `dreaming` sub-agent. Schedule via **plugin-settings cron** (NOT session-only CronCreate — must survive restarts; read Claude docs on plugin-settings crons). 1x/day @ 3am. **Catch-up**: if previous day's run was missed, on startup note last-run timestamp + suggest ad-hoc run NOW, but DO NOT execute unless operator agrees. Per Nate Discord [1508325147449364510](https://discord.com/channels/1490863845252665415/1497431286661517353/1508325147449364510) (2026-05-25 04:25Z).
>
> ### pause here HEREHERE

## Triage notes

(empty — to be filled during triage)
