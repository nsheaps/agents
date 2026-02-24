# PR #103 Review: docs(specs): add brew-auto-maintenance Go tool spec

**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23
**File Reviewed**: `docs/specs/draft/brew-auto-maintenance.md` (new file, 365 lines)
**PR**: agent-team#103

---

## Score Summary

| # | Category | Score | Status |
|---|----------|-------|--------|
| 1 | Simplicity | 88 | ✅ |
| 2 | Flexibility | 85 | ✅ |
| 3 | Usability | 82 | ⚠️ |
| 4 | Documentation | 90 | ✅ |
| 5 | Security | 72 | ⚠️ |
| 6 | Pattern Matching | 87 | ✅ |
| 7 | Best Practices | 78 | ⚠️ |
| 8 | General QA | 76 | ⚠️ |
| **Overall** | | **82** (capped at 94 due to categories < 85) | ⚠️ |

**Verdict**: Solid draft spec with a well-scoped MVP and clear phasing. However, several security gaps, ambiguous behaviors, and missing edge case definitions must be addressed before moving to `reviewed/`. The spec is not ready for implementation without the fixes below.

---

## Findings

### Must-Fix (P1/P2)

---

**Finding SECURITY-1** (P1, Category 5: Security)
**File**: `docs/specs/draft/brew-auto-maintenance.md:192-219`
**Description**: The plist template embeds `{{.Program}}` as the binary path with no validation or sanitization. If the binary path contains spaces or special characters (common on macOS, e.g., `/Applications/My App/...`), the plist XML will be malformed or exploitable. The spec does not mention XML escaping of template variables.
**Expected**: Spec should require XML-safe escaping of all template variables, or explicitly state that paths must be validated before template rendering.
**Actual**: Template variables are injected raw into XML.
**Severity**: P1 — plist injection is a real attack vector for privilege escalation on macOS.

---

**Finding SECURITY-2** (P1, Category 5: Security)
**File**: `docs/specs/draft/brew-auto-maintenance.md:80-87`
**Description**: The `upgrade` command shells out to `brew upgrade` with user-supplied `--formula <name>` and `--tap <tap>` values. The spec does not specify input validation or sanitization for these arguments before passing to `os/exec`. A formula name like `foo; rm -rf /` would be catastrophic if passed through a shell.
**Expected**: Spec should explicitly require that arguments are passed as separate `exec.Command` args (not through a shell string), and that formula/tap names are validated against a safe pattern (e.g., `^[a-zA-Z0-9_\-/]+$`).
**Actual**: No input validation requirements specified.

---

**Finding QA-1** (P2, Category 8: General QA)
**File**: `docs/specs/draft/brew-auto-maintenance.md:128-137`
**Description**: The `installSchedule` field accepts both a cron expression (`"0 2 * * *"`) and a duration (`"0s"`). The spec does not define how the tool distinguishes between these two formats, what happens if an invalid value is provided, or what the validation rules are. This is a guaranteed source of implementation bugs.
**Expected**: Spec should define: (1) how to disambiguate cron vs duration (e.g., try duration first, fall back to cron), (2) validation error messages for invalid values, (3) behavior when the value is empty or missing.
**Actual**: Two formats mentioned with no disambiguation rule.

---

**Finding QA-2** (P2, Category 8: General QA)
**File**: `docs/specs/draft/brew-auto-maintenance.md:89-98`
**Description**: The `service` subcommand defines `install` and `uninstall` but does not specify behavior when:
- `install` is called and the plist already exists (overwrite? error? prompt?)
- `uninstall` is called and the service is currently running (stop first? error?)
- `start` is called and the service is not installed
- The plist file permissions are wrong
- The binary path in the plist no longer exists (e.g., after a `brew uninstall`)
**Expected**: Each state transition should have defined behavior.
**Actual**: Only happy paths are specified.

---

**Finding USABILITY-1** (P2, Category 3: Usability)
**File**: `docs/specs/draft/brew-auto-maintenance.md:232-240`
**Description**: The tap-specific upgrade logic in 5.3 uses `brew list --formula` piped through `grep -f <tap-formulae-list>` for the "empty formulae" case. This is a shell pipe, contradicting the use of `os/exec` with `context.WithTimeout` stated in 5.1. More importantly, `brew list --formula` does not output tap-qualified names by default — it outputs bare formula names. The spec conflates `brew list --formula` with `brew info --json=v2 --installed` without clarifying which is actually used.
**Expected**: One clear method for determining which installed formulae belong to a tap. The JSON v2 output from `brew info` is the right approach — it includes tap information. Specify that, not a grep pipe.
**Actual**: Two contradictory approaches described in the same section.

