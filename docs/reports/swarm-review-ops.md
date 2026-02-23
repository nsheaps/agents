# Swarm Review: Ops/Build/Release Perspective

**Reviewer:** Foghorn Leghorn (Ops Engineer)
**Repo:** nsheaps/agent-team
**Branch:** main (commit `1751fcd`)
**Date:** 2026-02-18

## Summary

The agent-team repo has a basic CI/CD setup but several issues prevent it from working correctly. The release pipeline is non-functional, there are known bugs carried over from earlier repos, and the repo lacks Homebrew publishing entirely.

---

## Findings

### CRITICAL — Release Pipeline Non-Functional

**OPS-1: Missing automation secrets** (CRITICAL)

- `AUTOMATION_GITHUB_APP_ID` and `AUTOMATION_GITHUB_APP_PRIVATE_KEY` are NOT configured on this repo
- All Release workflow runs are failing (confirmed: runs 22124621026 and 22124528323 both failed)
- **Fix:** User needs to add both secrets via GitHub repo settings

**OPS-2: Release workflow missing GITHUB_TOKEN env** (HIGH)

- `.github/workflows/release.yaml:37` — `bun run release-it --ci` runs without explicit `GITHUB_TOKEN` env
- This is the same REL-1 bug we fixed in claude-team and claude-utils
- release-it needs `GITHUB_TOKEN` to create GitHub releases
- **Fix:** Add `env: GITHUB_TOKEN: ${{ steps.auth.outputs.token }}` to the release-it step

**OPS-3: Release workflow missing version/tag outputs** (HIGH)

- The release job has no `outputs:` block and no `id: release` on the release step
- This means a Homebrew update job can't consume the version/tag
- Compare with claude-team's release.yaml which properly exports `version` and `tag`
- **Fix:** Add outputs block and capture tag/version in the release step

### HIGH — actions/checkout@v6 Bug

**OPS-4: `actions/checkout@v6` in composite action** (HIGH)

- `.github/actions/github-app-auth/action.yml:73` uses `actions/checkout@v6`
- This is the same REL-2 bug we fixed in claude-team and claude-utils — v6 likely doesn't exist
- **Fix:** Downgrade to `actions/checkout@v4`

### HIGH — No Homebrew Formula Publishing

**OPS-5: No Homebrew formula or update-homebrew job** (HIGH)

- The release workflow has no `update-homebrew` job
- No `Formula/` directory exists
- No gomplate template for Homebrew formula generation
- This means even if releases work, there's no path to `brew install`
- **Fix:** Add Formula/agent-team.rb.gotmpl + update-homebrew job (same pattern as claude-team, gs-stack-status)
- **Note:** This may be intentional for now since agent-team is still POC/sandbox. Confirm with team lead.

### MEDIUM — CI Lint Failures on main

**OPS-6: Lint (formatting) failing on main** (MEDIUM)

- Latest Test workflow run (22124621021) failed due to `.claude/rules/teammate-abstraction.md` not being formatted
- Main branch should be green. This erodes CI trust.
- **Fix:** Run `mise run fmt` and commit the formatted file

### MEDIUM — Dual Lockfile Confusion

**OPS-7: Both `bun.lock` and `yarn.lock` present** (MEDIUM)

- `bun.lock` (57KB) and `yarn.lock` (88KB) both exist in the repo
- mise.toml specifies `bun = "latest"` as the tool
- `package.json` has no `packageManager` field (unlike claude-utils which declares yarn)
- CI uses `bun install`, so `yarn.lock` appears to be an artifact from initial setup
- **Fix:** Remove `yarn.lock`, add it to `.gitignore`. Or choose one and be consistent.

### MEDIUM — Missing `--frozen-lockfile` in CI

**OPS-8: `bun install` without `--frozen-lockfile`** (MEDIUM)

- Both `release.yaml:34` and `test.yaml:19,31` use bare `bun install`
- CI should use `bun install --frozen-lockfile` to prevent lockfile drift and ensure reproducibility
- **Fix:** Add `--frozen-lockfile` to all `bun install` commands in CI

### LOW — Misc Config Issues

**OPS-9: `.release-it.base.json` purpose unclear** (LOW)

- There's both `.release-it.json` (full config) and `.release-it.base.json` (minimal, disables everything)
- `.release-it.base.json` appears to be for plugin sub-releases (`@release-it/bumper` in devDeps)
- Hooks in base config reference `prettier --write .claude-plugin/plugin.json` but no `.claude-plugin/plugin.json` exists at root
- **Note:** May be for the `plugins/agent-team-skills/` directory. Needs clarification.

**OPS-10: `renovate.json` uses `.json` not `.json5`** (LOW)

- Per user preference, should use `.json5` where possible for comments
- Low priority since this is a standard config file

**OPS-11: Untracked defect ticket files** (LOW)

- 10 `docs/tickets/PHASE1-DEF-*.md` files are untracked (shown in `git status`)
- These should either be committed or added to `.gitignore`

**OPS-12: `.vscode/` directory committed** (LOW)

- `.vscode/` is in `.gitignore` but the directory exists in git history
- May contain stale settings from initial setup

---

## Priority Summary

| ID     | Severity | Issue                                        | Blocking?                                   |
| ------ | -------- | -------------------------------------------- | ------------------------------------------- |
| OPS-1  | CRITICAL | Missing automation secrets                   | Yes — releases can't run                    |
| OPS-2  | HIGH     | Missing GITHUB_TOKEN env for release-it      | Yes — releases would fail even with secrets |
| OPS-3  | HIGH     | Missing version/tag outputs from release job | Yes — blocks Homebrew publishing            |
| OPS-4  | HIGH     | actions/checkout@v6 doesn't exist            | Yes — composite action fails                |
| OPS-5  | HIGH     | No Homebrew formula publishing               | No — may be intentional for POC             |
| OPS-6  | MEDIUM   | Lint failing on main                         | No — but erodes CI trust                    |
| OPS-7  | MEDIUM   | Dual lockfiles (bun.lock + yarn.lock)        | No                                          |
| OPS-8  | MEDIUM   | Missing --frozen-lockfile in CI              | No — but risks drift                        |
| OPS-9  | LOW      | .release-it.base.json purpose unclear        | No                                          |
| OPS-10 | LOW      | renovate.json not json5                      | No                                          |
| OPS-11 | LOW      | Untracked defect ticket files                | No                                          |
| OPS-12 | LOW      | .vscode/ directory                           | No                                          |

## Recommendations

1. **Immediate:** Fix OPS-1 through OPS-4 to get a working release pipeline
2. **Short-term:** Fix OPS-6 (lint) and OPS-7 (dual lockfile) to keep main green
3. **When ready for distribution:** Add Homebrew formula (OPS-5) following the established pattern
4. **Cleanup:** Address OPS-8 through OPS-12 as part of regular maintenance
