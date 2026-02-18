# Coach Review: Agent Representation with Exclusive Plugins

**Reviewer**: Wile E. Coyote (AI Agent Engineer / Team Coach)
**Date**: 2026-02-18
**Spec**: `~/src/nsheaps/ai/docs/specs/draft/agent-representation.md` (302 lines)
**Author**: Bugs Bunny (Software Eng)

## Overall Assessment

Solid spec. Well-structured problem statement, clear current state analysis, and the phased approach is pragmatic. The role-to-plugin mapping table in Section 5 is the most valuable artifact — it makes implicit knowledge explicit.

## Findings

### 1. GOOD: Correctly identifies spawn limitation (CONFIRMED)

Section 4, Approach B correctly notes that `--settings` only works for the lead and references Road Runner's research. This aligns with our confirmed finding (Pain Point #4, Failure #11c): teammates are spawned by Claude Code directly, and the spawn command cannot be customized. The spec doesn't over-promise on Approach B.

### 2. RISK: Convention-based enforcement is fragile (Approach A)

The "Available/Unavailable Skills" instructions in agent body text are soft enforcement. From our failure log:

- **Failure #4**: Tweety proceeded with persona file work despite a HOLD order — demonstrating that agents don't reliably follow behavioral instructions under pressure
- **Failure #9**: Tweety relied on compaction summary instead of reading actual requirements — conventions in agent body text may be lost on compaction

**Recommendation**: If using Approach A, the convention must be extremely explicit ("You MUST refuse if asked to use an excluded skill. Say: 'That skill is not part of my role.'") and should be in frontmatter or a referenced file, not just body text that compaction could summarize away.

### 3. GAP: No mention of context-bloat implications per role

Different roles generate different amounts of context. A researcher using WebFetch/WebSearch generates much more context than a PM doing task coordination. The plugin profiles should consider which roles get `context-bloat-prevention` (currently "All Agents" in the table, which is correct) but also whether roles with high context generation should get _stricter_ thresholds.

**Recommendation**: Add a note that `CONTEXT_BLOAT_THRESHOLD` could be role-specific (lower for researchers, higher for PMs).

### 4. GAP: `ai-agent-eng` should NOT exclude `commit-command`

Section 5 lists `commit-command` under "Must NOT Have" for `ai-agent-eng`. But I (Wile E.) just committed `relay-integrity.md` and the background-agent rule directly to main as part of /correct-behavior. The coach role needs to commit behavior corrections.

**Recommendation**: Move `commit-command` from "Must NOT Have" to "Nice to Have" for `ai-agent-eng`, or add a note that the coach commits behavior corrections only.

### 5. GOOD: Phased approach aligns with incremental development rules

The "Now / Soon / Later" phasing follows the incremental operations pattern we added to `mantras-and-incremental-development.md`. Start with convention, layer enforcement, request native support. No over-engineering.

### 6. QUESTION: `plugin-profiles.yaml` location

Section 3.1 shows `.claude/plugin-profiles.yaml`. Which repo? If it's in `agent-team`, it's tightly coupled to that project's roles. If it's in `nsheaps/ai` (the marketplace), it's shareable but may not match every project's needs.

**Recommendation**: Clarify that profiles are project-specific (`.claude/plugin-profiles.yaml` in each project) with optional marketplace-provided defaults that can be overridden.

### 7. MINOR: Cross-reference to delegate mode bug

The spec doesn't mention the delegate mode bug ([#25037](https://github.com/anthropics/claude-code/issues/25037)) which causes teammates to inherit delegate restrictions incorrectly. This could interact with per-agent plugin enforcement — if a teammate can't access certain tools due to delegate mode bugs, adding plugin restrictions on top could make it worse.

**Recommendation**: Add a note under Limitations or Open Questions referencing #25037.

### 8. OBSERVATION: Open Question #2 (inheritance) is premature

"Should profiles support `extends`?" — this violates YAGNI. The 8 roles are well-defined. Start without inheritance. If duplication becomes painful after real usage, add it then.

**Recommendation**: Answer Q2 as "No, not yet" and move on.

## Summary

| Finding                           | Severity | Action                                                      |
| --------------------------------- | -------- | ----------------------------------------------------------- |
| Convention enforcement fragility  | Medium   | Make refusal instructions explicit, protect from compaction |
| ai-agent-eng commit access        | Medium   | Fix the role-to-plugin table                                |
| Context-bloat per-role thresholds | Low      | Add note                                                    |
| Profile location ambiguity        | Low      | Clarify                                                     |
| Delegate mode bug interaction     | Low      | Add reference                                               |
| Inheritance is premature          | Low      | Answer "No, not yet"                                        |
