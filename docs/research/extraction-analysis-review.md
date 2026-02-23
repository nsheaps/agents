> **Note (2026-02-23):** `delegate` permission mode was removed in Claude Code v2.1.50. The replacement is `bypassPermissions`. This document reflects findings at the time of writing.

# Extraction Analysis Review — Wile E. Coyote (AI Agent Eng)

**Date**: 2026-02-18
**Reviewing**: `.claude/tmp/claude-team-extraction-analysis.md` by Foghorn Leghorn
**Review criteria**: Boundary clarity, behavioral learning carryover, process/coaching risks

---

## 1. Are the Boundaries Clear?

**Grade: Good, with gaps.**

Foghorn's Option C recommendation is clean and well-reasoned. The dependency analysis is solid — identifying the ~100 lines of actual lib usage is exactly the right way to scope a minimal extraction. The migration steps are concrete and actionable.

### What's clear

- **claude-team repo**: `claude-team`, `ct`, slimmed `lib/` with formatting/install helpers. Independently installable via Homebrew.
- **claude-utils repo**: Everything else — `run-claude`, `cc-*` scripts, `claude-diagnostics`, `claude-update`, full `stdlib.sh` and `claude.lib.sh`.
- **Homebrew**: Separate formulas, no runtime dependency between them.

### What's NOT clear — boundary gaps

**Gap 1: Where does the agent-teams skill go?**

The `.claude/skills/agent-teams/SKILL.md` currently lives in claude-utils. It references `claude-team` and `ct` scripts. After extraction, this skill should move to the claude-team repo — it describes how to use the extracted tool. Foghorn's analysis doesn't mention skills at all.

**Gap 2: Where do agent definitions, behaviors, and team docs live?**

The agent-team repo (TypeScript/Bun) has a rich set of `.claude/agents/`, `.claude/behaviors/`, `.claude/docs/`, and `.claude/personas/`. These are tool-agnostic team process artifacts — they define how agents work together, not how the TypeScript launcher works. The extraction analysis doesn't address whether claude-team should carry its own set of these, reference agent-team's, or start fresh.

Recommendation: claude-team should have its own `.claude/` structure. The behavioral learnings from agent-team should be migrated as a migration step (see section 2).

**Gap 3: What about the `--continue` flag and other hardcoded behaviors?**

