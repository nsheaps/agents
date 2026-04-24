# PR Review: git-wt#11 — P1 Consistency Pass

**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23
**PR**: nsheaps/git-wt#11
**Reference**: dotfiles#8 (merged baseline pattern)

---

## Summary

This PR adds `.editorconfig`, `.shellcheckrc`, `.github/workflows/check.yaml`, mise task definitions, and applies shfmt formatting to existing shell scripts. It is a consistency pass intended to match the pattern established in dotfiles#8.

---

## 1. Simplicity — 90%

The PR is appropriately scoped. Config files are minimal, workflow is straightforward, and mise tasks are clean. The "find bash scripts" step in the CI workflow (lines 53-71 of the diff) is more complex than strictly necessary — a hardcoded file list like `mise.toml` uses would be simpler and more predictable — but it does handle extensibility for future scripts.

| ID           | Severity | Finding                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| simplicity-1 | P4       | The CI workflow dynamically discovers bash scripts via `find` + shebang inspection, while `mise.toml` hardcodes the file list (`bin/git-wt test/cli-test.sh`). This creates two sources of truth for "which files to check." If a new script is added, mise tasks must be manually updated but CI will auto-discover. Minor inconsistency, not blocking. |

---

## 2. Flexibility — 92%

Good use of `.editorconfig` as the single source of truth for shfmt settings. The `shfmt -d $bash_files` call in CI does NOT pass hardcoded flags — it relies on `.editorconfig`. This matches the expected pattern and avoids the P2 found in dotfiles#8 v1.

No findings.

---

## 3. Usability — 90%

Mise tasks are well-structured: `check` depends on `lint`, `fmt-check`, and `test`. The `fmt` task for auto-fixing is a nice addition. Task descriptions are clear.

