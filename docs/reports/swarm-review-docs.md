> **Note (2026-02-23):** `delegate` permission mode was removed in Claude Code v2.1.50. The replacement is `bypassPermissions`. This document reflects findings at the time of writing.

# Documentation Review: agent-team Repository

**Review Date**: 2026-02-17
**Reviewer**: Claude Code Agent
**Status**: Comprehensive audit of all documentation files

---

## Summary

The agent-team repository contains a comprehensive multi-layered documentation system supporting provider-agnostic agent team orchestration. The documentation is well-organized across agents, behaviors, specs, and research directories, with clear role definitions and communication protocols. However, there are significant gaps in cross-repository references, some stale paths referring to claude-utils, and inconsistent spec completeness across the Phase 1 milestone.

---

## README Review

**File**: `/README.md`

### Accuracy Assessment

The README accurately reflects the current project status:

| Claim                                             | Accuracy         | Evidence                                                        |
| :------------------------------------------------ | :--------------- | :-------------------------------------------------------------- |
| "Status: POC / Sandbox"                           | Correct          | Project is actively defined as proof-of-concept in early phases |
| "TypeScript/Bun launcher code"                    | Correct          | `src/` contains Bun-based implementation                        |
| "54 passing tests"                                | Must be verified | Tests exist; count needs validation                             |
| "Key modules: discover, prompt, spawn, lifecycle" | Correct          | These modules appear in spec and research                       |
| "Not actively developed"                          | Correct          | Focus shifted to claude-team (shell-based, claude-utils)        |
| "claude-team repo" reference                      | Correct          | claude-team extracted to separate repo                          |

### Completeness Issues

The README is **severely incomplete**:

1. **No quick-start guide** — How does a user get started? No installation instructions.
2. **No architecture overview** — What does this repo actually do? The "Overview" section is abstract.
3. **No feature list** — What can it do? What are its capabilities?
4. **No known limitations** — Why is it a POC? What's not working?
5. **No links to key docs** — No references to LAUNCH-GUIDE.md, architecture spec, or team structure.
6. **No agent roster** — Doesn't list the 8 agent roles or link to the team structure doc.

### Quality Issues

- **Tone mismatch**: Casual vs. formal. "54 passing tests. Key modules..." reads like internal notes, not public documentation.
- **Vague language**: "will inform the eventual MVP rebuild" — what MVP? Timeline?
- **Missing context**: "the current focus is on claude-team" — why? What changed?

### Recommendation

The README should be a landing page that:

