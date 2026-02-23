# PR #164 CI Analysis

**Date**: 2026-02-18
**Author**: Bugs Bunny (Software Engineer)
**PR**: https://github.com/nsheaps/ai-mktpl/pull/164
**Branch**: fix/statusline-direct-write

## CI Check Results (as of commit ca42d6f9)

| Check                       | Status   | Notes                                                                |
| --------------------------- | -------- | -------------------------------------------------------------------- |
| check-version-files         | PASS     | Was failing due to accidental plugin.json edit, reverted in ca42d6f9 |
| lint                        | PASS     |                                                                      |
| preview-version-bump        | PASS     |                                                                      |
| validate                    | **FAIL** | Pre-existing bug on main (see below)                                 |
| bump-and-update-marketplace | SKIPPING | Expected — only runs on main                                         |
| claude-review               | SKIPPING | Expected — conditional                                               |

## Validate Failure: Pre-existing on Main

**Failing plugin**: `plugins/plugin-management/.claude-plugin/plugin.json`

**Error**:

```
✘ Found 1 error:
  ❯ author: Invalid input: expected object, received string
✘ Validation failed
```

**Current value on main** (line 5 of `plugins/plugin-management/.claude-plugin/plugin.json`):

```json
"author": "nsheaps"
```

**Expected format** (per schema, matching all other plugins):

```json
"author": {
  "name": "Nathan Heaps",
  "email": "nsheaps@gmail.com",
  "url": "https://github.com/nsheaps"
}
```

### Evidence This Is Pre-existing on Main

1. The file `plugins/plugin-management/.claude-plugin/plugin.json` on our branch is **identical to main** (after revert in ca42d6f9).

2. `git diff origin/main -- plugins/plugin-management/.claude-plugin/plugin.json` shows **no differences** — we haven't changed this file.

3. CI on main doesn't run the `validate` workflow (only "Claude Agent Trigger" runs on main pushes, which all skip). So this bug has been silently present on main without being caught.

4. The validate check runs `claude plugin validate` against ALL plugin.json files in the repo, including ones not modified by the PR. Our PR only modified files in `plugins/statusline/` and `plugins/statusline-iterm/` — both of which pass validation individually.

### Why We Can't Fix It in This PR

The `check-version-files` CI check rejects ANY changes to `plugin.json` files in PRs:

```bash
CHANGED_VERSION_FILES=$(git diff --name-only "origin/main..HEAD" -- \
  'plugins/*/.claude-plugin/plugin.json' \
  '.claude-plugin/marketplace.json' \
)
if [ -n "$CHANGED_VERSION_FILES" ]; then
  echo "❌ ERROR: Version files should not be manually changed in PRs!"
  exit 1
fi
```

I attempted the fix (commit `3d90fdd6`) but had to revert (commit `ca42d6f9`) because this guard triggered.

### Recommended Fix

1. Push the author field fix directly to main (bypassing PR CI), OR
2. Modify `check-version-files` to only check the `version` field rather than any change to plugin.json, OR
3. Create a separate PR with a CI override label

## Our PR's Changes

The statusline fix commits only touch:

- `plugins/statusline/hooks/configure-statusline.sh`
- `plugins/statusline-iterm/hooks/configure-statusline.sh`
- `plugins/shared/lib/safe-settings-write.sh` (new)
- `plugins/statusline/lib/safe-settings-write.sh` (symlink, new)
- `plugins/statusline-iterm/lib/safe-settings-write.sh` (symlink, new)

None of these affect the validate failure.