Foghorn correctly flags this as an open question (#5), but it needs resolution before extraction, not after. The current `claude-team` script has several hardcoded choices that should be evaluated:

- `--continue` (always resume last session)
- `--dangerously-skip-permissions` (always bypass)
- `--permission-mode delegate` (always delegate)
- The mode picker (gum-based interactive selection)

These are design decisions that should be documented, not just inherited silently.

**Gap 4: Future relationship between claude-team and agent-team**

The analysis covers claude-team vs claude-utils but doesn't address the three-way boundary: claude-team (shell scripts) vs agent-team (TypeScript/Bun POC) vs future agent-team (production tool). When agent-team eventually becomes the production tool, what happens to claude-team? Does it become a thin wrapper? Get deprecated? Coexist?

This doesn't need to be answered now, but it should be explicitly noted as a deferred decision.

---

## 2. Are Behavioral Learnings Captured?

**Grade: Not addressed.**

This is the biggest gap in the analysis. Foghorn focused (correctly) on the ops/engineering aspects — scripts, dependencies, Homebrew. But nothing in the analysis addresses carrying forward:

### Must carry forward

| Learning                        | Source                                                    | Why it matters                                                                                                   |
| :------------------------------ | :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| Lifecycle management procedures | Failure #11 + `.claude/behaviors/lifecycle-management.md` | The spawn/shutdown/cleanup anti-patterns are identical regardless of whether you use shell scripts or TypeScript |
| Task dedup pattern              | Failure #12                                               | Applies to any team session, not specific to the launcher                                                        |
| Compaction drift awareness      | Failures #9, #10                                          | Agents lose behavioral conventions after compaction — this is a Claude Code issue, not a tool issue              |
| Team communication protocol     | `.claude/docs/communication-protocol.md`                  | How teammates route messages, report failures, save to files                                                     |
| Team rules                      | `.claude/docs/team-rules.md`                              | Standing orders, chain of authority, verification behaviors                                                      |
| 17 behavior docs                | `.claude/behaviors/*.md`                                  | Research, commit hygiene, failure reporting, self-correction, etc.                                               |

### Recommended migration step (add to Foghorn's list)

**Step 0 (before step 1):** Copy the following from agent-team to claude-team:

- `.claude/docs/team-structure.md`, `team-rules.md`, `communication-protocol.md`
- `.claude/behaviors/` (all 18 files — they're tool-agnostic)
- `.claude/agents/` (agent definitions — role descriptions are tool-agnostic)
- `.claude/personas/` (if we want to keep the Looney Tunes identity)
- `.claude/skills/agent-teams/` (from claude-utils, adapted for the new repo)

This is not "copying code" — it's migrating institutional knowledge. Without it, the claude-team repo starts with zero process documentation and the team would have to re-learn everything.

---

## 3. Process/Coaching Risks Foghorn Might Miss

### Risk 1: User transition experience

Foghorn flags the Homebrew transition risk (users need `brew install claude-team` separately) and suggests a deprecation notice or transitional `depends_on`. Good. But the risk goes deeper:

- Users who `brew upgrade claude-utils` will suddenly lose `claude-team` and `ct` from their PATH
- The error will be "command not found" — no explanation, no guidance
- **Recommendation**: Before removing from claude-utils, add a shim script that prints: "claude-team has moved to its own package. Run: brew install claude-team"

### Risk 2: Two repos, one team

Right now the team operates in agent-team repo. After extraction, active work moves to claude-team repo. But the team docs, behaviors, and agent definitions live in agent-team. This creates a split-brain problem:

- Do we maintain behaviors in both repos?
- If a behavior is updated in one, does it auto-sync to the other?
- Which repo is the "source of truth" for team process?

**Recommendation**: Pick one repo as the canonical location for team process artifacts and reference it from the other. Since claude-team is becoming the active tool, it should own the process docs. Agent-team should reference them or mark its copies as archived.

### Risk 3: Release pipeline duplication

Foghorn correctly notes the release pipeline follows the same pattern (release-it + gomplate + auto-PR). But setting up a release pipeline is non-trivial and was itself a source of bugs in claude-utils (the Homebrew auto-publish issue that Foghorn already fixed).

**Recommendation**: Before duplicating the pipeline, document the working pipeline pattern as a reusable template. This prevents re-encountering the same bugs (duplicate PRs, auto-merge failures) in the new repo.

### Risk 4: Scope creep during extraction

The extraction should be a pure "move and slim down" operation. The risk is that during extraction, someone decides to also refactor the script, add features, fix the `--continue` hardcoding, etc. This turns a clean extraction into an unpredictable project.

**Recommendation**: Phase the work:

1. **Phase 1**: Pure extraction — move files, slim libs, set up Homebrew. claude-team in the new repo should work identically to claude-team in claude-utils.
2. **Phase 2**: Improvements — configurable flags, better error handling, settings backup decision, etc.

### Risk 5: The `claude_check_settings_backup` decision

Foghorn's open question #2 asks whether this function moves with claude-team. This is the settings.json backup hooks approach that the **user explicitly rejected** in the claude-utils project (noted in MEMORY.md: "Settings.json backup hooks approach was REJECTED by user — do not re-attempt").

**Recommendation**: Do NOT move `claude_check_settings_backup` to claude-team. It was rejected. If it's currently called in the claude-team script, remove the call during extraction. Flag this to the team lead for confirmation.

---

## Summary

| Criterion                     | Grade              | Key Finding                                                                                    |
| :---------------------------- | :----------------- | :--------------------------------------------------------------------------------------------- |
| Boundary clarity              | Good with gaps     | Skills, behaviors, agent defs, and future agent-team relationship not addressed                |
| Behavioral learning carryover | Not addressed      | 18 behavior docs, 3 team docs, failure log learnings need explicit migration step              |
| Process/coaching risks        | 5 additional risks | User transition, split-brain docs, pipeline duplication, scope creep, rejected settings backup |

**Overall**: Foghorn's analysis is a solid ops/engineering assessment. The technical extraction plan (Option C) is the right call. What it's missing is the process/knowledge dimension — the team has spent three sessions building institutional knowledge that needs to travel with the tool.

**Top 3 actions needed:**

1. Add "Step 0: Migrate team docs and behaviors" to the migration plan
2. Resolve the `claude_check_settings_backup` question (recommend: remove it)
3. Phase the extraction: pure move first, improvements second

---

## References

- Foghorn's analysis: `.claude/tmp/claude-team-extraction-analysis.md`
- Failure #11 (lifecycle): `.claude/tmp/ai-agent-eng-failure-log.md` (agent-team repo)
- Failure #12 (task dedup): same file
- Lifecycle management behavior: `.claude/behaviors/lifecycle-management.md` (agent-team repo)
- Settings backup rejection: MEMORY.md in claude-utils project memory
- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