---

### Should-Fix (P3)

---

**Finding BESTPRACTICE-1** (P3, Category 7: Best Practices)
**File**: `docs/specs/draft/brew-auto-maintenance.md:186`
**Description**: Cobra is listed as "Optional" with plain `os.Args` switch as an alternative. For a tool with 6+ subcommands, nested subcommands (`service install`, `config show`), and multiple flags per command, hand-rolling argument parsing is a known source of bugs and inconsistent help text. The spec should take a position rather than leaving this as an open question.
**Expected**: Spec should recommend cobra (or an alternative like `urfave/cli`) for a tool of this complexity, and note that `os.Args` is only acceptable if the team explicitly decides to minimize dependencies.
**Actual**: Left as open question #3.

---

**Finding BESTPRACTICE-2** (P3, Category 7: Best Practices)
**File**: `docs/specs/draft/brew-auto-maintenance.md:288-305`
**Description**: The GoReleaser config specifies `CGO_ENABLED=1` for both architectures, but does not address cross-compilation. CGO with cross-compilation on macOS (amd64 from arm64 or vice versa) requires additional toolchain setup. The spec should note this constraint and specify whether CI builds happen on both architectures or use a cross-compiler.
**Expected**: Spec should document the CI build strategy for both architectures with CGO enabled.
**Actual**: GoReleaser excerpt implies both architectures build with CGO but does not address how.

---

**Finding BESTPRACTICE-3** (P3, Category 7: Best Practices)
**File**: `docs/specs/draft/brew-auto-maintenance.md:326-329`
**Description**: Phase 2 says logs go to `~/Library/Logs/brew-auto-maintenance/` but the plist template in 5.2 uses `{{.LogPath}}` and `{{.ErrLogPath}}` without specifying what these resolve to. The log path should be defined in one place, not implied across two sections.
**Expected**: Single source of truth for log location, referenced by both the plist template and the phase 2 deliverables.
**Actual**: Log path defined in two places with no cross-reference.

---

**Finding SECURITY-3** (P3, Category 5: Security)
**File**: `docs/specs/draft/brew-auto-maintenance.md:253`
**Description**: "Preferences..." opens config in `$EDITOR` or system default. The spec does not specify how the system default editor is determined. Using `open` on macOS with an arbitrary file could invoke unexpected applications. Additionally, `$EDITOR` could be set to a malicious binary.
**Expected**: Spec should define the editor resolution order and note that the config file path should not be user-controllable at the point of opening.
**Actual**: Editor selection is hand-waved.

---

**Finding FLEXIBILITY-1** (P3, Category 2: Flexibility)
**File**: `docs/specs/draft/brew-auto-maintenance.md:159-172`
**Description**: The Config struct uses `string` for `CheckInterval` and `InstallSchedule` rather than dedicated types. This is fine for YAML parsing but the spec should note that these will need custom `UnmarshalYAML` methods or post-parse validation. Without this note, an implementer might just use the raw strings and hit runtime panics from `time.ParseDuration`.
**Expected**: Note in the struct definition that `CheckInterval` and `InstallSchedule` require custom parsing/validation.
**Actual**: Comment says "parsed as time.Duration" but no validation guidance.

---

### Nice-to-Have (P4)

---

**Finding SIMPLICITY-1** (P4, Category 1: Simplicity)
**File**: `docs/specs/draft/brew-auto-maintenance.md:309-341`
**Description**: The phase plan is clean and well-scoped. One minor issue: Phase 1 says "No CGO, no tray — cross-compilable for development" but Phase 3 introduces CGO via systray. The transition from CGO_ENABLED=0 to CGO_ENABLED=1 between phases should be called out as an explicit breaking change in the build process.
**Expected**: Note that Phase 3 introduces a build requirement change.
**Actual**: Implicit — reader must infer from context.

---

