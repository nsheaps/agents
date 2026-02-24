# PR Review: agent-team#78

**Score**: 79/100 ⚠️
**Verdict**: Fix then merge

## Category Scores

| Category         | Score | Status |
|:-----------------|------:|:-------|
| Simplicity       |    82 | ⚠️     |
| Flexibility      |    85 | ✅     |
| Usability        |    85 | ✅     |
| Documentation    |    80 | ⚠️     |
| Security         |    72 | ⚠️     |
| Pattern Matching |    82 | ⚠️     |
| Best Practices   |    72 | ⚠️     |
| General QA       |    70 | ⚠️     |

*Five categories below 85%; score capped at 94, weighted average is 79.*

## Findings

### security-1: `gomplate` installed via `curl | chmod +x` with no checksum verification (P1)

**File**: `.github/workflows/release.yaml:55-56`
**Description**: The workflow installs `gomplate` by downloading a binary directly from GitHub releases with `curl -fsSL ... -o /usr/local/bin/gomplate && chmod +x`. There is no SHA256 or signature verification of the downloaded binary. If the download URL is compromised (e.g., via a supply chain attack or DNS poisoning), an attacker could inject arbitrary code into the release pipeline. This is a CI/CD pipeline that creates Homebrew formula PRs with a GitHub App token — a compromised binary here could write malicious formula content to the downstream repo.
**Expected**: Either pin gomplate via mise/tool manifest with hash verification, use `gh release download` with a specific version pinned, or verify the binary checksum after download before executing.
**Actual**: `curl -fsSL https://github.com/hairyhenderson/gomplate/releases/latest/download/gomplate_linux-amd64 -o /usr/local/bin/gomplate` — no pinned version, no checksum.
**Steps to reproduce**: Review `.github/workflows/release.yaml` lines 54-56.

### security-2: Homebrew repo cloned without a pinned ref; any branch changes affect the formula (P3)

**File**: `.github/workflows/release.yaml:51-52`
**Description**: `gh repo clone nsheaps/homebrew-devsetup homebrew-devsetup` clones at the default branch HEAD at the time of execution. There is no `--branch` flag or explicit ref pinned. While this is the homebrew tap repo (not a third-party dependency), it means any concurrent change to the tap's main branch could cause a race condition or unexpected conflict if the automation runs simultaneously with a manual change.
**Expected**: Either pin the clone to a specific ref or accept the risk explicitly in a comment.
**Actual**: Clones at HEAD with no pinning.
**Steps to reproduce**: Review `.github/workflows/release.yaml` line 51-52.

### best-practices-1: `GITHUB_JOB_URL` env var referenced but never set (P2)

**File**: `.github/workflows/release.yaml:82`
**Description**: The `Create PR to update formula` step sets `JOB_URL: ${{ env.GITHUB_JOB_URL }}` in the `env` block, then uses `${JOB_URL}` in the PR body. `GITHUB_JOB_URL` is not a built-in GitHub Actions environment variable. The actual job URL can be constructed from `${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}/jobs/${{ github.job }}` or obtained from the `qoomon/actions--context` action (which is already used in the `Get job context` step). The PR body will contain an empty `JOB_URL` field for every release.
**Expected**: Either use the `steps.context.outputs.job_url` from the already-present `qoomon/actions--context` step, or construct the URL from standard GitHub Actions variables.
**Actual**: `JOB_URL: ${{ env.GITHUB_JOB_URL }}` — `GITHUB_JOB_URL` is not set anywhere and will be empty.
**Steps to reproduce**: Check GitHub Actions documentation for available default environment variables; `GITHUB_JOB_URL` is not listed. The `context` step output (`steps.context.outputs`) is fetched but never used.

### best-practices-2: Shell lint check in CI uses `bash -n` only — this does NOT validate subshell behavior, variable expansions, or runtime errors (P3)

