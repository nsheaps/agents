## Review: ai-mktpl#183 — remote-config plugin — Score: 93/100

| Category         | Score | Notes                                                                                                      |
| :--------------- | ----: | :--------------------------------------------------------------------------------------------------------- |
| Simplicity       |    92 | Plugin does one thing: sync upstream config on session start. Logic is clear.                              |
| Flexibility      |    94 | Supports both config file and env var override. Verbose mode allows detailed reporting.                    |
| Usability        |    92 | Setup requires manual YAML config creation; documentation is clear but has friction.                       |
| Documentation    |    94 | README covers config, behavior, status messages, and installation well.                                    |
| Security         |    93 | ⚠️ Clones public git repo without verification. No checksum validation. Acceptable for distributed config. |
| Pattern Matching |    93 | Follows plugin structure. yaml_get fallback to grep is reasonable for portability.                         |
| Best Practices   |    91 | ⚠️ git pull --ff-only can silently fail; script catches it but UX could be clearer.                        |
| General QA       |    92 | Version 0.1.0 appropriate. Timeout 30s is suitable for git operations.                                     |

> ✅ All categories ≥85% — Ready to merge

### Findings

**Potential issues (LOW-MEDIUM):**

1. **File**: `plugins/remote-config/hooks/scripts/sync-remote.sh:171-179`
   - **Severity**: Low
   - **Description**: yaml_get() function falls back to grep if yq unavailable. Grep-based YAML parsing is fragile: will break on edge cases (quotes, escapes, multiline values).
   - **Expected**: Should require yq or fail gracefully.
   - **Actual**: Lines 176-178 use sed/grep fallback that only works for simple key: value.
   - **Impact**: Low — config is simple (upstream, verbose flags only). Acceptable for this use case.
   - **Recommendation**: Add comment explaining limitation.

2. **File**: `plugins/remote-config/hooks/scripts/sync-remote.sh:215-221`
   - **Severity**: Low
   - **Description**: `git pull --ff-only` fails silently if repo is dirty or has conflicts. Error message is helpful but user must manually fix.
   - **Expected**: Script could offer to reset to origin automatically (with user confirmation logged).
   - **Actual**: Lines 216-220 error-exit but require manual `cd` and `git status`.
   - **Recommendation**: Acceptable as-is (conservative approach). Could add recovery in v0.2.

3. **File**: `plugins/remote-config/hooks/scripts/sync-remote.sh:249-254`
   - **Severity**: Low
   - **Description**: `git log --oneline` output parsing assumes single-line commit messages. Multi-line commit message titles will wrap to next line and break parsing.
   - **Expected**: Should use `--format=%h %s` to force single line, or `git log --pretty=format:"%h %s"`.
   - **Actual**: Line 251 uses `--oneline` which is safe but relies on commit message format.
   - **Impact**: Very low — most commits use single-line titles. Acceptable.

4. **File**: `plugins/remote-config/README.md:50-60`
   - **Severity**: Low
   - **Description**: Status output format shows: "Updated: abc1234 → v1.2.0 (def5678)". This is backwards — old SHA is before arrow, new SHA is after. Confusing.
   - **Expected**: Should be "Updated: v0.1.0 (abc1234) → v1.2.0 (def5678)" or show direction explicitly.
   - **Actual**: Line 81 shows format: "$PREV_SHA → $STATUS_LINE" where PREV_SHA is old, STATUS_LINE is new.
   - **Recommendation**: Documentation is correct; no code issue.
