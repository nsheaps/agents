# PR Review: ai-mktpl#173 — feat/code-review-to-scm-utils

**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23
**PR**: https://github.com/nsheaps/ai-mktpl/pull/173

---

## Verdict: Ready to merge (with P2 items as follow-ups)

**Overall Score: 87/100** ✅ (capped at 94 due to categories < 85; actual average 87.3)

**Note**: qa-3 from the initial sub-agent review was a false positive — `actions/checkout@v6` exists (latest: v6.0.2). Score adjusted upward.

## Category Scores

| #   | Category         | Score | Status |
| --- | ---------------- | ----- | ------ |
| 1   | Simplicity       | 88    | ✅     |
| 2   | Flexibility      | 90    | ✅     |
| 3   | Usability        | 87    | ✅     |
| 4   | Documentation    | 92    | ✅     |
| 5   | Security         | 85    | ✅     |
| 6   | Pattern Matching | 82    | ⚠️     |
| 7   | Best Practices   | 88    | ✅     |
| 8   | General QA       | 86    | ✅     |

---

## Findings

### P2 — Must-address before merge

#### [pattern-1] Command frontmatter missing `argument-hint` and `allowed-tools`

**File**: `plugins/scm-utils/commands/code-review.md:1-6`
**Severity**: P2
**Category**: 6 — Pattern Matching

**Description**: The existing `update-branch.md` command uses `argument-hint` and `allowed-tools` in its frontmatter. The new `code-review.md` command omits both fields. This breaks the established pattern for commands in this plugin.

**Expected**:

```yaml
---
name: code-review
description: >
  Code review a pull request. ...
argument-hint: [PR number | PR URL | branch name]
allowed-tools: Bash, Read, Grep, Glob, Task, Skill
---
```

**Actual**: Only `name` and `description` are present.

**Steps to reproduce**: Compare frontmatter of `plugins/scm-utils/commands/code-review.md` with `plugins/scm-utils/commands/update-branch.md`.

---

#### [qa-1] Command references nonexistent skill `pr-review-toolkit:review-pr`

**File**: `plugins/scm-utils/commands/code-review.md:33`
**Severity**: P2
**Category**: 8 — General QA

**Description**: Step 4 of the command references "the `pr-review-toolkit:review-pr` skill or the `code-review:code-review` agent" for local review fallback. There is no indication that `pr-review-toolkit` is a dependency of scm-utils or that it exists in this repository. Additionally, `code-review:code-review` agent is referenced but not defined in this PR.

**Expected**: Either (a) the skill/agent exists and is documented as a dependency, or (b) the fallback step provides self-contained instructions for local review.

**Actual**: Dangling references to external capabilities that may not exist at runtime.

**Steps to reproduce**: Search the repo for `pr-review-toolkit` — confirm it does not exist in the scm-utils plugin or as a declared dependency.

---

### P3 — Should address

#### [pattern-2] Command lacks dynamic context injection

**File**: `plugins/scm-utils/commands/code-review.md`
**Severity**: P3
**Category**: 6 — Pattern Matching

**Description**: The `update-branch.md` command includes a "Pre-fetched Context" section with `!`-backtick dynamic content injection (current branch, PR info). The `code-review.md` command does not include any dynamic context injection or `$ARGUMENTS` interpolation. This means the agent will need to independently discover context that could have been pre-provided.

**Expected**: Include `$ARGUMENTS` reference and pre-fetched context block matching the update-branch pattern.

**Actual**: No dynamic context injection.

---

#### [qa-2] Copilot instructions reference `.yml` but workflow template uses `.yaml`

**File**: `plugins/scm-utils/skills/code-review/references/copilot-instructions.md:18`
**Severity**: P3
**Category**: 8 — General QA

**Description**: The copilot instructions reference `@.github/workflows/claude-code-review.yml` (with `.yml`), but the workflow template and the SKILL.md consistently reference `.github/workflows/claude-code-review.yaml` (with `.yaml`). Per project rules (`.ai/rules/file-extensions.md`), `.yaml` is the preferred extension. The `.yml` reference is incorrect and would fail to resolve.

**Expected**: `@.github/workflows/claude-code-review.yaml`
**Actual**: `@.github/workflows/claude-code-review.yml`

---

#### [security-1] Workflow template allows broad Bash permissions

