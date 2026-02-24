# PR Review: agent-team#99 — Agent Memory Spec

**Score**: 81/100 ⚠️
**Verdict**: Fix then merge

**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23
**Diff**: `/tmp/pr-agentteam-99.diff`

---

## Category Scores

| Category         | Score | Status |
|:-----------------|------:|:-------|
| Simplicity       |    85 | ✅     |
| Flexibility      |    88 | ✅     |
| Usability        |    80 | ⚠️     |
| Documentation    |    88 | ✅     |
| Security         |    82 | ⚠️     |
| Pattern Matching |    72 | ⚠️     |
| Best Practices   |    80 | ⚠️     |
| General QA       |    72 | ⚠️     |

**Overall (weighted average, capped at 94 if any category <85%)**: 81/100

---

## Findings

### pattern-matching-1: Frontmatter format inconsistent with repo spec patterns (P2)

**File**: `docs/specs/draft/agent-memory.md:7-16`
**Description**: The frontmatter uses an ad-hoc YAML block with fields (`informs`, `source`) not present in any other spec in the repo. Existing specs (persona-system, agent-launcher) use a flat blockquote or plain bold-text header for metadata. The agent-launcher spec uses `> **Status**: Draft` blockquote format; persona-system uses `**Status**: Draft` bold-text. The new spec uses a proper YAML `---` frontmatter block, which is actually the strongest pattern — but no other spec uses it, making this an inconsistency, not a strict regression.

**Expected**: Consistent frontmatter format across specs in `docs/specs/draft/`. If this spec introduces a new canonical format, a follow-up should standardize the others (or the old format should be adopted here).

**Recommendation**: Either adopt the format used in existing specs (simple bold-text header block), or call out in this spec that this is the new canonical format and open a task to update the others. Mixed formats across specs make tooling and scanning harder.

---

### pattern-matching-2: Missing "Non-Goals" section (P3)

**File**: `docs/specs/draft/agent-memory.md` (entire spec — section absent)
**Description**: The agent-launcher spec (the most detailed comparable spec in the repo) includes a prominent `### Non-Goals (this phase)` section immediately after Goals. The agent-memory spec omits this entirely. For a spec of this scope — covering three backends, three sync approaches, and three phases — non-goals are especially important to prevent scope creep.

**Expected**: A Non-Goals section that explicitly calls out what is NOT in scope (e.g., memory search/semantic indexing, inter-agent memory sharing during a session, memory compaction/pruning automation, memory-to-rules promotion).

**Recommendation**: Add a Non-Goals section to §1 or immediately following it.

---

### general-qa-1: `memory:` frontmatter field is described but its syntax is undefined (P2)

**File**: `docs/specs/draft/agent-memory.md:59,336`
**Description**: The spec references "Claude Code native `memory:` frontmatter scopes" (§2.1) and "Changing the memory scope for any agent (frontmatter `memory:` field)" (§6.2) — but never shows what this frontmatter looks like in an agent file. There is no example of a `.claude/agents/software-eng.md` with a `memory: project` field. Without this, implementers will have to guess the syntax, and there's no spec-to-code traceability.

**Expected**: An example agent frontmatter block showing the `memory:` field in use, similar to the agent-launcher spec's "Example Agent File" section (§3 of that spec).

**Recommendation**: Add a code block to §2.1 (or Phase 1 deliverable in §7) showing what the frontmatter addition looks like in practice.

---

### general-qa-2: "200 lines enforced by Claude Code" is an unverified claim (P2)

