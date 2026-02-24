# Review: CI/CD Workflow and Homebrew Distribution — Score: 86/100

| Category | Score | Notes |
|:---------|------:|:------|
| Simplicity | 83 | Workflow is functional but complex. 122 new lines for update-homebrew job, significant gomplate/shell logic. stdlib.sh adds 59 lines of utility code. Overall necessary but dense. |
| Flexibility | 82 | Homebrew formula is templated via gomplate (good). Shell script handles both tmux and non-tmux modes. However, no toggle for Homebrew update (always happens on release), and gum dependency is hardcoded. |
| Usability | 88 | Shell scripts have clear help text. claude-team shows good UX with gum prompts. ct shorthand is convenient. bin/lib/stdlib.sh is well-organized. Dependency on gum/tmux may fail silently if unavailable. |
| Documentation | 85 | Help text in claude-team (lines 246-287) is comprehensive. stdlib.sh functions are self-documenting. However: no README for bin/ directory, no deployment/distribution documentation. |
| Security | 78 | Multiple concerns: gomplate downloads from GitHub without hash verification; Homebrew formula auto-install via --dangerously-skip-permissions (line 414); gum/tmux install via check_and_install (line 329) is unsafe in multi-user environments. |
| Pattern Matching | 84 | Follows existing GitHub Actions patterns. Formula templates align with nsheaps/homebrew-devsetup conventions. Shell scripts use ANSI colors consistently. Minor: release.yaml uses old `qoomon/actions--context` (double dash). |
| Best Practices | 79 | ci-related improvements to test.yaml (lines 150-163), but no integration tests for claude-team itself. gomplate installation (line 54-56) is manual and fragile. Auto-merge retry logic is sound (lines 118-126) but could be abstracted. |
| General QA | 86 | claude-team passes basic checks (--help works per line 180). but: no tests for arg parsing, permission handling, or error paths. Homebrew formula has test do block but it's minimal (just --help). |

> ⚠️ Security: 78% — Below 85% threshold
> ⚠️ Best Practices: 79% — Below 85% threshold

### Findings

**Critical issues (blocking merge):**

1. **Security: Unsafe dependency installation** (Security 78%, High severity)
   - File: `bin/lib/stdlib.sh:507-522`
   - Function `check_and_install` uses `brew install $cmd` without verification
   - **Problem**: In multi-user CI environments, this can install packages with elevated privileges
   - **Risk**: If brew is compromised or formula is malicious, entire CI environment is at risk
   - **Example**: Line 513 runs `bash -c "brew install $cmd || fatal 'Failed'"` with no integrity checks
   - **Recommendation**: Fail loudly if required tools are missing; don't auto-install in CI. Use `--no-interactive` flag to prevent interactive installs.

2. **Security: Gomplate binary download without hash verification** (Security 78%, Medium severity)
   - File: `.github/workflows/release.yaml:53-56`
   - Downloads gomplate from GitHub without SHA256 verification
   - **Current code**: `curl -fsSL https://github.com/.../gomplate_linux-amd64 -o /usr/local/bin/gomplate`
   - **Problem**: No integrity check; HTTPS alone is insufficient for CI
   - **Recommendation**: Download the SHA256SUMS file, verify the binary hash before installing
   - **Example fix**: Use `curl` to fetch SHA256SUMS, then `sha256sum -c` before chmod +x

3. **Security: --dangerously-skip-permissions in production script** (Security 78%, High severity)
   - File: `bin/claude-team:414`
   - Uses `--dangerously-skip-permissions` when launching claude via tmux
   - **Problem**: This bypasses all permission checks for every claude command executed
   - **Context**: Line 396 sets permission_mode="delegate", which is already permissive
   - **Risk**: User script can execute arbitrary file operations without oversight
   - **Recommendation**: Use `--permission-mode delegate` instead of `--dangerously-skip-permissions`. They serve different purposes; dangerous-skip is for unattended CI, not user scripts.

**High-priority issues (needs fixes before merge):**

4. **Missing error handling for missing gum/tmux** (Usability 88%, Best Practices 79%)
   - File: `bin/lib/stdlib.sh:512-514`
   - If `gum spin` fails partway through install, the script continues silently
   - Line 513: `gum spin --spinner dot --title "Installing..." -- bash -c "brew install..."` 
   - If gum is not installed, command fails but script doesn't exit
   - **Recommendation**: Check for gum/tmux explicitly before attempting interactive features

5. **No tests for claude-team script** (General QA 86%)
   - File: `.github/workflows/test.yaml` now lints bin/* (good), but no functional tests
   - Homebrew formula test (line 180) only runs `--help`, doesn't test actual functionality
   - **Missing**: Test `claude-team --mode auto --no-interactive` to verify flags work
   - **Missing**: Test error paths (invalid mode, missing team, etc.)
   - **Recommendation**: Add test suite for bin/claude-team and bin/ct

6. **Homebrew formula missing dependencies** (Usability 88%)
   - File: `Formula/claude-team.rb.gotmpl:205-208`
   - Installs `bin/claude-team`, `bin/ct`, `bin/lib/stdlib.sh`
   - But doesn't declare that `claude` CLI itself must be installed
   - Formula doesn't check for or install claude itself
   - **Problem**: User can `brew install claude-team` but still fail if claude is not installed
   - **Recommendation**: Document this as a requirement, or add `depends_on 'claude'` if available as formula

**Medium-priority issues:**

7. **Release workflow fragility** (Pattern Matching 84%)
   - File: `.github/workflows/release.yaml:20`
   - Uses `qoomon/actions--context@v4` (deprecated action, note double dashes)
   - This action may not be maintained
   - **Recommendation**: Replace with `github.context` from the GitHub Actions environment directly (no external action needed)

8. **Auto-merge could deadlock** (Pattern Matching 84%, Best Practices 79%)
   - File: `.github/workflows/release.yaml:118-126`
   - Retries auto-merge with exponential backoff (good design)
   - But if CI checks themselves are slow to finish, all 5 attempts could timeout
   - **Recommendation**: Document the retry strategy and check timing expectations

9. **Claude script args pass-through unvalidated** (Security 78%)
   - File: `bin/claude-team:316-322`
   - CLAUDE_ARGS silently pass through to claude via exec (line 416)
   - If user passes `--dangerously-skip-permissions`, it gets executed
   - **Problem**: No validation of which args are safe to pass
   - **Recommendation**: Use allowlist for which claude flags can be passed through, or validate user args

### Verdict

This is solid infrastructure work with good UX (claude-team, gum integration). However, there are three **security gaps** that must be addressed before merge:

1. Fix unsafe dependency installation in stdlib.sh
2. Add gomplate SHA256 verification
3. Use `--permission-mode` instead of `--dangerously-skip-permissions`

The code is not fundamentally broken — it works for the happy path — but security edges need hardening for production use.

**Recommendation**: 
- **REQUEST CHANGES** on security issues (1-3 above)
- **Approve** once security fixes are applied
- **Track separately**: Missing test coverage (issue #XXX) and Homebrew dependency doc (issue #YYY)

---

**Review Date**: 2026-02-23  
**Reviewer**: Daffy D (qa)  
**Confidence**: High (549 lines all reviewed; security analysis done against best practices)