| ID          | Severity | Finding                                                                                                                                                                                                                                                      |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| usability-1 | P4       | `mise run check` prints "All checks passed" via its own `run` command, but the message will appear even if one of the `depends` tasks fails (depending on mise's error handling). The `run` line is redundant if mise stops on dependency failure. Low risk. |

---

## 4. Documentation — 88%

The `.shellcheckrc` has inline comments explaining each directive. The `.editorconfig` has a comment noting shfmt reads `[*.sh]` properties. The workflow file has a comment `# -d shows diff; indent settings sourced from .editorconfig`. All good.

| ID     | Severity | Finding                                                                                                                                                                              |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| docs-1 | P4       | No README or CONTRIBUTING update mentioning the new `mise run check` / `mise run fmt` commands. Users of the repo may not know these tasks exist. Not blocking for a consistency PR. |

---

## 5. Security — 95%

- No secrets or credentials in any file.
- No hardcoded paths that should not be there.
- Workflow runs on `push` only (no `pull_request_target` risk).
- No explicit `permissions` block — defaults to read-only for `push` events, which is appropriate.
- The `editorconfig-checker/action-editorconfig-checker@main` action pins to `main` branch, not a SHA. This is a minor supply-chain risk but acceptable for a low-privilege linting action.

| ID         | Severity | Finding                                                                                                                                                                                          |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| security-1 | P3       | `editorconfig-checker/action-editorconfig-checker@main` is pinned to a branch, not a commit SHA. Best practice is SHA pinning for third-party actions. Low-privilege action, so risk is limited. |

---

## 6. Pattern Matching (vs dotfiles#8) — 93% [CRITICAL CATEGORY]

This is the most important category for a consistency PR. Checking each expected element:

### Concurrency group — PASS

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref == 'refs/heads/main' && github.sha || github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

Uses `github.ref`/`github.sha`. Does NOT use `pull_request.number`. This matches the corrected dotfiles#8 pattern. The P1 bug from dotfiles#8 v1 is NOT present here.

### .editorconfig `[*.sh]` section — PASS

```ini
[*.sh]
switch_case_indent = true
```

Present and correct.

### .shellcheckrc — PASS

Contains `shell=bash`, disables SC1091 and SC2034. Matches project-standard directives.

### shfmt uses .editorconfig (no hardcoded flags) — PASS

CI step: `shfmt -d $bash_files` — no `-i`, `-ci`, or other formatting flags. The P2 from dotfiles#8 v1 is avoided.

### mise.toml tasks — PASS

Contains `lint`, `fmt`, `fmt-check`, `test`, and `check` tasks.

### Workflow triggers — DEVIATION

```yaml
on:
  push:
```

Only `push` trigger, no `pull_request`. This means PRs from forks will not get CI checks, and PR status checks won't appear until after merge to a branch. Need to verify if dotfiles#8 also uses push-only or includes `pull_request`.

| ID        | Severity | Finding                                                                                                                                                                                                                                                                                                                         |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pattern-1 | P3       | Workflow triggers on `push` only — no `pull_request` trigger. PRs will only show check results if the branch is pushed to the same repo (not forks). Verify this matches dotfiles#8's trigger configuration. If dotfiles#8 also uses push-only, this is consistent; if dotfiles#8 includes `pull_request`, this is a deviation. |
| pattern-2 | P4       | No explicit `permissions` block in the workflow. Defaults are fine for `push`-triggered read-only jobs, but dotfiles#8 may have an explicit block. Verify for consistency.                                                                                                                                                      |

---

## 7. Best Practices — 88%

### Shell script changes — formatting only — PASS

Reviewed every hunk in `bin/git-wt` and `test/cli-test.sh`:

- Whitespace changes: `"$FOO"  # comment` -> `"$FOO" # comment` (extra space removed before inline comments)
- Redirect spacing: `> file` -> `>file`, `< /dev/null` -> `</dev/null` — standard shfmt style
- Case statement indentation: case body de-indented one level — this is the `switch_case_indent = true` behavior from shfmt via `.editorconfig`
- Variable declaration split: `local var=$(cmd)` -> `local var\nvar=$(cmd)` — this is a shellcheck-recommended pattern (SC2155) to avoid masking return codes
- `shellcheck disable` pragmas added for SC2016 (fzf preview) and SC2001 (sed usage) — appropriate targeted suppression

No logic changes detected. All changes are formatting or shellcheck compliance. PASS.

### SC2034 disable in .shellcheckrc — worth scrutiny

SC2034 ("variable appears unused") is disabled globally. This can hide real bugs. A per-file disable would be more precise.

| ID   | Severity | Finding                                                                                                                                                                                                                                          |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| bp-1 | P3       | SC2034 is disabled globally in `.shellcheckrc`. This suppresses "unused variable" warnings across all scripts, which can mask real bugs. Consider using per-file `# shellcheck disable=SC2034` only where needed, rather than a global disable.  |
| bp-2 | P4       | The CI workflow uses `find` with command substitution in a for loop (`for f in $(find ...)`). This breaks on filenames with spaces. Given this is a controlled repo with known filenames, risk is negligible, but it is not best-practice shell. |

---

## 8. General QA — 90%

### Files changed

- `.editorconfig` — new, correct
- `.github/workflows/check.yaml` — new, correct structure
- `.shellcheckrc` — new, correct
- `bin/git-wt` — formatting only, no logic changes (verified line by line)
- `mise.toml` — updated lint task, added fmt/fmt-check/check tasks
- `test/cli-test.sh` — formatting only (`> ` -> `>` on one line)

### Regression risk

Zero logic changes. All modifications to `bin/git-wt` and `test/cli-test.sh` are whitespace/formatting. No regression risk from the script changes themselves.

### CI workflow correctness

- ShellCheck and shfmt steps are gated on `steps.find-bash.outputs.files != ''` — correct guard
- EditorConfig checker runs unconditionally — appropriate since `.editorconfig` is always present

| ID   | Severity | Finding                                                                                                                                                                                                                                                                          |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| qa-1 | P4       | The `find-bash` step in CI checks for `#!/bin/sh` shebangs in addition to `bash` shebangs, but `.shellcheckrc` sets `shell=bash`. A `#!/bin/sh` script checked with `shell=bash` may produce incorrect warnings. Currently no `#!/bin/sh` scripts exist, so this is theoretical. |

---

## Score Summary

| Category            | Score | Key Issue                                     |
| ------------------- | ----- | --------------------------------------------- |
| 1. Simplicity       | 90%   | Two sources of truth for file lists (P4)      |
| 2. Flexibility      | 92%   | Clean                                         |
| 3. Usability        | 90%   | Minor redundancy in check task (P4)           |
| 4. Documentation    | 88%   | No README mention of new tasks (P4)           |
| 5. Security         | 95%   | Action pinned to branch not SHA (P3)          |
| 6. Pattern Matching | 93%   | Push-only trigger — verify vs dotfiles#8 (P3) |
| 7. Best Practices   | 88%   | Global SC2034 disable (P3), find+loop (P4)    |
| 8. General QA       | 90%   | Theoretical sh/bash mismatch (P4)             |

**Overall Score: 91%** ✅

No P1 or P2 findings. The P1 concurrency bug from dotfiles#8 v1 is NOT present. The P2 hardcoded-shfmt-flags issue from dotfiles#8 v1 is NOT present. Both were correctly avoided.

---

## Verdict: APPROVE

**Confidence**: High. This is a clean consistency pass. All critical pattern elements from dotfiles#8 are present and correct. No logic changes to existing scripts. No P1 or P2 defects.

**Recommended before merge** (non-blocking):

- **pattern-1 (P3)**: Confirm push-only trigger matches dotfiles#8. If dotfiles#8 includes `pull_request`, add it here for consistency.
- **bp-1 (P3)**: Consider narrowing SC2034 to per-file disables.
- **security-1 (P3)**: Consider SHA-pinning the editorconfig-checker action.

---

## Finding Index

| ID           | Severity | Category       | Summary                                                       |
| ------------ | -------- | -------------- | ------------------------------------------------------------- |
| simplicity-1 | P4       | Simplicity     | Dual file-list source of truth (CI dynamic vs mise hardcoded) |
| usability-1  | P4       | Usability      | `check` task `run` line may be redundant                      |
| docs-1       | P4       | Documentation  | No README/CONTRIBUTING mention of mise tasks                  |
| security-1   | P3       | Security       | editorconfig-checker action pinned to branch, not SHA         |
| pattern-1    | P3       | Pattern        | Push-only trigger — verify vs dotfiles#8                      |
| pattern-2    | P4       | Pattern        | No explicit permissions block — verify vs dotfiles#8          |
| bp-1         | P3       | Best Practices | SC2034 globally disabled in .shellcheckrc                     |
| bp-2         | P4       | Best Practices | `for f in $(find ...)` breaks on spaces in filenames          |
| qa-1         | P4       | General QA     | `#!/bin/sh` detection + `shell=bash` shellcheckrc mismatch    |