**File**: `docs/specs/draft/agent-memory.md:80`
**Description**: The spec states "MEMORY.md as concise index (≤200 lines enforced by Claude Code)." This is presented as a fact, not a design decision or a constraint the spec is imposing. If Claude Code does not actually enforce this limit, the spec is misleading. If the spec is imposing the limit, the enforcement mechanism needs to be stated (the CI check in §4.2 checks line count, but only in Phase 2 — there's no enforcement in Phase 1 at all).

**Expected**: Either a citation confirming Claude Code enforces this limit, or a rewrite clarifying this is a team convention enforced via CI (Phase 2+).

**Recommendation**: Change to "≤200 lines (enforced via CI in Phase 2; team convention in Phase 1)" or provide a reference to Claude Code documentation that confirms the native enforcement.

---

### security-1: No guidance on handling memory files that contain accidentally committed secrets (P2)

**File**: `docs/specs/draft/agent-memory.md:262-272` (§5.2)
**Description**: §5.2 defines what must not go in git-tracked memory, and §4.2 includes a "secrets scanning" CI check. However, the spec provides no remediation guidance for when a secret does get committed (e.g., `git filter-repo`, invalidating the exposed credential, notifying the team). Secrets in memory files are particularly insidious because they look like legitimate agent learnings.

**Expected**: A brief "if secrets are accidentally committed" remediation note in §5.2 or a reference to the team's existing secret-exposure runbook if one exists.

**Recommendation**: Add a "If a secret is committed" subsection to §5.2 with: (1) rotate the credential immediately, (2) use `git filter-repo` or BFG to purge the history, (3) force-push with team-lead approval, (4) notify AI Agent Eng. Even a one-liner pointing to an existing runbook is better than silence.

---

### security-2: `local`-scoped memory path is inside `.claude/` which is typically git-tracked — gitignore entry is required but its absence is only mentioned once (P2)

**File**: `docs/specs/draft/agent-memory.md:62,146-150`
**Description**: The spec correctly calls out that `.claude/agent-memory-local/` must be added to `.gitignore` (§3.1). However, §2.1's table entry for `local` scope says "No (gitignored)" as if this is already the case. It is NOT already the case — this is a deliverable of Phase 1 (Step 2 in §7). If an implementer reads §2.1 in isolation they may think no action is needed.

**Expected**: §2.1's `local` row should clarify the gitignore entry is required and is not yet in place, or cross-reference Phase 1 Step 2 explicitly.

**Recommendation**: Change the `local` row's "Git-tracked" cell to "No (requires `.gitignore` entry — Phase 1 Step 2)" to make the dependency explicit.

---

### usability-1: Promotion workflow for shared/ described in two places with inconsistent detail (P3)

**File**: `docs/specs/draft/agent-memory.md:116` (§2.3) and `370` (§8 Open Questions)
**Description**: §2.3 states "Individual agents promote learnings to shared via PR. Team lead or PM reviews. No direct agent writes to `shared/` — all changes go through review." But §8 lists "Promotion workflow for shared/" as an open question with options "PR-based review vs direct agent push." This is a direct internal contradiction: the spec simultaneously defines the approach AND lists it as an open question.

**Expected**: If the PR-based approach is the recommended default, remove it from §8 or reframe the open question as a confirmation request. If it's still genuinely open, remove the prescriptive language from §2.3.

**Recommendation**: Resolve the contradiction. Either: (a) keep §2.3's prescriptive language and remove the row from §8, annotating it as a resolved decision; or (b) soften §2.3 to "recommended approach" and keep §8. The current state will confuse implementers.

---

### usability-2: Phase 1 deliverable does not define what "enable `memory: project` in agent frontmatter" looks like (P3)

**File**: `docs/specs/draft/agent-memory.md:336`
**Description**: Phase 1 Step 1 says "Enable `memory: project` in all agent frontmatter files that are missing it." This is an implementation instruction without a code example. What does the frontmatter look like before and after? See general-qa-1 — this finding reinforces the need for an example.

**Recommendation**: Cross-reference to an example in §2.1, or add the before/after agent frontmatter snippet directly in Phase 1.

---

### documentation-1: ASCII diagram in §2 uses inconsistent terminology (P3)

**File**: `docs/specs/draft/agent-memory.md:43-53`
**Description**: The diagram labels the three backends as "Memory Backend", "Agent Backend", and "Team Backend." The section headings below use "Memory Backend — Individual Learnings" (§2.1), "Agent Backend — Identity Persistence" (§2.2), and "Team Backend — Shared Knowledge" (§2.3). The diagram is too compressed to show the subtitles, leaving the diagram labels ambiguous — "Memory Backend" in the diagram looks like it means all three together.

**Expected**: Either (a) update the diagram labels to use longer subtitles if space permits, (b) add a caption below the diagram that maps diagram labels to section references, or (c) label them Memory/Identity/Team in the diagram to match the subtitles.

**Recommendation**: A simple caption — "Left: Individual Learnings (§2.1) | Center: Identity Persistence (§2.2) | Right: Shared Knowledge (§2.3)" — would resolve this without touching the diagram.

---

### best-practices-1: No conflict resolution strategy for concurrent writes to shared MEMORY.md (P3)

**File**: `docs/specs/draft/agent-memory.md:307-308` (§6.1)
**Description**: §6.1 states agents write to their own MEMORY.md "automatically" at session end. If two sessions for the same agent run concurrently (which can happen in multi-machine or multi-session scenarios), both will attempt to write to the same file, creating git merge conflicts. The spec does not address this.

**Expected**: Either a constraint that limits agents to single sessions (if that's the design assumption), or a conflict resolution strategy (last-write-wins append, merge tool guidance, or a lock/claim mechanism).

**Recommendation**: Add a note to §6.1 or §4.1 (Local sync): "Concurrent writes from multiple sessions of the same agent are not supported in Phase 1. Each agent must run in a single session at a time. Conflict resolution will be addressed in Phase 2 with CI validation."

---

### best-practices-2: K8s sidecar spec cites no actual implementation reference (P4)

**File**: `docs/specs/draft/agent-memory.md:226-242` (§4.3)
**Description**: The K8s sidecar pattern is described in specific technical detail (debounce 30s, PVC, git remote as backing store) but no existing implementation, reference project, or prior art is cited. Given this is Phase 3 and informational only, the detail level is fine — but the absence of any citation is inconsistent with the documentation-references rule and the spec's own references section.

**Expected**: At minimum, a link to a reference implementation or documentation of the sidecar pattern for git sync (e.g., Letta Context Repositories, or a relevant K8s operator).

**Recommendation**: Add a citation to §4.3 pointing to a reference implementation or prior art for the git-sync sidecar pattern.

---

## Section 8 (Open Questions) Assessment

### Are the right questions asked?

Partially. The six questions in §8 cover the key architectural decisions correctly: scope defaults, git-tracking, repo structure, identity persistence, cloud backup, and promotion workflow. These are real human decisions that the spec correctly defers.

### Critical questions that are MISSING

1. **Memory file conflict resolution**: What happens when two agent sessions write to the same MEMORY.md? The spec describes this as "normal operation" but gives no conflict strategy. This should be an explicit open question.

2. **MEMORY.md content governance**: Who decides what goes into a MEMORY.md? Can any agent write anything? What prevents agents from writing harmful or misleading "learnings"? The spec has the `local` scope as an escape hatch for sensitive info, but no guardrails on content quality.

3. **Retention and pruning**: Memory will grow indefinitely. The 200-line limit on MEMORY.md is noted, but what happens when an agent runs out of space? Do older entries get pruned? Who decides? This is a human decision.

4. **Read access between agents**: Can Agent A read Agent B's MEMORY.md? The spec says `project`-scoped files are visible to "all team members with repo access" — but does that include agents at runtime? Is there any privacy model between teammates?

### Are questions well-scoped and actionable?

Yes — each question in §8 lists clear options and assigns a decision owner ("Team lead", "Repo owner", "Architect", etc.). The format is good and matches the pattern established in comparable specs like agent-launcher §13. The table format is clear and scannable.

### Summary of §8

The section is well-structured but incomplete. The missing questions around conflict resolution and memory pruning are implementation-blocking — they cannot be deferred to implementation because the answers affect the architecture of Phase 1 and Phase 2 respectively.

---

## Summary

The agent-memory spec is well-researched and clearly structured. Tweety's use of the research basis citation and the three-backend architecture diagram are strong. The primary issues are: an internal contradiction in §2.3 vs §8 on the promotion workflow (usability-1), two unverified or underspecified claims (general-qa-1, general-qa-2), and the missing `memory:` frontmatter example that Phase 1 implementers will need. Pattern consistency with existing specs is weak — the frontmatter format diverges from every other spec in the repo, and the missing Non-Goals section is a notable gap. Section 8 is well-formatted but missing three implementation-blocking questions on conflict resolution, memory pruning, and inter-agent read access. Fix the P2 findings before merging; the P3/P4 findings can be addressed iteratively.

---

## References

- Diff reviewed: `/tmp/pr-agentteam-99.diff`
- Pattern comparison: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/specs/draft/agent-launcher.md`
- Pattern comparison: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/specs/draft/persona-system.md`
- PR: [agent-team#99](https://github.com/nsheaps/agent-team/pull/99)
