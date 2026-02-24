# PR Review: dotfiles#8 (Full Review)

**Score**: 82/100
**Verdict**: Needs fixes

**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

## Category Scores

| Category | Score | Status |
|:---------|------:|:-------|
| Simplicity | 88 | PASS |
| Flexibility | 80 | FAIL |
| Usability | 85 | PASS |
| Documentation | 78 | FAIL |
| Security | 82 | FAIL |
| Pattern Matching | 85 | PASS |
| Best Practices | 80 | FAIL |
| General QA | 78 | FAIL |

## Findings

### CI Workflow (`check.yaml`)

- **ci-1** (P2): The `find-bash` step uses `grep -qE '(bash|^#!/bin/sh)'` to match shebangs (line 30). The pattern `(bash|^#!/bin/sh)` matches `bash` ANYWHERE in the first line (not just the shebang), so a file whose first line contains the word "bash" in a comment would be matched. Additionally, `^#!/bin/sh` is anchored, but `bash` is not -- a file with shebang `#!/usr/bin/env python` and a comment containing "bash" on line 1 would match. The anchor `^` also doesn't work as expected here because `echo "$shebang"` pipes into grep, where `^` matches start of line anyway. The real concern is the unanchored `bash` match. This is low-risk in a personal dotfiles repo, but it's a correctness issue in the linting pipeline.

  **File**: `.github/workflows/check.yaml:30`
  **Expected**: Pattern should anchor to shebang format, e.g., `'^#!.*(bash|/sh)$'`
  **Actual**: Unanchored `bash` matches anywhere in the first line.

- **ci-2** (P2): The `find-bash` step misses `_home/interactive.d/*.sh` files entirely. The first loop finds `*.sh` files but then checks for bash/sh shebangs -- these files have `#!/usr/bin/env zsh` shebangs (as noted in the `.shellcheckrc` comment), so they're correctly excluded from ShellCheck. However, the workflow does NOT explicitly document or handle the exclusion. If someone later adds a bash-shebang `.sh` file in `_home/interactive.d/`, it WOULD be picked up by the first `find` loop. This is actually correct behavior, but the comment on line 26 saying "Collect .sh files with bash shebangs" could be clearer that zsh files are intentionally filtered out. Minor documentation concern, not a functional defect.

  **File**: `.github/workflows/check.yaml:26-33`
  **Severity adjusted**: P4 (documentation clarity)

- **ci-3** (P2): The `shfmt` step hardcodes `-i 2 -ci` (line 66) rather than reading from `.editorconfig`. The `shfmt` tool natively reads `.editorconfig` if no flags are passed. Hardcoding these values means if `.editorconfig` changes, the workflow must also change. This creates a maintenance burden and a potential for drift.

  **File**: `.github/workflows/check.yaml:66`
  **Expected**: `shfmt -d $bash_files` (let shfmt read `.editorconfig`)
  **Actual**: `shfmt -d -i 2 -ci $bash_files` (hardcoded formatting options)

- **ci-4** (P3): The workflow triggers on `push` only (line 10), with no `pull_request` trigger. This means PRs from forks or PRs in general won't get status checks until after merge to the target branch. For a personal dotfiles repo this is acceptable, but adding `pull_request:` would provide pre-merge validation.

  **File**: `.github/workflows/check.yaml:10`

- **ci-5** (P1): The concurrency group references `github.event.pull_request.number` (line 13), but the workflow only triggers on `push` -- there is no `pull_request` trigger. This expression will always evaluate to empty on push events, making the fallback `( github.ref == 'refs/heads/main' && github.sha || github.ref )` always used. The PR number reference is dead code. Not harmful, but misleading and suggests a copy-paste from a template without adaptation.

  **File**: `.github/workflows/check.yaml:13`

- **ci-6** (P2): The `editorconfig-checker` step (lines 69-72) has two steps: one that installs the action (`uses: editorconfig-checker/action-editorconfig-checker@main`) and one that runs it (`run: editorconfig-checker`). Using `@main` for the action pins to a mutable branch rather than a SHA or release tag. This is a supply-chain risk. For a personal dotfiles repo the risk is low, but it contradicts best practices.

  **File**: `.github/workflows/check.yaml:69`
  **Expected**: Pin to a SHA or at minimum a version tag, e.g., `@v2`
  **Actual**: `@main` (mutable reference)

