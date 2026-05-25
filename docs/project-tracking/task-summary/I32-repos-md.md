# I32 — REPOS.md (define all in-scope repos for project tracking)

## Original message

From [MASTER.md `## defining scope and cleaning git state` bullet `I32`](https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md#I32):

> 🆕 `I32`: define all repos in scope for this project tracking list in ./REPOS.md (needs Nate's eyes). MUST include: `/home/nsheaps/.openclaw`, `nsheaps/aitkit`, `nsheaps/claude-code-sessions` (per Nate Discord [1508325751265431552](https://discord.com/channels/1490863845252665415/1497431286661517353/1508325751265431552) — these were called out as research inputs for [`I44`](#I44) and should be tracked here too)

Scope-clarification quote, Nate Discord [`1508325751265431552`](https://discord.com/channels/1490863845252665415/1497431286661517353/1508325751265431552) (2026-05-25 04:28Z): "for i44 all repos from REPOS.md are in scope too, the ones I mentioned should also be in REPOS.md".

## Scope

In:

- Create `nsheaps/agents/REPOS.md` listing every repo that is in-scope for project-tracking work (MASTER.md and downstream tickets).
- Each repo entry: path, GitHub org/name, role/purpose, current state link (audit + branch state).
- Initial roster: 8 repos that are already known to be in-scope:
  1. `nsheaps/agents` — workspace monorepo (this doc lives here)
  2. `nsheaps/ai-mktpl` — plugin marketplace (source of truth for installables)
  3. `nsheaps/.ai-agent-alex` — alex (this agent's) repo
  4. `nsheaps/.ai-agent-jack` — jack's repo
  5. `nsheaps/.ai-agent-henry` — henry's repo
  6. `/home/nsheaps/.openclaw` — Nate's local OpenClaw config/data directory (NOT a git repo; included per 04:28Z explicit ask as research artifact)
  7. `nsheaps/aitkit` — Nate's earlier agentic toolkit (research input for I44 incident-utils archaeology)
  8. `nsheaps/claude-code-sessions` — Nate's session/research archive (research input for I44)
- Stable structure that downstream tools (`I9` ticket-utils, `I44` incident-utils, `I39` audit re-runs) can read programmatically.

Out:

- The actual auditing / cleanup of each repo (that's `I39` + `I30` + `C2` + `C3`).
- Migration of any per-repo content (out of scope for REPOS.md).
- Defining what "in scope" means for future repos — for now, in-scope means "on this list".

## Scope review

Open questions for handler:

- (Q1) `/home/nsheaps/.openclaw` is a non-git config/data directory (not a checkout). Including it in REPOS.md treats it as a research artifact, not a tracked git repo. Is that the right framing, or should it be split off into a separate "research artifacts" doc?
- (Q2) Should REPOS.md include the marketplace-of-marketplaces auxiliary repos that are touched but not project-owned (e.g. `nsheaps/op-exec`, `nsheaps/homebrew-devsetup`, `nsheaps/.github`)? Conservative pick is "no, only the 8 above" — handler override welcome.
- (Q3) Should REPOS.md include the agent.worktrees side-trees as separate entries, or roll them under the parent repo? Proposing roll-under (worktrees are deployment of a branch, not a separate repo).

## Deliverables

1. `nsheaps/agents/REPOS.md` at repo root, with the 8 repos in v1 above.
2. Each entry follows a uniform table/section so future entries are mechanical.
3. MASTER.md `I32` line: flip status 🆕 → 🚧 + link to this per-task doc.
4. Discord post to Nate with the REPOS.md URL + the 3 open questions above for review.

## Plan

1. Draft REPOS.md v1 from audit data + Nate's 3-repo addition.
2. Wire MASTER.md I32 line to this per-task doc + change emoji.
3. Commit + push both files in one commit.
4. Post Discord with link + Q1/Q2/Q3 for handler resolution.

## Scope guardrails

- Do NOT audit any new repos as part of I32 — only document. Audits = `I39`.
- Do NOT migrate or relocate anything in the listed repos — that's `I30` / `C2` / `C3`.
- Do NOT codify REPOS.md format into ticket-utils yet — that's `I9` scope.

## Open Questions

- See "Scope review" Q1–Q3 above.

## Log

- 2026-05-25 04:35Z: doc created. Drafting REPOS.md v1 next.
