> **Note (2026-02-23):** `delegate` permission mode was removed in Claude Code v2.1.50. The replacement is `bypassPermissions`. This document reflects findings at the time of writing.

# Delegate Mode Status in Claude Code

**Research Date**: February 23, 2026
**Researcher**: Road Runner (Deep Researcher)
**Claude Code Version Tested**: 2.1.50
**Confidence**: High (multiple sources, direct CLI verification)

---

## Answer

**Delegate mode has been removed from Claude Code's valid permission modes.** As of v2.1.50, it is no longer accepted by the CLI:

```
$ claude --permission-mode delegate --help
error: option '--permission-mode <mode>' argument 'delegate' is invalid.
Allowed choices are acceptEdits, bypassPermissions, default, dontAsk, plan.
```

The five valid permission modes are now:

1. **`default`** — Standard behavior with prompts
2. **`acceptEdits`** — Auto-accepts file edit permissions
3. **`plan`** — Read-only analysis mode
4. **`dontAsk`** — Auto-denies tools unless pre-approved via allow rules
5. **`bypassPermissions`** — Skips all permission prompts

**Our agent definitions all use `permission_mode: delegate` and need to be updated.** The invalid value is currently being silently ignored (agents load, but the permission mode likely defaults to something else).

---

## Evidence

### 1. CLI Verification (Confidence: High)

Direct test on the installed Claude Code binary:

```
$ claude --version
2.1.50 (Claude Code)

$ CLAUDECODE= claude --permission-mode delegate --help
error: option '--permission-mode <mode>' argument 'delegate' is invalid.
Allowed choices are acceptEdits, bypassPermissions, default, dontAsk, plan.
```

The `--help` output confirms:

```
--permission-mode <mode>  Permission mode to use for the session
  (choices: "acceptEdits", "bypassPermissions", "default", "dontAsk", "plan")
```

### 2. Task Tool Schema (Confidence: High)

The Task tool's `mode` parameter in the current session's tool definitions lists:

```json
"enum": ["acceptEdits", "bypassPermissions", "default", "dontAsk", "plan"]
```

"delegate" is not listed.

### 3. Agent Definitions Load Despite Invalid Value (Confidence: High)

Running `claude agents` lists all 9 project agents without errors, despite all having `permission_mode: delegate` in frontmatter. This suggests the invalid value is silently ignored rather than causing a hard failure.

From our prior QA report (`docs/reports/qa-phase1-code-review.md:81`):

> "A typo in `permission_mode` silently drops the agent with only a warning."

### 4. GitHub Issues (Confidence: High)

Delegate mode had a well-documented critical bug with agent teams:

