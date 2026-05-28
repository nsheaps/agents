---
type: chore
id: GSD-50
legacy_ids:
  - I32
aliases:
  - "I32"
created: 2026-05-25T04:35:00Z
state: triage
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-611"
    note: "#611: AGENT(triager-v2): Process to-triage chronologically per new spec (14 items)"
  - id: master-md-bullet
    type: doc
    url: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md
  - id: discord-scope-clarification
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508325751265431552
  - id: discord-open-q-resolution
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508331380239634652
events:
  - {
      ts: 2026-05-25T04:35:00Z,
      by: alex,
      change: "created from MASTER.md I32 bullet + per-task doc I32-repos-md.md",
    }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-50 (state=triage) per triager-v2 workflow",
    }
---

# I32 — REPOS.md (define all in-scope repos for project tracking)

## Original ask (MASTER.md I32)

> 🆕 `I32`: define all repos in scope for this project tracking list in ./REPOS.md (needs Nate's eyes). MUST include: `/home/nsheaps/.openclaw`, `nsheaps/aitkit`, `nsheaps/claude-code-sessions` (per Nate Discord [1508325751265431552](https://discord.com/channels/1490863845252665415/1497431286661517353/1508325751265431552) — these were called out as research inputs for `I44` and should be tracked here too)

## Scope clarification (Nate Discord 04:28Z)[^discord-scope-clarification]

> for i44 all repos from REPOS.md are in scope too, the ones I mentioned should also be in REPOS.md

## Status

As of 2026-05-25 05:08Z: REPOS.md v1.1 was drafted (added aux repos + `.openclaw` clarification). A sub-agent (`AGENT(nsheaps-org-audit)`) was dispatched to perform a full nsheaps org audit + cross-ref with `~/src/nsheaps`. The audit findings may add more repos to REPOS.md.

## Open questions (resolved 2026-05-25 04:50Z)[^discord-open-q-resolution]

- **Q1**: keep `.openclaw` in REPOS.md as research-only ✅
- **Q2**: include touched-but-not-owned aux repos (op-exec, homebrew-devsetup, .github) ✅
- **Q3**: just repos, not branches/worktrees ✅
- **New scope**: full nsheaps org audit + cross-ref with `~/src/nsheaps` + last-year-activity filter. Findings go to `alex docs/research/nsheaps-org-repo-audit.md`; REPOS.md updates from that pass follow.

## Acceptance criteria

- `nsheaps/agents/REPOS.md` exists at repo root with the 8+ known repos.
- Org audit sub-agent results are incorporated into REPOS.md.
- Nate has reviewed REPOS.md (needed per original ask "needs Nate's eyes").
- MASTER.md `I32` line links to this ticket + shows current state.

[^discord-scope-clarification]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508325751265431552

[^discord-open-q-resolution]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508331380239634652