- **ci-7** (P3): The unquoted `$bash_files` on lines 58 and 66 relies on word-splitting to pass multiple files. This works but will break on filenames containing spaces. In a dotfiles repo this is very unlikely, but ShellCheck itself would flag this pattern (SC2086). The CI linting pipeline has the same pattern it would flag in user code.

  **File**: `.github/workflows/check.yaml:58,66`

### ShellCheck Configuration (`.shellcheckrc`)

- **sc-1** (P3): `disable=SC2034` globally suppresses "variable appears unused" warnings. This is a broad suppression. While the justification (exported variables for child shells) is valid, a more targeted approach would be to add `# shellcheck disable=SC2034` inline at each site. Global suppression means genuinely unused variables will never be caught.

  **File**: `.shellcheckrc:12-13`

- **sc-2** (P4): The `.shellcheckrc` sets `shell=bash` as the default dialect. This is correct and well-documented with the comment explaining zsh exclusion.

  No defect -- noted as positive.

### shfmt Formatting Changes

- **fmt-1** (P4): All changes in `_home/interactive.d/open-iterm.sh` are pure indentation reformatting (4-space to 2-space). I reviewed every hunk: no behavioral changes. The `<<<` operator change on line 306 (`done <<< "$sessions"` to `done <<<"$sessions"`) is also formatting-only -- both are equivalent in bash.

  No defect -- confirmed formatting-only.

- **fmt-2** (P4): The redirect operator spacing changes in `bin/wire` (e.g., `> "$target"` to `>"$target"`, `>> "$target"` to `>>"$target"`) are formatting-only per `shfmt` style. No behavioral change.

  No defect -- confirmed formatting-only.

- **fmt-3** (P4): The case pattern spacing changes in `bin/wire` (e.g., `r|R)` to `r | R)`) are formatting-only per `shfmt` style.

  No defect -- confirmed formatting-only.

- **fmt-4** (P4): Trailing blank line removals in `_home/bash_profile` and `_home/bashrc` -- formatting-only.

  No defect.

### ShellCheck Fixes (`bin/wire`)

- **wire-1** (P4): Line 369-370 adds `# shellcheck disable=SC2088` with comment "Tilde is intentional for display, not expansion." This is correct. The variable `display_path="~/$home_subdir/$rel_path"` uses a literal tilde for display purposes, and SC2088 warns about tilde not expanding in quotes. The suppression is well-justified and properly documented.

  No defect -- correct fix.

- **wire-2** (P4): Line 432 changes `${file#$repo_path/}` to `${file#"$repo_path"/}`. This fixes SC2295 (quoting the pattern in `${var#pattern}`). In bash, quoting the pattern in `#` causes the pattern to be treated literally rather than as a glob. Since `$repo_path` is a filesystem path that could theoretically contain glob characters (`*`, `?`, `[`), quoting it is the safer and more correct behavior. This is a genuine correctness improvement.

  No defect -- correct fix, actually improves robustness.

### Line Continuation Change (`rc.d/00_setup_symlinks.sh`)

- **rc-1** (P4): Lines 444-447 change the line continuation style from trailing backslash to having `||` at the end of the line. Both are valid bash. The `shfmt` preference for operator-at-end-of-line is arguably more readable (you see the continuation operator before the line break).

  No defect -- formatting-only.

## Summary

The PR accomplishes its stated goal: adding CI linting (ShellCheck, shfmt, editorconfig-checker) and applying consistent formatting to existing scripts. The formatting changes are all verified as behavior-preserving. The two shellcheck fixes in `bin/wire` are both correct and well-documented.

The main concerns are in the CI workflow:

1. **ci-5 (P1)**: Dead `pull_request.number` reference in concurrency group -- misleading, suggests incomplete template adaptation.
2. **ci-1 (P2)**: Unanchored shebang matching could produce false positives.
3. **ci-3 (P2)**: Hardcoded shfmt flags duplicate what `.editorconfig` already provides.
4. **ci-6 (P2)**: Action pinned to `@main` instead of a SHA/tag.

None of these are blocking for a personal dotfiles repo, but ci-5 is misleading enough and ci-3 creates enough maintenance risk that I would want them addressed before merge.

**Recommendation**: Fix ci-5 (remove dead PR reference from concurrency group) and ci-3 (let shfmt read .editorconfig), then this is ready to merge. The P2 items ci-1 and ci-6 are worth addressing but could be follow-ups.
