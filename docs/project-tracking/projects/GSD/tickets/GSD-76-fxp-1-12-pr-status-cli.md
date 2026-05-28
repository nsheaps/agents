---
type: feature
id: GSD-76
legacy_ids:
  - FXP/1.12
created: 2026-05-28T03:30:00Z
state: in-progress
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-spec
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509394824468631666
  - id: discord-bun-ts
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509394964889468938
  - id: discord-location
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509395014541906040
  - id: fxp-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
events:
  - {
      ts: 2026-05-28T03:30:00Z,
      by: alex,
      change: "created from Nate Discord 03:16Z — pr-status CLI spec + skill capture",
    }
---

# FXP/1.12 — pr-status-cli (bun/ts) + how-to skill

## Original ask

From [Nate Discord 2026-05-28 03:16Z][^discord-spec] (then 03:16:34Z + 03:16:42Z + 03:16:54Z corrections):

> can you please restate the full list with emojis in front: [emoji scheme spec] … Capture this in a script where you can give it a PR url or org/repo#123 and it will spit out [output format] … Pass multiple PRs to the script as args, always use gql to look up all the info in one request for all of them. Then use that script to list all the PRs from [link]. one msg per repo. Merged PRs at top, then ready, then sort by most recent at top.
>
> capture how to do this in a skill
>
> no python · you should default to bun/ts if you must · put it in nsheaps/agents/apps/pr-status-cli

## Scope

In:

- `apps/pr-status-cli/` (bun/ts) — single batched-GraphQL request for N PRs, emoji-bucketed output.
- Ref forms: full URL, `owner/repo#N`, `owner/repo/pull/N`, `@<file>`.
- Output: `<state><ci><review> [[owner/repo#N] title](url)` markdown line per PR.
- Skill at `nsheaps/.ai-agent-alex/.claude/skills/pr-status/SKILL.md` documenting invocation + emoji legend + per-repo grouping/sort recipe.
- Initial application: run on the 119-PR transcript-grep list, one Discord message per repo (merged top → ready → most recent).

Emoji buckets (per Nate's spec):

- **State**: 🔵 draft · 🟠 merge-conflicted · 🟢 open · ✅ merged · ❌ closed-no-merge
- **CI**: ⛔️ conflicted (CI ignored) · 🟠 required-running others-failed · 🔵 some-running · 🔴 required-passed others-failed all-done · ❌ any-failed all-done · 🟢 all-passed no-required · ✅ all-passed incl-required
- **Review**: 🔵 no-reviews · ❌ any-rejections · 🟠 approved-criteria-not-met · 🟢 approved-ready · ✅ codeowner-approved-ready · 💬 commented-only

Out:

- Per-alias graceful 404 handling (current behavior: whole batch fails if one PR is missing → split externally). Future polish.
- Auto-chunking for 100+ PRs (current behavior: caller splits to ~25/batch to avoid GraphQL 502). Future polish.

## Acceptance criteria

- `bun run apps/pr-status-cli/src/index.ts nsheaps/agents#178` outputs a correctly-bucketed line.
- Multi-PR batched query (one `gh api graphql` call for N PRs) verified.
- README at `apps/pr-status-cli/README.md` describes usage + emoji legend.
- Skill at `.ai-agent-alex/.claude/skills/pr-status/SKILL.md` documents how-to-invoke.
- PR opened on nsheaps/agents named after GSD-76, CI green, Henry-reviewed, merged.
- Per-repo Discord digest posted from the 119-PR list.

## Related

- [Fixprompt dashboard][^fxp-dashboard] (#20) — entry FXP/1.12.

[^discord-spec]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509394824468631666

[^fxp-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