**File**: `.github/workflows/test.yaml:136-148` and `mise.toml:530-546`
**Description**: The lint step added to both CI and the mise task uses `bash -n` to syntax-check shell scripts. `bash -n` only checks for syntax errors — it does not catch unbound variable references, command-not-found errors, failed pipelines, or logic errors. Given that `bin/claude-team` uses `set -euo pipefail` (strict mode) and depends on `stdlib.sh`, unbound variables would be caught at runtime but not by `bash -n`. The PR description implies this is a lint step, but it's actually only a parse check.
**Expected**: Either add `shellcheck` for proper static analysis, or add a comment in both the CI step and the mise task clarifying that this is a parse-only check, not a full lint.
**Actual**: `bash -n` is described as "Lint shell scripts" in CI and "Shell script syntax check" in mise, suggesting more coverage than it provides.
**Steps to reproduce**: Review `.github/workflows/test.yaml` line 136 (`name: Lint shell scripts`) and `mise.toml` line 530 (`# Shell script syntax check`).

### best-practices-3: `bin/claude-team` duplicates `stdlib.sh` functions rather than sourcing the existing library (P2)

**File**: `bin/lib/stdlib.sh` (new, in PR#78) vs. `/Users/nathan.heaps/src/nsheaps/agent-team/bin/lib/stdlib.sh` (existing)
**Description**: This PR introduces a new `bin/lib/stdlib.sh` that is a partial copy of the existing `bin/lib/stdlib.sh`. The new file (197-522 in the diff) defines `error`, `warn`, `fatal`, `hint`, `success`, `info`, and `check_and_install` — all of which already exist in the canonical `bin/lib/stdlib.sh`. The `bin/claude-team` script sources `"$SCRIPT_DIR/lib/stdlib.sh"` which will resolve to the existing full stdlib, not the new partial one. However, the PR adds a second partial stdlib file alongside the existing one. This creates two `stdlib.sh` files with diverging implementations: the existing one has more functions (`up_next`, `debug`, `dryrun`, `retry`, `debounce`, `spinner`, `colorize`, `find_up`, etc.) that the new one lacks.
**Expected**: `bin/claude-team` should source the existing `bin/lib/stdlib.sh` directly. No new partial stdlib file should be introduced. The new `bin/lib/stdlib.sh` in the diff is identical in path to the existing file and will overwrite it.
**Actual**: The diff adds `bin/lib/stdlib.sh` as a new file, but this path already exists in the repo. The new version strips out ~300 lines of functions from the existing stdlib. This will cause regressions in any script that depends on the removed functions.
**Steps to reproduce**: Compare the new `bin/lib/stdlib.sh` (diff lines 459-522) against `/Users/nathan.heaps/src/nsheaps/agent-team/bin/lib/stdlib.sh` (existing). Functions `up_next`, `debug`, `dryrun`, `retry`, `debounce`, `spinner`, `colorize`, `find_up`, `find_files`, `required`, `sync_directory`, `create_dir_symlink`, and `realpath.*` are all removed.

### general-qa-1: Formula `agent-team.rb.gotmpl` installs `bin/*` (all files) but `bin/lib/` is a directory (P2)

**File**: `Formula/agent-team.rb.gotmpl:16`
**Description**: The formula uses `bin.install Dir['bin/*']` which installs everything directly under `bin/`, including directories. `bin/lib/` is a subdirectory — `Dir['bin/*']` in Ruby includes directories. Homebrew's `bin.install` with a directory argument will attempt to install the directory itself as a binary, which will either fail or install incorrectly. The `claude-team.rb.gotmpl` formula handles this correctly by explicitly installing `bin/claude-team`, `bin/ct`, and `(bin/'lib').install 'bin/lib/stdlib.sh'`. The `agent-team` formula should not use the glob form.
**Expected**: `agent-team.rb.gotmpl` should explicitly list each binary to install, or use a glob that excludes `lib/`, similar to how `claude-team.rb.gotmpl` is structured.
**Actual**: `bin.install Dir['bin/*']` will attempt to install `bin/lib/` as a binary.
**Steps to reproduce**: Review `Formula/agent-team.rb.gotmpl` line 16. `bin/lib/` exists as a subdirectory. `Dir['bin/*']` in Ruby returns all entries including directories.

### general-qa-2: Homebrew test block in both formulas tests only `claude-team --help`; `agent-team` installs more scripts that go untested (P3)

**File**: `Formula/agent-team.rb.gotmpl:19-21` and `Formula/claude-team.rb.gotmpl:22-24`
**Description**: Both formula test blocks run `assert_match 'claude-team', shell_output("#{bin}/claude-team --help 2>&1")`. The `agent-team` formula (via `Dir['bin/*']`) also installs `run-claude-team-persistent`, `run-claude-team-ephemeral`, and `agent-launch.ts`. None of these are tested. If any of those binaries are broken in the installed state, Homebrew's `brew test agent-team` would pass anyway.
**Expected**: The `agent-team` formula test block should include at minimum a `--help` or `--version` invocation for the other installed binaries.
**Actual**: Only `claude-team --help` is tested.
**Steps to reproduce**: See `Formula/agent-team.rb.gotmpl` lines 19-21.

### general-qa-3: Close stale formula PRs step pipes `gh pr list ... --jq ... | while read` — this is a non-zero-exit-safe pipe (P3)

**File**: `.github/workflows/release.yaml:72-75`
**Description**: The step uses `gh pr list ... | while read -r pr_num; do ... done`. With `set -e` semantics (which GitHub Actions steps use), if `gh pr list` returns no results, the pipe produces an empty string and the `while` loop body never runs — this is fine. However, if `gh pr list` fails with a non-zero exit code, the pipe may still succeed (exit 0) because the `while` construct's exit code is the exit code of its last iteration. The `while read` pattern silently swallows `gh pr list` failures. Additionally, the PR search query `"chore: update agent-team claude-team to"` is fragile — it matches on the commit message convention, which if changed would silently stop closing stale PRs.
**Expected**: The pipe should use `set -o pipefail` or capture the list to a variable before iterating to ensure errors are surfaced. The search query should be documented as a convention dependency.
**Actual**: `gh pr list ... | while read -r pr_num` — `gh` failures may be silently swallowed.
**Steps to reproduce**: Review `.github/workflows/release.yaml` lines 70-75. The step does not have `set -o pipefail` before the pipe.

### documentation-1: Homebrew formula templates reference `gomplate` but there is no `README` entry or developer documentation explaining the template syntax or how to test formula generation locally (P3)

**File**: `Formula/agent-team.rb.gotmpl:1` and `Formula/claude-team.rb.gotmpl:1`
**Description**: Two new Gomplate template files are introduced. A developer who needs to modify the formula in the future needs to understand Gomplate syntax (`{{ .Env.Tag }}`, `{{ .Env.SHA256 }}`). There is no documentation in the repo explaining the template system, how to invoke gomplate locally to test changes, or what environment variables are required. The README at the repo root doesn't mention formula templates.
**Expected**: A `Formula/README.md` or inline comments in the template files explaining the template syntax and how to test locally (e.g., `Tag=v1.0.0 SHA256=abc123 gomplate -f Formula/agent-team.rb.gotmpl`).
**Actual**: No documentation exists for the template system.
**Steps to reproduce**: Look for any documentation on using or testing `Formula/*.gotmpl` files — none exists in this PR.

### simplicity-1: `bin/ct` duplicates the help text inline instead of delegating to `claude-team --help` (P4)

**File**: `bin/ct:34-48`
**Description**: `bin/ct` defines its own `show_help()` function that prints a brief summary, with instructions to see `claude-team --help` for the full docs. An alternative approach would be to check for `--help` in `ct` and pass it through to `claude-team --help` directly, avoiding the maintenance cost of two help texts. This is minor — the current approach is explicit — but the brief help in `ct` could drift from `claude-team`'s actual help text.
**Expected**: `ct --help` could just `exec "$SCRIPT_DIR/claude-team" --help` to always show the canonical help.
**Actual**: `ct` maintains its own help summary.
**Steps to reproduce**: Review `bin/ct` lines 34-48.
**Recommendation**: Fix in a follow-up; not a blocker.

## Summary

This PR introduces the `claude-team` launcher script, `ct` alias, stdlib library, Homebrew formulas, and release CI automation. The critical issue is `best-practices-3`: the new `bin/lib/stdlib.sh` overwrites the existing stdlib with a stripped-down version, which will cause regressions in any script that depends on the functions removed (approximately 12 functions deleted). The formula glob `Dir['bin/*']` that includes a directory (`bin/lib/`) is also a P2 failure that would break `brew install agent-team`. The missing `GITHUB_JOB_URL` variable (P2) means every release PR will have a broken workflow link. The `curl | chmod` gomplate installation without a checksum (P1) is a supply chain risk in the release pipeline. These issues need to be fixed before merging.