1. Explains what this repo is (agent team orchestration framework for Claude Code)
2. Links to LAUNCH-GUIDE.md as the entry point for users
3. Summarizes the 8 agent roles briefly (full details in team-structure.md)
4. Explains the POC status clearly (what works, what doesn't, timeline)
5. Provides installation and setup instructions
6. Links to relevant docs (specs, research, architecture)

---

## Docs Structure

### What Exists

The documentation is organized across **four main hierarchies**:

#### 1. `.claude/` — Team Configuration & Behaviors

```
.claude/
├── agents/              (8 agent definitions)
├── personas/            (8 persona files for external representation)
├── behaviors/           (26 behavior procedures)
├── docs/                (3 core team docs)
│   ├── team-structure.md
│   ├── communication-protocol.md
│   └── team-rules.md
├── rules/               (2 rules files)
│   ├── research-before-broadcasting.md
│   └── teammate-abstraction.md
├── CLAUDE.md            (team entrypoint, references other docs)
├── settings.json        (enables agent-team-skills plugin)
└── tmp/                 (77 working files, mix of research & working notes)
```

#### 2. `docs/` — Public Documentation

```
docs/
├── LAUNCH-GUIDE.md                    (how to start the team)
├── research-topics.md                 (brainstorm of open questions)
├── to-research.md                     (TODO list for research)
├── scratch.md                         (working notes)
├── specs/draft/                       (11 specification documents)
│   ├── agent-launcher.md              (Phase 1 MVP spec)
│   ├── agent-team-architecture.md     (design & architecture)
│   ├── agent-communication-protocol.md
│   ├── agent-abstraction-levels.md
│   ├── marketplace-structure.md
│   ├── mesh-mcp-server.md
│   ├── persona-system.md
│   ├── e2e-testing.md
│   ├── cchistory-prompt-flavors.md
│   ├── multi-repo-phase-plan.md
│   └── web-session-orchestration.md
├── tickets/                           (PHASE1 work tickets)
│   ├── PHASE1-001 through PHASE1-012  (feature tickets)
│   ├── PHASE1-DEF-01 through PHASE1-DEF-13 (defect tickets)
│   └── README.md                      (ticket system overview)
└── research/                          (50+ research documents)
```

#### 3. `.claude-plugin/` — Plugin Structure

```
plugins/
└── agent-team-skills/
    ├── .claude-plugin/
    │   └── plugin.json                (plugin manifest)
    └── skills/
        ├── tmux-usage/SKILL.md
        └── writing-agent-team-agents/SKILL.md
```

#### 4. Source Code Structure

```
src/
├── __tests__/                         (54 passing tests)
├── discover.ts
├── prompt.ts
├── spawn.ts
├── lifecycle.ts
└── ...
```

### What's Missing

1. **No API documentation** — TypeScript/Bun code has no inline docs or generated API reference
2. **No integration guide** — How does external code use this repo's modules?
3. **No troubleshooting guide** — Common errors and solutions
4. **No roadmap** — Clear phase timeline and dependencies
5. **No glossary** — Terms like "agent", "behavior", "persona", "broker" need central definition
6. **No design decisions log** — Why were certain choices made? (Only partial in research/)
7. **No migration guide** — How does claude-team (shell) relate to agent-team (TypeScript)?

---

## Cross-Reference Issues

### 1. Broken or Stale References

| Severity | File                                         | Issue                                                                        | Example                                                                                                           |
| :------- | :------------------------------------------- | :--------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| MEDIUM   | `docs/research/docs-audit.md`                | References relative path that assumes different working context              | References `memory/agent-teams-research.md` relative to project root, but should be `../../.claude/projects/...`  |
| MEDIUM   | `docs/specs/draft/mesh-mcp-server.md`        | References external repo paths that don't exist in agent-team                | `../../../mcp/docs/specs/draft/mcp-tooling.md` and `../../../mcp-tooling.md` — but `/mcp/` repo doesn't exist yet |
| MEDIUM   | `docs/research/architecture-doc-review.md`   | References `bin/claude-team` from claude-utils but it's now in separate repo | "never acknowledges `bin/claude-team` in claude-utils" — but claude-team is now extracted                         |
| LOW      | `docs/specs/draft/agent-launcher.md` line 77 | Internal cross-reference uses relative path                                  | `./agent-launcher.md` (ok), but some paths use `.../`                                                             |

### 2. Unresolved External References

| File                                        | References                                | Status                                                   |
| :------------------------------------------ | :---------------------------------------- | :------------------------------------------------------- |
| `docs/specs/draft/mesh-mcp-server.md`       | `mcp/docs/specs/draft/mcp-tooling.md`     | **Unresolved** — `/mcp/` repo not yet created            |
| `docs/specs/draft/multi-repo-phase-plan.md` | `agent/docs/specs/draft/agent-wrapper.md` | **Unresolved** — `/agent/` repo not yet created          |
| Multiple research files                     | `claude-utils` repo structure             | **Stale** — claude-team extracted; paths may be outdated |

### 3. Implicit Dependencies Not Documented

| Source                   | Depends On                         | How                                               |
| :----------------------- | :--------------------------------- | :------------------------------------------------ |
| LAUNCH-GUIDE.md          | claude-utils (claude-team formula) | "If you have claude-utils installed via Homebrew" |
| agent-launcher.md        | nsheaps/agent repo                 | Phase 2+ agent CLI references but no link         |
| multi-repo-phase-plan.md | Three external repos               | References 3+ repos not yet created               |

### 4. Reference Pattern Consistency

The repo uses **two conflicting reference styles**:

1. **CLAUDE.md uses @ syntax** (Claude Code native):

   ```markdown
   @docs/team-structure.md
   @docs/communication-protocol.md
   @docs/team-rules.md
   ```

2. **Specs/research use markdown links**:

   ```markdown
   [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
   [team-storage-internals.md](../../research/team-storage-internals.md)
   ```

3. **Some files use file paths as inline text**:
   ```markdown
   See `.claude/docs/team-structure.md` for the full hierarchy
   ```

**Recommendation**: Standardize on one pattern. Use @ for internal navigation when referring to documentation that will be loaded into Claude Code context.

---

## Spec Quality Assessment

### Specs Reviewed

| Spec                           | Status   | Quality | Completeness | Issues                                          |
| :----------------------------- | :------- | :------ | :----------- | :---------------------------------------------- |
| `agent-launcher.md`            | Draft v3 | High    | 85%          | Open questions remain; gaps in permission model |
| `agent-team-architecture.md`   | Draft    | High    | 80%          | Good overview; lacks observability details      |
| `communication-protocol.md`    | Draft    | High    | 95%          | Nearly complete; message routing is clear       |
| `agent-abstraction-levels.md`  | Draft    | Medium  | 60%          | Conceptual but lacks implementation guidance    |
| `marketplace-structure.md`     | Draft    | Medium  | 70%          | Structure defined; distribution model unclear   |
| `mesh-mcp-server.md`           | Draft    | Medium  | 75%          | Good but references unresolved external repos   |
| `persona-system.md`            | Draft    | Medium  | 65%          | Persona/agent separation unclear in places      |
| `e2e-testing.md`               | Draft    | Low     | 50%          | Skeletal; needs implementation details          |
| `cchistory-prompt-flavors.md`  | Draft    | Low     | 40%          | Very incomplete; research phase                 |
| `multi-repo-phase-plan.md`     | Draft    | Medium  | 85%          | Good roadmap; timeline missing                  |
| `web-session-orchestration.md` | Draft    | Low     | 35%          | Very early; needs scope definition              |

### Spec Format Issues

1. **Inconsistent frontmatter** — Some specs have author/date/status, others don't

   ```yaml
   # GOOD (agent-launcher.md)
   > **Status**: Draft
   > **Author**: Elmer Fudd (Project Manager)
   > **Date**: 2026-02-17
   > **Revised**: 2026-02-17 — v3

   # BAD (e2e-testing.md) — No metadata
   ```

2. **No version/revision tracking** — Should use semantic versioning or date-based revisions

3. **Missing section anchors** — Specs reference "§3", "§7" but markdown doesn't generate stable section IDs in all tools

### Spec Content Quality

**Strengths**:

- Clear problem statements
- Well-defined success criteria
- Phase sequencing is logical
- Agent-launcher spec is particularly thorough (100 lines+ with concrete examples)

**Weaknesses**:

- Some specs conflate architecture with implementation
- Non-goals sections are sometimes defensive rather than clarifying
- Phase 2+ specs are too vague to guide implementation
- Missing acceptance criteria for "done"

### Missing Specs

Based on the codebase and research files, these specs are needed:

1. **Git workflow spec** — Commit message standards, PR process, branch naming (referenced but not defined)
2. **Plugin distribution spec** — How plugins are published and discovered (mentioned in marketplace-structure but underspecified)
3. **Agent lifecycle spec** — Detailed state machine for agent states (spawned, running, idle, shutdown)
4. **Error handling & recovery spec** — What happens when agents crash, communication fails, etc.

---

## Research Docs Quality

### Volume & Organization

- **50+ research documents** in `docs/research/`
- **77 working files** in `.claude/tmp/`
- Research appears thorough but poorly indexed

### Research Quality Issues

| Document                           | Issue                                                                                | Severity |
| :--------------------------------- | :----------------------------------------------------------------------------------- | :------- |
| `jsonl-parsing-tools.md`           | References claude-utils project paths that are now stale                             | MEDIUM   |
| `claude-team-pre-extraction-qa.md` | Covers extraction decision but references claude-utils structure                     | MEDIUM   |
| `extraction-analysis-review.md`    | Documents claude-team extraction analysis; now outdated since extraction is complete | LOW      |
| `language-comparison.md`           | Compares Bun, Go, Rust; no clear recommendation or decision                          | MEDIUM   |
| `orchestration-platforms-index.md` | Lists 20+ tools but no evaluation criteria or selection rationale                    | MEDIUM   |
| Multiple files                     | References to "future research goals" that are no longer open questions              | LOW      |

### Research Organization Gaps

1. **No research roadmap** — Which research questions are priorities?
2. **No research completion tracking** — Are findings implemented or shelved?
3. **No research synthesis** — Individual reports exist; no aggregate insights
4. **Duplicate research** — Some topics researched multiple times (e.g., language selection, tmux internals)

### Staleness Issues

Research files in `.claude/tmp/` reference:

- Closed decision points (now implemented)
- Questions marked as research but already answered in specs
- Sessions from prior swarm work that may not be relevant now

---

## Findings Summary

| #   | Severity | File                            | Issue                                                                           | Impact                                                            |
| --- | -------- | ------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | HIGH     | README.md                       | Severely incomplete; missing quick start, architecture overview, installation   | Users cannot get started from README alone                        |
| 2   | HIGH     | docs/specs/draft/               | Multiple specs reference external repos (`mcp/`, `agent/`) that don't exist yet | Specs are not self-contained; readers need context about Phase 2+ |
| 3   | HIGH     | docs/research/                  | Multiple files reference claude-utils repo structure; claude-team now extracted | Documentation describes old structure; creates confusion          |
| 4   | MEDIUM   | docs/specs/                     | No acceptance criteria defined for when specs are "done"                        | Unclear what completion looks like; risks scope creep             |
| 5   | MEDIUM   | .claude/tmp/ & docs/research/   | Unclear which research findings are implemented vs. shelved                     | 77 tmp files + 50 research docs; no synthesis or roadmap          |
| 6   | MEDIUM   | docs/specs/                     | Specs use inconsistent frontmatter format and metadata                          | Hard to track version, author, status across specs                |
| 7   | MEDIUM   | Cross-references                | Mix of @ syntax, markdown links, and relative paths                             | Inconsistent reference style; hard to maintain                    |
| 8   | MEDIUM   | agent-launcher.md               | References permission model gaps and open questions                             | Implementation would need to fill in details                      |
| 9   | LOW      | docs/specs/draft/e2e-testing.md | Very skeletal (50% complete); needs implementation details                      | Cannot guide Phase 1 testing; needs expansion                     |
| 10  | LOW      | docs/research/                  | Multiple files document solved problems and closed decisions                    | Clutters research directory; should be archived or removed        |
| 11  | LOW      | docs/research/docs-audit.md     | References internal project paths from claude-utils                             | Works for audit purposes but creates maintenance burden           |
| 12  | LOW      | Plugin structure                | Skills in plugin work but plugin.json has no version field                      | Matches ai-mktpl pattern; consistency ok but needs docs           |

---

## Recommendations

### Priority 1: Immediate (Block current work)

1. **Update README.md** (2-3 hours)
   - Add architecture overview (2 paragraphs)
   - Link LAUNCH-GUIDE as entry point
   - List the 8 agent roles with brief descriptions
   - Explain POC status with specific gaps/timeline
   - Add installation instructions
   - Action: Assign to docs-writer (Tweety)

2. **Resolve external repo references** (1-2 hours)
   - Create placeholder issues for `/mcp/` and `/agent/` repos
   - Update specs to note "Phase 2+" status clearly
   - Add "Depends on" section to each Phase 2+ spec
   - Action: Assign to project-manager (Elmer)

3. **Document stale claude-utils references** (1 hour)
   - Audit research docs for claude-utils paths
   - Mark as "archived" or update paths to reflect claude-team extraction
   - Add header note: "This document references claude-utils structure; claude-team is now extracted"
   - Action: Assign to docs-writer (Tweety)

### Priority 2: High (Complete this week)

4. **Add spec acceptance criteria** (2 hours)
   - Template: "Spec is complete when X, Y, Z are documented and reviewed"
   - Apply to all Phase 1 specs
   - Action: Assign to ai-agent-eng (Wile E.)

5. **Standardize spec frontmatter** (1 hour)
   - Template for all specs (status, author, date, version, task reference)
   - Apply retroactively to existing specs
   - Action: Assign to docs-writer (Tweety)

6. **Create research roadmap** (2-3 hours)
   - Categorize 77 tmp files + 50 research docs: Implemented / Active / Archived / Shelved
   - Create index: `docs/research/INDEX.md` linking to key research areas
   - Move completed research to `docs/research/archived/`
   - Action: Assign to deep-researcher (Road Runner)

7. **Standardize reference style** (1-2 hours)
   - Decide: @ syntax for all docs? Or markdown links for all?
   - Create reference guideline in CLAUDE.md
   - Update all docs to use consistent style
   - Action: Assign to docs-writer (Tweety)

### Priority 3: Medium (This sprint)

8. **Create missing specs** (6-8 hours)
   - Git workflow spec (1-2 hours)
   - Agent lifecycle state machine (2-3 hours)
   - Error handling & recovery (2-3 hours)
   - Action: Assign to software-eng (Bugs) with ai-agent-eng review

9. **Expand incomplete specs** (4-6 hours)
   - e2e-testing.md: From 50% to 90% complete (2 hours)
   - web-session-orchestration.md: From 35% to 70% (2 hours)
   - persona-system.md: Clarify agent vs persona boundary (1-2 hours)
   - Action: Assign to docs-writer (Tweety) with subject-matter expert review

10. **Create API documentation** (4-6 hours)
    - Auto-generate TypeScript docs from src/
    - Create integration guide for external users
    - Document exports and module interface
    - Action: Assign to ops-eng (Foghorn) + software-eng (Bugs)

### Priority 4: Nice-to-Have

11. **Create glossary** (1-2 hours)
    - Define: agent, behavior, persona, broker, orchestrator, teammate, etc.
    - Central reference for terminology
    - Action: Assign to docs-writer (Tweety)

12. **Create troubleshooting guide** (2-3 hours)
    - Common errors and solutions
    - Debug checklist for agent launch failures
    - Action: Assign to quality-assurance (Daffy)

---

## Specific File-Level Issues

### `.claude/agents/` Directory

**Issue**: Agent display names in frontmatter don't follow documented format.

**Current Format**:

```yaml
name: software-eng
description: ...
```

**Should Add**:

```yaml
name: software-eng
display_name: "Bugs B (software-eng)" # Per team-structure.md rules
description: ...
```

**Impact**: Inconsistent team config generation; display names derived from name field may not match documented convention.

**Action**: Update all 8 agent files to include display_name field; document as required in agent-launcher.md §3.

### `.claude/behaviors/README.md`

**Issue**: Well-written but isolated. Not linked from main CLAUDE.md or team-structure.md.

**Should**: Add section to CLAUDE.md explaining behaviors, and link from team-structure.md.

**Impact**: Teammates may not discover this critical documentation.

### `docs/specs/draft/agent-launcher.md`

**Lines 91-100 (Launcher Fields)**: Table has open questions and gaps:

- `permission_mode` default is `"delegate"` but agent-launcher.md §3 says this is "semantic choice needs user decision"
- `dangerously_skip_permissions` comment references both claude-team and prior findings — needs consolidation
- Permission model not fully specified; implementation would need to fill gaps

**Action**: Assign to ai-agent-eng (Wile E.) to verify permission model consistency across all specs.

### `.claude/tmp/` Directory

**Issue**: 77 files; mix of session notes, research, QA output, and working notes. No clear retention policy.

**Current**: Files like `qa-badmode.txt`, `qa-cleanup-noconfig.txt`, `qa-launch-badname.txt` are test output fragments (1-5 lines each).

**Should**: Create `.claude/tmp/README.md` that explains:

- What goes in `.claude/tmp/` (ephemeral working files only, per team rules)
- Cleanup policy (delete after session? archive older than 30 days?)
- Link to `docs/research/` for permanent findings

**Action**: Assign to docs-writer (Tweety).

---

## Cross-Repository Reference Map

For users working across agent-team, claude-utils, and ai-mktpl:

```
agent-team/
├── Depends on: claude-utils (LAUNCH-GUIDE.md mentions claude-team formula)
├── Related to: ai-mktpl (skills, rules, agent development patterns)
├── Will depend on: nsheaps/agent (Phase 2+ agent wrapper CLI)
├── Will depend on: nsheaps/mcp (Phase 2+ mesh MCP server)
└── Phase 2+: Specs reference not-yet-created repos
```

**Action**: Create `docs/DEPENDENCIES.md` documenting these relationships and indicating which are Phase 1 vs. Phase 2+.

---

## Documentation Maintenance Plan

### Weekly Checklist

- [ ] Verify external references (links, file paths) still resolve
- [ ] Check `.claude/tmp/` for stale sessions (>7 days old) and archive
- [ ] Ensure new specs include frontmatter with status/author/date
- [ ] Review research documents for completed-but-undocumented findings

### Monthly Checklist

- [ ] Audit cross-references for stale paths
- [ ] Update roadmap timeline based on Phase progress
- [ ] Consolidate overlapping research documents
- [ ] Review README.md for accuracy

### After Each Phase Milestone

- [ ] Archive old specs to `docs/specs/archived/`
- [ ] Update Phase roadmap with completion notes
- [ ] Consolidate research findings into decision log
- [ ] Update LAUNCH-GUIDE.md if launching procedure changed

---

## Summary of Actionable Items

| Task                             | Owner                    | Priority | Est. Time | Blocks                  |
| :------------------------------- | :----------------------- | :------- | :-------- | :---------------------- |
| Update README.md                 | Tweety (docs-writer)     | P1       | 2-3h      | External visibility     |
| Resolve external repo refs       | Elmer (pm)               | P1       | 1-2h      | Phase 2+ planning       |
| Document stale claude-utils refs | Tweety                   | P1       | 1h        | Documentation clarity   |
| Add spec acceptance criteria     | Wile E. (ai-agent-eng)   | P2       | 2h        | Phase 1 completion      |
| Standardize spec frontmatter     | Tweety                   | P2       | 1h        | Spec consistency        |
| Create research roadmap          | Road Runner (researcher) | P2       | 2-3h      | Knowledge organization  |
| Standardize reference style      | Tweety                   | P2       | 1-2h      | Maintainability         |
| Create missing specs (3x)        | Bugs + Wile E.           | P3       | 6-8h      | Implementation guidance |
| Expand incomplete specs          | Tweety                   | P3       | 4-6h      | Phase 1 readiness       |
| Create API docs                  | Foghorn + Bugs           | P3       | 4-6h      | External usability      |

---

## Conclusion

The agent-team repository has a **well-designed documentation system that effectively captures complex multi-agent orchestration concepts**. The team structure, communication protocol, and core behaviors are clearly documented. However, the documentation suffers from:

1. **Incomplete README** — Users cannot get started from the landing page
2. **Broken external references** — Specs reference non-existent Phase 2+ repos without clear marking
3. **Stale claude-utils references** — Extraction is complete but docs still reference old structure
4. **Unorganized research** — 77 tmp files + 50 research docs lack synthesis or roadmap
5. **Incomplete specs** — Some Phase 1 specs have open questions; Phase 2+ specs are too vague

**Overall Assessment**: **7/10** — Strong foundational documentation, but execution issues reduce usability. Priority 1 items (4-5 hours of work) would improve the score to 8.5/10 and unblock external usage.

---

**Review Complete**