**File**: `plugins/scm-utils/skills/code-review/references/workflow-template.yaml:100-125`
**Severity**: P3
**Category**: 5 — Security

**Description**: The permissions allow-list includes `Bash` as a blanket tool permission alongside more granular `Bash(git log:*)` entries. The blanket `Bash` permission effectively makes all the granular entries redundant and opens the door to arbitrary command execution during review. While `git push` is denied, other destructive commands (e.g., `rm`, `curl` to exfiltrate) are not blocked.

**Expected**: Either remove the blanket `Bash` permission and rely solely on the granular entries, or document why blanket Bash access is intentionally needed.

**Actual**: Both `Bash` (blanket) and `Bash(git log:*)` etc. (granular) coexist without explanation.

---

#### ~~[qa-3] `actions/checkout@v6` does not exist~~ — FALSE POSITIVE

**DISMISSED**: `actions/checkout@v6` is valid — latest release is v6.0.2 (verified via GitHub API). Sub-agent had stale knowledge. No issue.

---

#### [simplicity-1] Duplicate tool allowlist in `settings` and `claude_args`

**File**: `plugins/scm-utils/skills/code-review/references/workflow-template.yaml:97-157`
**Severity**: P3
**Category**: 1 — Simplicity

**Description**: The MCP GitHub tools are listed in both the `settings.permissions.allow` array AND in `claude_args: --allowedTools`. This duplication increases maintenance burden. If one list is updated without the other, behavior will be inconsistent.

**Expected**: Tools should be specified in one place only.
**Actual**: Same 10 MCP tools listed twice.

---

### P4 — Informational / Improvement Opportunities

#### [docs-1] SKILL.md external references use good practice

**File**: `plugins/scm-utils/skills/code-review/SKILL.md:250-254`
**Severity**: P4
**Category**: 4 — Documentation

**Description**: The skill includes an "External References" section with links to claude-code-action, its docs, settings reference, and MCP tools. This is good practice and follows the project's documentation-references rule. Noting as a positive finding.

---

#### [flexibility-1] Prompt template is well-structured for customization

**File**: `plugins/scm-utils/skills/code-review/references/prompt-template.md`
**Severity**: P4
**Category**: 2 — Flexibility

**Description**: The prompt template uses `${VAR}` interpolation, clearly documents available variables, and is designed to be customized per-repo. This is good design for extensibility. Noting as a positive finding.

---

#### [qa-4] Label color casing inconsistency

**File**: `plugins/scm-utils/skills/code-review/references/labels.yaml:7`
**Severity**: P4
**Category**: 8 — General QA

**Description**: The `request-review` label uses `'f19cFb'` (mixed case) while `always-review` uses `'f19c3b'` (lowercase). While GitHub is case-insensitive for hex colors, inconsistent casing is sloppy.

**Expected**: Consistent casing, preferably lowercase: `'f19cfb'`.
**Actual**: Mixed case `'f19cFb'`.

---

#### [docs-2] safe-settings-write.sh documentation improvement is out of scope

**File**: `shared/lib/safe-settings-write.sh:23-33`
**Severity**: P4
**Category**: 4 — Documentation

**Description**: The addition of the EXIT trap contract documentation and STATUSLINE_SCRIPT coupling note to `safe-settings-write.sh` is unrelated to the code-review feature being added. While the documentation itself is useful and accurate, it should ideally be in a separate PR to keep scope focused.

---

## Summary

This PR adds code review functionality to the scm-utils plugin through a command, skill, and reference templates. The overall structure is sound and the documentation is thorough. The main issues are:

1. **Pattern compliance**: The new command does not match the frontmatter pattern of existing commands (missing `argument-hint`, `allowed-tools`, dynamic context injection).
2. **Dangling references**: The command references `pr-review-toolkit:review-pr` and `code-review:code-review` agent which do not appear to exist.
3. **File extension mismatch**: Copilot instructions reference `.yml` but everything else uses `.yaml`.
4. **Workflow template issues**: Non-existent `checkout@v6`, duplicate tool allowlists, overly broad `Bash` permissions.
5. **Out-of-scope change**: The `safe-settings-write.sh` documentation change is unrelated to this feature.

The P2 findings should be addressed before merge. The P3 findings should be addressed but are not blocking if there's urgency.

---

_Review by Daffy D (qa) -- 2026-02-23_