**Finding DOC-1** (P4, Category 4: Documentation)
**File**: `docs/specs/draft/brew-auto-maintenance.md:310-320`
**Description**: Phase 1 deliverables list `brew check` and `brew upgrade` as shorthand, but the actual commands are `brew-auto-maintenance check` and `brew-auto-maintenance upgrade`. This could confuse an implementer scanning quickly.
**Expected**: Use full command names in deliverables, or note the shorthand convention.
**Actual**: Inconsistent naming between deliverables list and CLI interface section.

---

**Finding PATTERN-1** (P4, Category 6: Pattern Matching)
**File**: `docs/specs/draft/brew-auto-maintenance.md:1-14`
**Description**: The spec header correctly follows the project's spec template conventions (Status, Author, Date, Task, Research). Good adherence to the `docs/specs/draft/` location and the unified spec format from `mantras-and-incremental-development.md`. No issues here — noting as a positive.

---

## Category Detail

### 1. Simplicity (88) ✅

The spec is well-scoped at ~365 lines, under the 500-line guidance. The phasing is clean — MVP first, no gold-plating. The single-binary design is appropriately simple. Minor deduction for the cron-vs-duration ambiguity in `installSchedule` which adds unnecessary cognitive load.

### 2. Flexibility (85) ✅

The tap-specific configuration is extensible. The phased approach allows cutting scope. The config schema is straightforward to extend. Deducted for the `string` types without validation guidance — future config additions could hit the same parsing ambiguity.

### 3. Usability (82) ⚠️

A developer could implement Phase 1 from this spec, but would hit ambiguity at the tap-specific upgrade logic (contradictory approaches in 5.3) and the `installSchedule` parsing. The service state machine is underspecified — an implementer would have to make assumptions about error states.

### 4. Documentation (90) ✅

Strong references section. Research cross-referenced. Code examples for config, plist, CLI. The Go struct definition alongside the YAML schema is helpful. Minor deduction for the `brew check`/`brew upgrade` shorthand inconsistency in Phase 1.

### 5. Security (72) ⚠️

Three security findings, one at P1. The plist template injection and command argument sanitization are serious gaps for a tool that runs with user privileges and shells out to `brew`. The `$EDITOR` resolution is a lesser concern but should still be addressed in a macOS tool spec.

### 6. Pattern Matching (87) ✅

Follows project conventions: spec in `docs/specs/draft/`, correct header format, appropriate cross-references to research. Uses the unified spec format. GoReleaser + Homebrew tap pattern matches existing `nsheaps/devsetup` infrastructure.

### 7. Best Practices (78) ⚠️

The CGO cross-compilation gap is a real concern for CI. Leaving cobra vs `os.Args` as an open question for a tool with nested subcommands is risky — the wrong choice could mean rewriting CLI parsing later. The log path inconsistency between sections violates DRY.

### 8. General QA (76) ⚠️

Multiple undefined behaviors: service state transitions, config parsing disambiguation, error exit codes for `upgrade` (only `check` defines exit codes), behavior when `brew` is not installed or not in PATH, behavior when the config file is malformed or missing. The spec defines happy paths well but leaves too many error paths unspecified for a tool that will run unattended as a background service.

---

## Additional Observations

1. **Missing**: No mention of what happens when `brew` itself is not found in PATH. For a background service, this is a likely failure mode (launchd PATH is not the same as interactive shell PATH).
2. **Missing**: No error exit codes defined for `upgrade`, `service`, or `config` subcommands — only `check` has exit code semantics.
3. **Missing**: No mention of concurrent execution guards. If the launchd service triggers `check` while a user is manually running `upgrade`, what happens? Homebrew itself has a lock file, but the spec should acknowledge this.
4. **Missing**: No mention of how `config reset` prompts the user — is it stdin? A macOS dialog? This matters for the service context where there is no TTY.

---

## Verdict

This is a well-structured draft spec that demonstrates clear thinking about scope and phasing. The technical design is grounded in real research. However, the security gaps (plist injection, argument sanitization) and the number of undefined error behaviors make this spec not yet ready for implementation.

**Recommendation**: Address all P1 and P2 findings, then move to `docs/specs/reviewed/`. P3 findings should be addressed before implementation begins. P4 findings are nice-to-have improvements.

---

*Reviewed by Daffy D (qa) — 2026-02-23*
