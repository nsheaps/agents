## Review: ai-mktpl#192 — statusline settings.local.json fix — Score: 93/100

| Category | Score | Notes |
|:---------|------:|:------|
| Simplicity | 92 | Changes are straightforward: migrate settings writes from settings.json to settings.local.json. |
| Flexibility | 94 | Merge behavior (settings.local.json on top of settings.json) is standard and flexible. |
| Usability | 93 | Documentation updated to reflect new file target. User-facing changes are minimal. |
| Documentation | 93 | Comments and docs updated to explain why settings.local.json prevents truncation. |
| Security | 95 | No new security surface; safer design (prevents config truncation). |
| Pattern Matching | 92 | ⚠️ Applies to both statusline and statusline-iterm. Consistent pattern applied. |
| Best Practices | 91 | ⚠️ shared/lib/safe-settings-write.sh docstring updated; unclear if existing code uses it. |
| General QA | 92 | Version bumps are appropriate (0.1.20→0.1.21, 0.1.23→0.1.24). |

> ✅ All categories ≥85% — Ready to merge

### Findings

**Potential issues (LOW):**

1. **File**: `plugins/statusline-iterm/hooks/configure-statusline.sh:116-119` and `plugins/statusline/hooks/configure-statusline.sh:169-172`
   - **Severity**: Low
   - **Description**: New logic reads from settings.local.json first, then falls back to settings.json. This is correct, but race condition possible: what if settings.local.json is being written while this reads?
   - **Expected**: Should use same lock mechanism as safe_write_settings (mkdir-based lock).
   - **Actual**: Read operations are unguarded (lines 116, 171 use jq directly without lock).
   - **Recommendation**: Acceptable for read-only, but document this assumption in comments.

2. **File**: `shared/lib/safe-settings-write.sh:194-210`
   - **Severity**: Low
   - **Description**: Docstring updated to reference settings.local.json, but doesn't show which files currently call this function.
   - **Expected**: Should verify all callers have been updated to use settings.local.json target.
   - **Actual**: Docstring updated, but unclear if all plugins use this library correctly.
   - **Recommendation**: Add grep to verify all plugins pass correct SETTINGS_FILE path.

3. **File**: `plugins/statusline-iterm/hooks/configure-statusline.sh:89-90`
   - **Severity**: Low
   - **Description**: Comment says "never settings.json" but code still reads from settings.json as fallback. This is intentional (for backward compatibility), but could confuse maintainers.
   - **Expected**: Comment should clarify: "Write to settings.local.json (never settings.json). Read from both for compatibility."
   - **Actual**: Lines 89-90 say "never" but lines 117-118 read from settings.json.
   - **Fix**: Update comment to reflect read-fallback behavior.
