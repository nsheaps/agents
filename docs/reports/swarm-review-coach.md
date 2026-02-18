# Swarm Review: Coach Perspective (Wile E. Coyote)

**Repo**: nsheaps/agent-team @ main
**Date**: 2026-02-17
**Focus**: Process gaps, behavioral patterns, rule quality, improvement opportunities

---

## Overall Assessment

The `.claude/` directory is the strongest part of this repo. The behaviors, docs, and agent definitions are battle-tested — they came from real failures recorded during live sessions. The behaviors are well-structured, evidence-based, and consistently formatted. The TypeScript POC code is secondary (and acknowledged as such in README).

**Verdict**: The process documentation is mature relative to the codebase. The main risks are structural inconsistencies and a few process gaps.

---

## Findings

### CRITICAL

#### C1: AI Agent Eng "Monitoring" Role Is Architecturally Impossible

**Location**: `.claude/agents/ai-agent-eng.md` (responsibilities section), standing task #13 ("Monitor team — watch for process failures")

The agent definition says the AI Agent Eng "observes team interactions for process failures and coordination issues" and is "present for the entire session, watching for process failures." This is architecturally impossible — **only the team lead sees all teammate messages**. Individual teammates (including the AI Agent Eng) only see messages sent directly to them.

**What actually happens**: The team lead flags issues to the AI Agent Eng, who then analyzes, records, and drives corrections. The AI Agent Eng is a **corrector/recorder**, not an **observer/monitor**.

**Impact**: The agent definition sets an expectation the agent cannot fulfill. When the AI Agent Eng is spawned, its instructions claim it should "proactively check task status and teammate messages for signs of trouble" — but it literally cannot see those messages unless they're forwarded.

**What needs to change**:
1. `ai-agent-eng.md` responsibilities: Change "Observe team interactions" → "Analyze flagged issues from team lead"
2. `ai-agent-eng.md` edge case: "Nobody messages you about failures: Proactively check..." → This is the wrong advice. Should say "If no issues are flagged, check in with team lead periodically"
3. Standing task descriptions: "Monitor team" → "Analyze and correct flagged issues"
4. `team-rules.md:35`: "The AI Agent Eng records failures for pattern analysis" is correct, but the mechanism (flagged by others, not self-observed) should be explicit

### HIGH

#### H1: Rules vs Behaviors — Unclear Boundary

**Location**: `.claude/rules/` (2 files) vs `.claude/behaviors/` (13 files)

The `behaviors/README.md` clearly defines what a behavior is ("complex, multi-step procedure combining tools, skills, and general practices"). But the two newly-copied rules in `.claude/rules/` (`teammate-abstraction.md`, `research-before-broadcasting.md`) overlap in style with behaviors.

- `teammate-abstraction.md` reads like a behavior (has "Applies To", "The Principle", "What NOT to Expose" — procedural guidance)
- `research-before-broadcasting.md` has a "Required Pattern", "Self-Check", and "Anti-Pattern" — the exact same structure as behaviors

**Question**: What distinguishes a rule from a behavior in this repo? The ai-mktpl repo uses `.ai/rules/` for short behavioral directives. This repo uses `.claude/behaviors/` for the same purpose. Having both directories without a clear boundary will cause future confusion about where new content goes.

**Recommendation**: Document the distinction in `.claude/rules/README.md` or in the behaviors README. Suggested criteria:
- **Rules** = short declarative constraints ("always do X", "never do Y") — loaded on every API call
- **Behaviors** = multi-step procedures with steps, anti-patterns, and quality standards

#### H2: `verify-before-blaming.md` Exists in Both Behaviors and ai-mktpl Rules

**Location**: `.claude/behaviors/verify-before-blaming.md` AND `ai-mktpl/.ai/rules/verify-before-blaming.md`

Same concept, different homes. The behavior version (71 lines) is more detailed than the ai-mktpl rule version. This creates a maintenance risk — which one is authoritative? If someone updates one, the other drifts.

**Recommendation**: Decide which is authoritative. If the behavior is the detailed version and the rule is the summary, cross-reference them. If they're supposed to be identical, that violates DRY.

#### H3: Stale Reference in AI Agent Eng Agent File

**Location**: `.claude/agents/ai-agent-eng.md:98`

```
Track changes in [nsheaps/.ai](https://github.com/nsheaps/ai)
```

This still references `nsheaps/.ai` and links to `nsheaps/ai`. Both have been renamed to `nsheaps/ai-mktpl`. The text also says "nsheaps/.ai Repository Tracking" as a section header.

