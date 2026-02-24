# Agent Template Review: TPM and Product PM

**Reviewer**: Daffy D (qa)
**Date**: 2026-02-24
**Commit**: ff09b1c
**Files**: `.claude/agents/technical-project-manager.md`, `.claude/agents/product-manager.md`

---

## Overall Score: 88/100 ✅

Both templates are well-structured, follow the established agent format, and carve out clear roles distinct from the existing project-manager.md. Two P2 findings and several P3s.

## Category Scores

| # | Category | Score | Status |
|---|----------|-------|--------|
| 1 | Simplicity | 90 | ✅ |
| 2 | Flexibility | 88 | ✅ |
| 3 | Usability | 88 | ✅ |
| 4 | Documentation | 90 | ✅ |
| 5 | Security | 92 | ✅ |
| 6 | Pattern Matching | 85 | ✅ |
| 7 | Best Practices | 88 | ✅ |
| 8 | General QA | 85 | ✅ |

---

## Findings

### P2 — Should address

#### [qa-1] Product PM missing TaskCreate/TaskUpdate/TaskList/TaskGet tools

**File**: `product-manager.md:39-49`
**Severity**: P2
**Description**: The product PM has `Write`, `Edit`, and `Task` but does NOT have `TaskCreate`, `TaskUpdate`, `TaskList`, or `TaskGet`. The TPM and existing project-manager both have these. A product PM who defines requirements and writes specs would naturally need to create and track tasks — at minimum to create follow-up items from spec reviews or to check what's already been tasked. Without these, the product PM cannot participate in the shared task list at all except through the `Task` (sub-agent spawning) tool.
**Expected**: Add `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet` to tools list.
**Actual**: Only `Task` and `SendMessage` for coordination.

#### [qa-2] Product PM color conflicts with existing project-manager

**File**: `product-manager.md:32`
**Severity**: P2
**Description**: Both `product-manager.md` and `project-manager.md` use `color: magenta`. When both are active on a team, their messages will be visually indistinguishable in the UI. Every other agent has a unique color.
**Expected**: Unique color for product-manager (e.g., `pink`, `yellow`, or another unused color).
**Actual**: `color: magenta` — same as project-manager.

---

### P3 — Should consider

#### [pattern-1] Product PM missing `disallowed_tools` block

**File**: `product-manager.md:39-49`
**Severity**: P3
**Description**: The TPM and project-manager both have explicit `disallowed_tools` blocks listing what they cannot use. The product PM has `Write` and `Edit` (appropriate for PRD authoring) but no `disallowed_tools` block. For consistency and clarity, it should explicitly disallow `Bash` — a product PM should not be running shell commands.
**Expected**: `disallowed_tools: [Bash]`
**Actual**: No disallowed_tools block.

#### [pattern-2] TPM missing SendMessage in tools list

**File**: `technical-project-manager.md:39-49`
**Severity**: P3
**Description**: Wait — re-checking... SendMessage IS listed at line 44. Confirmed present. ~~FALSE POSITIVE~~. Withdrawn.

#### [qa-3] Neither template references the github-issue-creator guidance

**File**: Both files
**Severity**: P3
**Description**: Per the new team rule #11 ("Use the github-issue-creator Agent for All GitHub Issues"), all agents should be aware of this. The existing project-manager.md has issue-filing guidance in its "Filing Issues" section. Neither new template mentions issue filing. The TPM may need to file ADR-related issues; the product PM may need to file feature requests or spec follow-ups.
**Expected**: Brief mention of github-issue-creator for filing issues, consistent with project-manager.md pattern.
**Actual**: No mention in either template.

#### [pattern-3] Spec reference format inconsistency in product-manager

**File**: `product-manager.md:83`
**Severity**: P3
**Description**: The process section says "Writing a PRD / Spec" — but the project conventions use the term "spec" exclusively (per `mantras-and-incremental-development.md`: "use the unified term 'spec' for all specification documents"). The product-manager role uses "PRD" throughout, which could create terminology confusion with the rest of the team.
**Expected**: Use "spec" as the primary term, with "PRD" as parenthetical if needed: "Writing a Spec (PRD)"
**Actual**: "PRD" used as primary term in multiple places.

---

### P4 — Informational

#### [format-1] Both templates follow established format correctly

**Severity**: P4 (positive)
**Description**: Both files follow the established agent template format:
- Frontmatter with name, description (with examples), color, prompt_mode, base_prompt, framework, model, permission_mode, display_name, tools
- `<system-message>` block with character traits
- H1 with character name and role
- Persona reference
- Role description
- Responsibilities (numbered)
- Process sections
- Quality Standards
- Output
- Edge Cases (including SendMessage silent success warning)
- Session Start instruction
- References

#### [format-2] Role differentiation is clear and well-bounded

**Severity**: P4 (positive)
**Description**: The three PM-adjacent roles are clearly distinct:

| Role | Owns | Does NOT |
|------|------|----------|
| Project Manager (Elmer) | Task list, coordination, handoffs | Make technical decisions, write code |
| TPM (Porky) | Technical roadmap, trade-offs, dependencies | Assign tasks, write code |
| Product Manager (Pepé) | What to build and why, PRDs, acceptance criteria | Assign tasks, make architecture decisions |

No meaningful overlap. The TPM explicitly notes it operates "at higher altitude than the Project Manager." The product PM explicitly defers architectural decisions to the TPM.

#### [format-3] Display name format is correct

**Severity**: P4 (positive)
**Description**: Both follow the "First L (role)" pattern:
- `Porky P (tpm)` — correct
- `Pepé L (product-mgr)` — correct

---

## Pattern Match Table

| Element | Expected (existing agents) | TPM | Product PM |
|---------|---------------------------|-----|------------|
| Frontmatter with examples | 3 examples | 3 examples ✅ | 3 examples ✅ |
| color (unique) | Unique per agent | cyan ✅ | magenta ⚠️ (conflicts with PM) |
| prompt_mode: extend | Yes | Yes ✅ | Yes ✅ |
| model: claude-opus-4-6 | Varies | opus ✅ | opus ✅ |
| permission_mode: bypassPermissions | Yes | Yes ✅ | Yes ✅ |
| display_name format | "First L (role)" | ✅ | ✅ |
| tools appropriate for role | Varies | Read-only + tasks ✅ | Read/Write + tasks ⚠️ (missing task tools) |
| disallowed_tools | Present on read-only agents | Present ✅ | Missing ⚠️ |
| system-message block | Present | Present ✅ | Present ✅ |
| Persona reference | Present | Present ✅ | Present ✅ |
| Session Start | Present | Present ✅ | Present ✅ |
| References section | Present | Present ✅ | Present ✅ |
| Edge cases section | Present | Present ✅ | Present ✅ |
| SendMessage warning | Present | Present ✅ | Not present ⚠️ |

---

## Summary

Well-crafted agent templates with clear role differentiation. The two P2 findings (missing task tools on product PM, color conflict) should be addressed. P3s are non-blocking but would improve consistency with established patterns.

---

*Reviewed by Daffy D (qa) — 2026-02-24*