| Issue                                                            | Title                                                | Status             | Version  |
| :--------------------------------------------------------------- | :--------------------------------------------------- | :----------------- | :------- |
| [#23447](https://github.com/anthropics/claude-code/issues/23447) | delegate mode cascades to teammates                  | OPEN (stale)       | v2.1.32  |
| [#24073](https://github.com/anthropics/claude-code/issues/24073) | Teammates lose tool access despite bypassPermissions | OPEN (stale)       | v2.1.37  |
| [#24307](https://github.com/anthropics/claude-code/issues/24307) | Teammates have no file access tools                  | OPEN (stale)       | v2.1.37  |
| [#25037](https://github.com/anthropics/claude-code/issues/25037) | delegate mode breaks agent teams                     | CLOSED (duplicate) | v2.1.37+ |
| [#14297](https://github.com/anthropics/claude-code/issues/14297) | Missing documentation for delegate mode              | CLOSED (resolved)  | v2.0.71+ |

The bug was that delegate mode cascaded its restrictions to ALL teammates, stripping them of file tools (Read, Write, Edit, Bash, Glob, Grep). Even passing `mode: "bypassPermissions"` to the Task tool couldn't override it.

The evidence suggests Anthropic may have resolved the bug by **removing delegate mode entirely** rather than fixing the cascading behavior.

### 5. Documentation State (Confidence: Medium-High)

- The [official permissions docs](https://code.claude.com/docs/en/permissions) list five modes — delegate is not among them
- The [subagent docs](https://code.claude.com/docs/en/sub-agents) list `permissionMode: default | acceptEdits | dontAsk | bypassPermissions | plan` — no delegate
- Issue [#14297](https://github.com/anthropics/claude-code/issues/14297) was closed as resolved on Feb 18, 2026, with docs reportedly added at `code.claude.com/docs/en/agent-teams#use-delegate-mode`
- A brief documentation page may have existed but was likely removed alongside the feature

### 6. Timeline Reconstruction (Confidence: Medium)

| Period                          | State                                                       |
| :------------------------------ | :---------------------------------------------------------- |
| v2.0.71+ (late 2025)            | Delegate mode first appeared, undocumented                  |
| v2.1.32–2.1.37 (early Feb 2026) | Critical bug reports filed — delegate cascades to teammates |
| Feb 18, 2026                    | Documentation issue #14297 closed as resolved               |
| v2.1.50 (current)               | Delegate mode removed from valid CLI options                |

The removal likely happened between v2.1.37 and v2.1.50 (roughly Feb 9–23, 2026).

---

## What Was Delegate Mode?

Delegate mode restricted the lead agent to coordination-only tools:

- **Allowed**: SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet
- **Blocked**: Read, Write, Edit, Bash, Glob, Grep

The intent was to force the orchestrator to delegate all implementation work to teammates. The concept was sound — the execution was broken because the restriction leaked to all spawned teammates.

### Root Cause of the Bug

From [issue #24073](https://github.com/anthropics/claude-code/issues/24073):

> The permission model computes `effective_permissions = min(mode_param, lead_session_state)` rather than `effective_permissions = mode_param`. The lead's Delegate Mode acts as a ceiling on what permissions can be granted to children.

From the [agent teams docs](https://code.claude.com/docs/en/agent-teams):

> "Teammates start with the lead's permission settings."

This design meant delegate mode was inherently incompatible with functional agent teams.

---

## What is `dontAsk` Mode? (New)

`dontAsk` is a permission mode that **did not replace delegate**. It serves a different purpose:

- **Auto-denies** all tool access unless explicitly pre-approved via permission rules
- Intended for hands-off automation and security-conscious environments
- Has its own known issues: sub-agents can't use tools in dontAsk mode ([#11934](https://github.com/anthropics/claude-code/issues/11934))

The evidence suggests `dontAsk` is not a direct replacement for delegate's orchestration-focused restriction. It's a broader "deny by default" mode.

---

## Impact on Our Agent Definitions

All 9 agent definitions currently use `permission_mode: delegate`:

```
.claude/agents/ai-agent-eng.md:37:      permission_mode: delegate
.claude/agents/deep-researcher.md:37:    permission_mode: delegate
.claude/agents/designer.md:46:           permission_mode: delegate
.claude/agents/docs-writer.md:37:        permission_mode: delegate
.claude/agents/ops-eng.md:37:            permission_mode: delegate
.claude/agents/orchestrator.md:38:       permission_mode: delegate
.claude/agents/project-manager.md:37:    permission_mode: delegate
.claude/agents/quality-assurance.md:37:  permission_mode: delegate
.claude/agents/software-eng.md:37:       permission_mode: delegate
```

Additionally, the following docs reference `--permission-mode delegate`:

- `docs/LAUNCH-GUIDE.md:49`
- `docs/scratch.md:81`
- `docs/specs/draft/agent-launcher.md` (multiple locations)
- `docs/specs/draft/cchistory-prompt-flavors.md` (multiple locations)
- `docs/research/` (multiple files)

### Recommendation

**Update agent definitions to use a valid permission mode.** The appropriate replacement depends on the agent's role:

| Agent             | Current  | Recommended       | Rationale                                                              |
| :---------------- | :------- | :---------------- | :--------------------------------------------------------------------- |
| orchestrator      | delegate | bypassPermissions | Needs coordination tools; use hooks to restrict non-coordination tools |
| software-eng      | delegate | bypassPermissions | Needs full file access for implementation                              |
| ops-eng           | delegate | bypassPermissions | Needs bash, file tools for infra work                                  |
| quality-assurance | delegate | bypassPermissions | Needs bash, read for testing and review                                |
| deep-researcher   | delegate | bypassPermissions | Needs read, grep, glob, web tools                                      |
| docs-writer       | delegate | bypassPermissions | Needs read/write for documentation                                     |
| ai-agent-eng      | delegate | bypassPermissions | Needs read/grep for observation and analysis                           |
| project-manager   | delegate | bypassPermissions | Needs task tools (already works)                                       |
| designer          | delegate | bypassPermissions | Needs read/grep for design review                                      |

**Why `bypassPermissions`**: Our launch guide already uses `--dangerously-skip-permissions` for the lead, and teammates inherit that. The `bypassPermissions` mode aligns with our actual runtime behavior. For the orchestrator specifically, restricting tools via hooks (as noted in `docs/scratch.md:76-78`) is a better approach than relying on a permission mode.

---

## Open Questions

1. **Was delegate mode formally deprecated or just silently removed?** No changelog entry or announcement was found. (Confidence: Low — the evidence suggests silent removal, but the changelog search may have been incomplete)

2. **Does the `permission_mode: delegate` frontmatter cause silent failures?** Agents load, but we don't know if the mode is defaulted to `default`, `bypassPermissions`, or something else. Testing needed.

3. **Will delegate mode return in a fixed form?** The concept is valuable for orchestrator isolation. The related issues are still OPEN (stale), suggesting Anthropic hasn't committed to bringing it back.

4. **Should we use hooks instead?** The orchestrator could use PreToolUse hooks to block non-coordination tools, achieving delegate-like behavior without depending on a permission mode.

---

## Sources

### Direct Verification

- `claude --version` → 2.1.50
- `claude --help` → permission-mode choices
- `CLAUDECODE= claude --permission-mode delegate --help` → explicit rejection

### GitHub Issues

- [#25037](https://github.com/anthropics/claude-code/issues/25037) — delegate mode breaks agent teams (CLOSED)
- [#24073](https://github.com/anthropics/claude-code/issues/24073) — teammates lose tools despite bypassPermissions (OPEN/stale)
- [#24307](https://github.com/anthropics/claude-code/issues/24307) — no file access tools in delegate mode (OPEN/stale)
- [#23447](https://github.com/anthropics/claude-code/issues/23447) — delegate cascades to teammates (OPEN/stale)
- [#14297](https://github.com/anthropics/claude-code/issues/14297) — missing docs for delegate mode (CLOSED)
- [#15194](https://github.com/anthropics/claude-code/issues/15194) — CLI documentation gap
- [#11934](https://github.com/anthropics/claude-code/issues/11934) — sub-agents fail in dontAsk mode
- [#17360](https://github.com/anthropics/claude-code/issues/17360) — dontAsk activates unexpectedly

### Documentation

- [Claude Code Permissions](https://code.claude.com/docs/en/permissions) — official modes list
- [Agent Teams](https://code.claude.com/docs/en/agent-teams) — permission inheritance behavior
- [Subagents](https://code.claude.com/docs/en/sub-agents) — frontmatter schema

### Local Codebase

- `.claude/agents/*.md` — all 9 agent definitions with `permission_mode: delegate`
- `docs/LAUNCH-GUIDE.md` — manual launch command using `--permission-mode delegate`
- `docs/scratch.md:80-81` — agent teams launch requirement noting delegate mode
- `docs/reports/session-2026-02-17/session-briefing.md:116` — delegate mode bug noted
- `docs/research/agent-teams-messaging-source.md:87` — delegate mode behavior in source code
