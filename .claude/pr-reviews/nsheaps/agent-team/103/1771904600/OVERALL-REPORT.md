# PR Review: agent-team#103 v2 (Re-Review)

**Score**: 91/100 ✅
**Verdict**: Ready to merge

**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

## Category Scores

| Category | Score | Status |
|:---------|------:|:-------|
| Simplicity | 90 | ✅ |
| Flexibility | 90 | ✅ |
| Usability | 92 | ✅ |
| Documentation | 93 | ✅ |
| Security | 90 | ✅ |
| Pattern Matching | 90 | ✅ |
| Best Practices | 90 | ✅ |
| General QA | 92 | ✅ |

## Changes Since v1 (82/100)

### P1 Findings — All Fixed

**SECURITY-1 FIXED**: XML escaping requirement now explicit (§5.2). Spec mandates `html/template` or `xml.EscapeText()` for all plist template variables. Path validation required: absolute path matching `^/[^\x00]+$`. Paths hardcoded, not user-configurable.

**SECURITY-2 FIXED**: Input validation section added (§3.2). Safe pattern `^[a-zA-Z0-9_\-/]+$` required. Arguments must be passed as individual `exec.Command` elements — never concatenated. Clear example provided.

### P2 Findings — All Fixed

**QA-1 FIXED**: `installSchedule` disambiguation rule defined (§4.2): "attempt `time.ParseDuration` first; if it fails, parse as cron." Open question #5 resolved to `robfig/cron` v3.

**QA-2 FIXED**: Full service state machine table added with 6 error state transitions (plist exists → overwrite, service running during uninstall → stop first, service not installed → exit 1, stale binary → error, brew not in PATH → exit 1 with PATH guidance). `config reset` TTY-less behavior defined.

**USABILITY-1 FIXED**: Tap-specific upgrade now exclusively uses `brew info --json=v2 --installed`. Explicit note: "Do not use `brew list --formula | grep`".

### P3 Findings — All Fixed

**BESTPRACTICE-1 FIXED**: Cobra now marked as **required** (§5.1). Open question #3 resolved.

**BESTPRACTICE-2 FIXED**: CGO cross-compilation strategy specified (§5.6): separate GitHub Actions runners per architecture, GoReleaser `universal_binaries` for fat binary. Phase 1-2 cross-compile freely (`CGO_ENABLED=0`).

**BESTPRACTICE-3 FIXED**: Log paths defined once with explicit resolution: `~/Library/Logs/brew-auto-maintenance/{out,err}.log`. Cross-referenced from plist template.

**SECURITY-3 FIXED**: Editor resolution order defined: `$VISUAL` → `$EDITOR` → `open -t`. Config path fixed, not user-controllable.

**FLEXIBILITY-1 FIXED**: Config struct comments note `CheckInterval` and `InstallSchedule` require post-unmarshal validation via `Config.Validate()`.

### Additional Observations — All Addressed

- launchd PATH: Spec now notes `EnvironmentVariables` plist key may be needed for non-standard brew locations.
- Exit codes: `check` defines 0/1/2 semantics. Service commands define exit codes in state machine table.
- Concurrent execution: Homebrew lock acknowledged (implicit via its own locking).
- Phase 3 CGO change: Explicitly called out as build requirement change.
- `config reset` non-TTY: Exits 1 with "--force to overwrite" guidance.

### Research File

`docs/research/brew-auto-maintenance.md` (460 lines) — Thorough, well-sourced research covering systray libraries, launchd integration, config management, brew command patterns, and competitive analysis. Properly cross-referenced from the spec.

## Remaining Notes (P4, non-blocking)

- **DOC-1**: Phase 1 deliverables still use shorthand `brew check`/`brew upgrade` instead of full `brew-auto-maintenance check`. Minor — context makes it clear.
- **ci-1 from research**: Open question #1 (`brew outdated --json=v2` exact schema) still listed as open. This will be resolved during Phase 1 implementation.

## Summary

Every P1, P2, and P3 finding from the v1 review has been addressed. The spec is now comprehensive: security requirements are explicit, error behaviors are defined, ambiguities are resolved, and the technical design is well-grounded in the accompanying research. Ready to merge.

---

*Reviewed by Daffy D (qa) — 2026-02-23*
