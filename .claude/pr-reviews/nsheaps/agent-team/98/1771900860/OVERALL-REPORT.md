# PR Review: agent-team#98

**Score**: 82/100 ⚠️
**Verdict**: Fix then merge

## Category Scores

| Category         | Score | Status |
| :--------------- | ----: | :----- |
| Simplicity       |    88 | ✅     |
| Flexibility      |    85 | ✅     |
| Usability        |    88 | ✅     |
| Documentation    |    92 | ✅     |
| Security         |    78 | ⚠️     |
| Pattern Matching |    80 | ⚠️     |
| Best Practices   |    75 | ⚠️     |
| General QA       |    72 | ⚠️     |

_Three categories below 85%; score capped at 94, but weighted average is 82._

## Findings

### security-1: Spec documents `--permission-mode bypassPermissions` as the default for `agent create` with no caveat (P2)

**File**: `docs/specs/draft/claude-team-cli.md:187`
**Description**: The `--permission-mode` flag for `claude-team agent create` defaults to `"bypassPermissions"` and presents it to users as `"Recommended for teammates"` in the interactive flow. A spec that ships `bypassPermissions` as the default for newly created agents is recommending that every user-created agent get unrestricted tool access. This conflates the teammate use case (where bypass is appropriate) with the general agent creation workflow (where it may not be). New users creating agents for untrusted workloads would silently inherit this permissive default.
**Expected**: Default should be `default` (inherit parent session permissions), with a clear callout in the interactive flow that `bypassPermissions` is the right choice for agent team teammates specifically. The spec should document the tradeoffs.
**Actual**: `--permission-mode` defaults to `"bypassPermissions"` with "Recommended for teammates" as the only guidance.
**Steps to reproduce**: Review `docs/specs/draft/claude-team-cli.md` line 187 and the interactive flow example at lines 210-215.

### security-2: `--tools` flag accepts a comma-separated whitelist but no validation rules are specified (P3)

**File**: `docs/specs/draft/claude-team-cli.md:191`
**Description**: The `--tools` flag allows users to specify a comma-separated whitelist of allowed tools, but the spec provides no validation rules: what happens with unknown tool names? What if both `--tools` and `--disallowed-tools` are provided? What if `--tools` is empty vs. unset? The spec says "(all)" for the default, but doesn't define the semantic difference between `tools: []` (all) and `tools: ["Read"]` (restricted).
**Expected**: Explicit validation rules: invalid tool names produce an error, conflicts between `--tools` and `--disallowed-tools` are defined, and the semantic meaning of empty vs. unset is documented.
**Actual**: No validation rules specified. Behavior is undefined when both flags are used.
**Steps to reproduce**: See spec section 2.2, flags table, rows for `--tools` and `--disallowed-tools`.

### best-practices-1: Spec output files in `.claude/agents/` but the spec does not acknowledge that this directory is already populated in this repo (P2)

**File**: `docs/specs/draft/claude-team-cli.md:166-167`
**Description**: `claude-team agent create` writes to `.claude/agents/{name}.md`. In this repository, `.claude/agents/` already contains all 8 role agent definitions. The spec doesn't address what happens when `claude-team agent create --name quality-assurance` is invoked in a repo that already has `quality-assurance.md`. The error-handling table says `"Agent name already exists"` produces an error — but there's no guidance for users who want to update an existing agent definition, which is a very common use case.
**Expected**: Spec should document an `--overwrite` or `--force` flag, or an `agent update` subcommand, to handle the existing-agent scenario.
**Actual**: Existing agents can only be errored on; no update path is specified.
**Steps to reproduce**: See spec section 2.2 error handling table, line ~264. No update path exists.

### best-practices-2: `claude-team team create --template none` is specified but `none` is not listed as a valid value in the `--template` flag table (P3)

**File**: `docs/specs/draft/claude-team-cli.md:68` and `542-551`
**Description**: The `--template` flag at line 68 says default is `"default"` and accepts values from `templates/teams/`. Section 7 shows `--template none` as a special edge case for creating a team with no template. But `none` is not listed as a valid value in the flag definition table, and the validation rules in section 6 don't mention it. Someone implementing this from the spec would not know `none` is a valid sentinel value.
**Expected**: `--template` flag definition explicitly lists `none` as a valid special-case value. Validation rules in section 6 reference it.
**Actual**: `none` appears only in section 7 as an implicit special case.
**Steps to reproduce**: Compare spec lines 68 (flag table) against lines 542-551 (edge case section).