**Impact**: Confusing for new sessions — agent will try to find a repo that doesn't exist at that URL.

### MEDIUM

#### M1: Plugin Has `version` Field Despite ai-mktpl Removing Them

**Location**: `plugins/agent-team-skills/.claude-plugin/plugin.json:3`

```json
"version": "0.1.0"
```

Task #165/#169 just removed version fields from all skills in ai-mktpl because they were causing issues. This plugin still has one.

#### M2: No `.claude/rules/README.md`

The `behaviors/` directory has a README explaining what behaviors are. The `rules/` directory has no README. Since rules are a new addition to this repo (just added tonight), there's no documentation explaining what goes there vs behaviors.

#### M3: Behaviors Don't Reference Each Other Consistently

Some behaviors reference related behaviors (e.g., `self-correction.md` says "Message the AI Agent Eng (per failure-reporting behavior)"), but this cross-referencing is inconsistent. Several behaviors that logically chain together don't mention each other:

- `pre-task-checklist.md` should reference `verification.md` (they're the before/after pair)
- `code-review.md` should reference `commit-hygiene.md` (review then commit)
- `communication-verification.md` should reference `failure-reporting.md` (report if message fails)

#### M4: Team-Member-Cleanup Behavior Contradicts Lifecycle-Management Behavior

**Location**: `team-member-cleanup.md:56-66` (Option B) vs `lifecycle-management.md:87-89`

- `lifecycle-management.md` says: "**Never manually edit** `config.json`"
- `team-member-cleanup.md` Option B provides a detailed `jq` command to... manually edit config.json

Both are valid for their contexts (lifecycle says "don't", cleanup says "when you absolutely must"), but the contradiction should be explicitly acknowledged in the cleanup doc.

#### M5: `.claude/tmp/` Contains 40+ Files — No Cleanup Convention

`.claude/tmp/` has accumulated research reports, QA outputs, failure logs, and test artifacts. There's no convention for when these should be cleaned up, archived, or moved to `docs/research/`. Some have already been moved (`docs/research/` has copies), but the originals remain.

### LOW

#### L1: Orchestrator Agent File References `claude-utils` Repo

**Location**: `.claude/agents/orchestrator.md:141-147,163`

References `claude-team` / `ct` helper scripts from claude-utils. If agent-team is meant to be standalone, this creates a dependency that should be documented or abstracted.

#### L2: README License Mismatch

**Location**: `README.md:37` says "Proprietary. All rights reserved." but `LICENSE` file says MIT.

#### L3: No Behavior for "Scope Creep Prevention"

Multiple failures from this session involved scope expansion without approval. The `incremental-design.md` behavior partially covers this, but a dedicated "scope management" behavior (or a section in team-rules.md) would formalize what's currently only implied.

---

## Improvement Opportunities

### IO1: Behavior Index

Create a behavior index (in behaviors/README.md or a separate index) that maps common situations to which behavior to use. Currently you have to read all 13 behavior files to know which applies when. A quick-reference table would help:

```
| Situation                  | Behavior                      |
|----------------------------|-------------------------------|
| Starting a new task        | pre-task-checklist            |
| Something went wrong       | self-correction               |
| Reporting a failure        | failure-reporting             |
| Reviewing my own work      | code-review + verification    |
| Sending a message          | communication-verification    |
| Writing a new spec/doc     | incremental-design            |
| ...                        | ...                           |
```

### IO2: Behavior Chaining

Formalize the common chains: `pre-task-checklist → [work] → code-review → verification → commit-hygiene → communication-verification`. This is the "happy path" that every task should follow. Currently it's implied but not documented.

### IO3: Rules as a First-Class Concept

Now that `.claude/rules/` exists, define it as a first-class concept alongside behaviors. Rules are loaded on every API call (per Claude Code conventions). Behaviors are loaded on demand. This distinction matters for token budget — rules should be kept very short.

---

## Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| Critical | 1 | AI Agent Eng "monitoring" role is architecturally impossible — corrector/recorder, not observer |
| High | 3 | Rules/behaviors boundary, verify-before-blaming duplication, stale nsheaps/.ai reference |
| Medium | 5 | Plugin version field, no rules README, inconsistent cross-refs, cleanup contradiction, tmp accumulation |
| Low | 3 | claude-utils dependency, license mismatch, no scope creep behavior |
| Improvement | 3 | Behavior index, behavior chaining, rules as first-class |

The behavioral framework is the team's strongest asset. The main risk is organizational — as the repo grows, the distinction between rules, behaviors, skills, and agent instructions needs to stay clear. The stale reference (H3) should be fixed immediately as it affects agent behavior.
