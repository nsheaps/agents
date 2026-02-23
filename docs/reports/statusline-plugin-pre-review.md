# Statusline Plugin Pre-Review: settings.json Interaction Analysis

Prepared by Wile E. Coyote (AI Agent Engineer) ahead of reviewing Bugs' fix for Task #219.

---

## Key Files That Modify settings.json

| Plugin           | File                                                     | Hooks                          | Lock Strategy   |
| ---------------- | -------------------------------------------------------- | ------------------------------ | --------------- |
| statusline       | `plugins/statusline/hooks/configure-statusline.sh`       | SessionStart, UserPromptSubmit | mkdir (POSIX)   |
| statusline-iterm | `plugins/statusline-iterm/hooks/configure-statusline.sh` | SessionStart, UserPromptSubmit | flock           |
| sync-settings    | `plugins/sync-settings/hooks/sync-settings.py`           | SessionStart only              | Python atomic   |
| tmux-subagent    | `plugins/tmux-subagent/scripts/launch-subagent.sh`       | N/A                            | None (isolated) |

## Known Bug History

- **Issue #161**: settings.json blanking race condition
- **Commit 5e0005bb**: Fix attempt (tmp+mv → direct write)
- **PR #164**: Additional fix attempt — still reported as happening

## Current Write Pattern (post-fix)

Both statusline plugins now:

1. Capture jq output to variable first
2. Validate non-empty and valid JSON
3. Write with `printf '%s\n' "$content" > "$SETTINGS_FILE"`

## Lock Differences

- **statusline**: `mkdir` lock with 3s timeout (30 retries × 0.1s), stale detection at 10s
- **statusline-iterm**: `flock -w 3` with file descriptor 9

## Teammate Handling

Both plugins check `CLAUDE_CODE_PARENT_SESSION_ID` and skip entirely for teammates. This prevents 7+ simultaneous hook executions.

## Race Condition Risks to Watch

1. **Hook frequency**: UserPromptSubmit fires on every prompt — high frequency
2. **Cross-plugin collision**: statusline and sync-settings could run simultaneously if triggered by same event
3. **Validation gap**: Checks non-empty + valid JSON, but not that all original keys survived
4. **jq silent failures**: Errors redirected to /dev/null — could mask issues

## Review Focus Areas

1. Does the lock mechanism actually serialize ALL writers (across plugins)?
2. Is the validation sufficient to prevent data loss?
3. What happens if a process dies mid-write (lock held, file partially written)?
4. Are there timing windows between read and lock acquisition?
5. Does jq preserve unrelated settings.json keys?

## Artifacts to Review

- Commit `5e0005bb` — the race condition fix
- Issue `nsheaps/ai-mktpl#161` — original bug report
- PR `nsheaps/ai-mktpl#164` — additional fix attempt
- `plugins/statusline/hooks/configure-statusline.sh`
- `plugins/statusline-iterm/hooks/configure-statusline.sh`