### general-qa-1: Spec references `agent-launcher.md` spec for agent file schema but does not validate the frontmatter fields it documents against that spec (P2)

**File**: `docs/specs/draft/claude-team-cli.md:479`
**Description**: The spec states "see [Agent Launcher Spec](agent-launcher.md) for schema" and in section 5 says agent files follow that schema. The output file example at lines 230-257 includes `prompt_mode`, `color`, `tools`, `disallowed_tools` as frontmatter fields. Looking at the actual agent files in `.claude/agents/`, none of them use `prompt_mode`, `color`, `tools`, or `disallowed_tools` in frontmatter. These fields may be forward-looking from the agent-launcher spec but are not yet part of the live schema. A spec that documents output including fields that don't exist in the current runtime will cause confusion and broken implementations.
**Expected**: The spec should explicitly note which frontmatter fields are current vs. planned/future (from the agent-launcher spec), or limit the output format to fields that are known-live today.
**Actual**: `prompt_mode`, `color`, `tools`, `disallowed_tools` are shown as output fields with no note that they may not be consumed by the current runtime.
**Steps to reproduce**: Compare `docs/specs/draft/claude-team-cli.md` lines 230-257 against actual `.claude/agents/quality-assurance.md` or any existing agent file.

### general-qa-2: Interactive flow for `team create` says "next steps: run 'claude-team team add'" but that subcommand is documented in section 2.3, not as a separate binary (P4)

**File**: `docs/specs/draft/claude-team-cli.md:95`
**Description**: The interactive flow output says `Run 'claude-team team add <agent-name>' to add agents` which is correct per the spec. Minor: the note is helpful and accurate. Informational only.
**Expected**: No action needed.
**Actual**: Correct.
**Steps to reproduce**: N/A.

### pattern-matching-1: Spec output directory for `team create` defaults to `templates/teams/` but `--cwd` is described as "project root directory" (P3)

**File**: `docs/specs/draft/claude-team-cli.md:69` and `458-469`
**Description**: The `--output-dir` flag defaults to `"templates/teams/"` (relative to project root). The global `--cwd` flag is described as "Project root directory" defaulting to `"."`. This creates an ambiguity: is `--output-dir` resolved relative to `--cwd`, or to the current working directory of the shell? The spec doesn't define the resolution order. If `--cwd /some/project` and `--output-dir templates/teams/`, does output go to `/some/project/templates/teams/` or `./templates/teams/`?
**Expected**: Spec explicitly states that `--output-dir` is resolved relative to `--cwd`, and provides an example.
**Actual**: Resolution order is undefined.
**Steps to reproduce**: See spec sections 2.1 (flags table) and 4 (global flags).

### pattern-matching-2: Validation section uses regex `[a-z0-9]+(-[a-z0-9]+)*` for kebab-case but the spec doesn't address single-segment names like `qa` (P4)

**File**: `docs/specs/draft/claude-team-cli.md:511`
**Description**: The regex `[a-z0-9]+(-[a-z0-9]+)*` correctly matches both `qa` and `quality-assurance`. This is fine. Noting as informational to confirm the regex is valid.
**Expected**: Regex is valid as written.
**Actual**: Correct.
**Steps to reproduce**: N/A.

## Summary

This is a solid first draft of the `claude-team` CLI spec — the command structure is logical, the interactive/non-interactive dual-mode design is well-reasoned, and the file convention documentation is thorough. However, there are three defects that should be resolved before implementation begins: `bypassPermissions` as a default permission mode without clear tradeoff documentation (P2), no agent update path documented (P2), and frontmatter fields in the output format that don't exist in the current live agent runtime (P2). The `--tools`/`--disallowed-tools` conflict behavior and `--template none` sentinel value omission are P3 issues that create implementation ambiguity. These gaps in a spec that is about to drive implementation are worth fixing before the spec moves to `reviewed/`.
