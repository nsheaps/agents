# Plan: nx-affected release pipeline

## Problem

`release.yaml` runs on **every** push to `main` (no path filter). It cuts a repo-wide
`vX.Y.Z` GitHub release via `release-it` and opens a Homebrew formula bump PR
(`agent-team` / `claude-team`). Those formulas ship **only** `bin/**` scripts
(`agent-team.rb.gotmpl` installs `bin/claude-team`, `bin/ct`, `bin/agent-launch.ts`,
`bin/lib/*`). So a `plugins/**`-only change produces a new agent-team release +
Homebrew PR that installs **byte-identical** binaries — pure churn.

Meanwhile `cd.yaml` already correctly path-filters to `plugins/**` and owns the
plugin version bump + `marketplace.json` regen.

## Goal (handler directive)

> Each module that releases gets its own release run script; the nx task graph makes
> `release` depend on the former tasks; `release.yaml` runs the release task for what's
> been **affected since last release**; a floating `last-released` tag marks the last
> released commit and is used with nx to compute affected modules; on success the
> workflow moves the tag. Lean into the nx monorepo pattern.

## Design

### Module → release mapping

| nx project                | What "release" means                                             | Today                |
| ------------------------- | ---------------------------------------------------------------- | -------------------- |
| `root`                    | `release-it --ci` → version + tag + GitHub release + changelog   | `release.yaml` job 1 |
| `@nsheaps/agents-plugins` | bump changed plugin versions + regen `marketplace.json` + commit | `cd.yaml` main job   |

Other apps/packages/services get **no** `release` target yet — nx auto-skips projects
without one, so they stay inert until they actually publish (YAGNI).

### Each release script is self-contained

So `nx affected --target=release` can run both without dirty-tree coupling:

- **root** `release` = `release-it --ci` (already commits/tags/pushes/creates GH release).
- **plugins** `release` = `plugins/release.sh`: runs `mise run auto-bump-plugins` +
  `mise run update-marketplace` (file edits only) then commits + pushes its own slice
  (`plugins/claude-code/*/.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`)
  with the resilient sync+retry pattern lifted from today's `cd.yaml`.

### nx task graph

`nx.json` → `targetDefaults.release`:

```jsonc
"release": { "dependsOn": ["build", "test", "lint", "^release"], "cache": false }
```

A module builds/tests/lints (and upstream deps release) before it releases. nx omits
edges for targets a project lacks (root has no build/test; plugins has no build).

### Floating tag

- Introduce lightweight floating tag **`last-released`**, retire `cd/last-release`.
- `release.yaml` resolves base = `last-released` (fallback `HEAD~1` when absent — first run).
- nx affected: `bunx nx show projects --affected --target=release --base="$BASE"`.
- plugins `release.sh` uses the same base (`RELEASE_BASE` env) for per-plugin diffing.
- **On success only**, `release.yaml` moves `last-released` to HEAD and force-pushes it.

### release.yaml (thin, affected-driven)

1. checkout `fetch-depth: 0`; fetch tags; auth app token; setup mise; `bun install`.
2. resolve `BASE` (`last-released` or `HEAD~1`).
3. `AFFECTED=$(bunx nx show projects --affected --target=release --base="$BASE" --head=HEAD)`.
4. `RELEASE_BASE="$BASE" bunx nx affected --target=release --base="$BASE" --head=HEAD`.
5. if `root` ∈ AFFECTED → run the Homebrew formula PR job (reads the `v*` tag release-it made).
6. on success → move `last-released` to HEAD, force-push.

### cd.yaml → preview-only

- Keep the PR `version-preview` job (sticky comment + `::notice` annotations).
- Remove the `bump-and-update-marketplace` main job (now the plugins `release` target).
- Remove the `cd/last-release` tag update.

### Docs

Update `docs/MONOREPO.md` release/CD section + tag name.

## Net effect on the bug

- `plugins/**`-only merge → only `@nsheaps/agents-plugins` affected → only marketplace/version
  bump runs. No agent-team GitHub release, no Homebrew PR.
- `bin/**` change → `root` affected → release-it + Homebrew fire.

## Testable here vs CI-only

- **Local (this sandbox):** nx project/target graph, affected resolution
  (`nx show projects --affected`), script syntax (`bash -n`, shellcheck), prettier/lint.
- **CI-only (no GitHub API / cross-repo here):** real release-it GitHub release, the
  cross-repo Homebrew PR, the `last-released` tag move, concurrent-merge resilience.
  These are called out in the PR for reviewer/CI validation.

## Follow-ups (out of scope — move-first)

- Scope release-it's changelog to root-only commit paths (currently scans repo-wide).
- Switch CI lint/build/test to `nx affected` too, once the workspace is large enough.
