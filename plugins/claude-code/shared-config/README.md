# shared-config

Setup/SessionStart hook that **shares Claude Code config across repos**. It
clones one or more "source" repos and symlinks their `rules/`, `skills/`,
`commands/`, and `agents/` into the current project through a shared cache, so
the same shared resources can be reused across every project in a session
without duplicating them. It can also bootstrap from an org-level upstream
config and (opt-in) merge `settings.json` fragments.

## How it works

Implemented in Bun/TypeScript (`src/index.ts`), run directly by `bun` from the
hook — no build step and zero external deps (uses `Bun.YAML`, `node:fs`,
`node:crypto`, and the `git` binary). On `Setup` and `SessionStart`:

1. **Reads the github-app token.** Waits briefly for the `github-app` plugin to
   publish `GH_TOKEN` via `CLAUDE_ENV_FILE`, preferring that token over ambient
   creds so private source repos clone correctly. Falls back to any ambient
   `GH_TOKEN`, or tokenless for public repos.
2. **Resolves settings** (see below), including `$AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM`.
3. **Clones/updates each source** into a shared cache:
   `$CLAUDE_PLUGIN_DATA/shared-configs/sources/<org>/<repo>/` — one clone per
   repo, fetched and hard-reset to the remote on each run.
4. **Builds a per-project link tree** and points the project at it:

   ```
   <project>/.claude/rules/.shared
        └─> $CLAUDE_PLUGIN_DATA/shared-configs/<project-slug>/.claude/rules/
              ├─ acme__shared-a  ─> …/sources/acme/shared-a/rules
              └─ acme__shared-b  ─> …/sources/acme/shared-b/.claude/rules
   ```

   (same for `skills`, `commands`, `agents`). `reloadSkills` is emitted so newly
   linked skills load in the same session.

### Why the indirection — cross-project dedup

Claude Code on the web loads `rules`/`skills`/etc. from **all** projects in a
session, not just the cwd. Because every project's `.shared` links ultimately
resolve (via `realpath`) to the **same** file in the **same** source clone,
Claude Code deduplicates identical resources and loads each one once — so the
same shared rule referenced by five projects is loaded a single time, not five.

The hermetic test (`tests/sync.test.ts`) asserts the filesystem half of this:
the link tree is built correctly and a resource reachable from two projects
resolves to one realpath inside a single source clone.

## Configuration

Config follows the standard 3-tier `plugins.settings.yaml` resolution
(project > user > plugin default) under the `shared-config:` namespace, plus two
overlays. Resolution, low -> high precedence (`sources` lists are **unioned**
across every layer; other keys are last-wins):

- `$AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM` — org bootstrap (lowest)
- `${CLAUDE_PLUGIN_ROOT}/shared-config.settings.yaml` — plugin defaults
- `~/.claude/plugins.settings.yaml` `shared-config:` — user
- `~/.claude/shared-config.settings.yaml` — standalone overlay (user)
- `<project>/.claude/plugins.settings.yaml` `shared-config:` — project
- `<project>/.claude/shared-config.settings.yaml` — standalone overlay (project,
  highest)

The standalone `shared-config.settings.yaml` overlay lets an org sync just this
one file without syncing all plugin settings.

```yaml
# shared-config.settings.yaml  (or nested under `shared-config:` in plugins.settings.yaml)
enabled: true
resourceTypes: [rules, skills, commands, agents] # which dirs to link
defaultSourceDir: "." # base in a source repo holding the {rules,skills,…} dirs
targetBaseDir: ".claude" # where in the project the .shared links go
waitForTokenTimeoutSeconds: 15 # 0 disables the github-app token wait
mergeSettings: false # opt-in, experimental (see below)
sources:
  - acme/shared-config # whole repo, resources at the repo root
  - acme/org-rules/.claude # uses:-style subpath -> source dir = .claude
  - repo: acme/special # object form
    sourceDir: configs/claude # override base dir in the source repo
    targetDir: .claude # override where links land in this project
```

### Repo references

GitHub-Actions `uses:`-style, **without** a `@ref` (refs are not supported yet):

- `org/repo` — whole repo; resources at the default source dir
- `org/repo/sub/path` — `sub/path` is the source dir (base of `{rules,skills,…}`)

### Source-side override

A source repo can ship `.claude/shared-config-roots.yaml` to declare where its
resources live (e.g. under `.claude/` instead of the repo root):

```yaml
sourceDir: .claude # base dir holding {rules,skills,commands,agents}
# or per-type overrides (each is the exact dir, relative to the repo root):
roots:
  rules: .claude/rules
  skills: skills
```

Precedence for a source's resource dir: target `roots`/`sourceDir` override →
source repo's `shared-config-roots.yaml` → `defaultSourceDir`.

### `$AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM`

Points at an org-level config (a repo + optional path), e.g.
`nsheaps/shared-config/config`. The hook clones it and loads
`shared-config.settings.yaml` (or `plugins.settings.yaml`) from the given path,
using it **in addition to** anything defined in the repo (its `sources` are
unioned in; its scalars are overridden by repo-level settings).

### Settings merge (opt-in)

With `mergeSettings: true`, source repos may provide
`<sourceDir>/settings/settings.json`, `settings.local.json`, or `*.jsonnet`
fragments. They are deep-merged together, then merged into the project's
`.claude/settings.json` / `settings.local.json` with **project values winning**;
the originals are backed up to `*.shared-config.bak`. `.jsonnet` fragments are
evaluated only if `jsonnet` is available (on `PATH` or via `mise`), otherwise
skipped.

## Dependencies / requirements

This plugin has **no hard plugin dependencies** — it works on its own.

Optional companion:

- **github-app** — if installed, it publishes `GH_TOKEN` into `CLAUDE_ENV_FILE`;
  shared-config opportunistically reads that token (via the `GITHUB_TOKEN_FILE`
  signal) to clone **private** source repos. It is _not_ required: shared-config
  imports no github-app code and degrades gracefully (public repos, an ambient
  `GH_TOKEN`, or tokenless). It is therefore intentionally not declared in
  `plugin.json` `dependencies` — that would force installing a whole
  cross-marketplace auth stack just to read an optional env var.

Runtime tools:

- **bun** runs the hook — provided via `mise` (the repo's `mise.toml` pins it),
  matching the other bun-based plugins.
- **git** (and **jsonnet**, only for jsonnet settings fragments) are resolved at
  runtime: used directly if on `PATH`, otherwise auto-run via `mise exec
<tool>@latest` so they're installed/delegated through mise rather than failing.

## Testing

```bash
bun test plugins/claude-code/shared-config/tests/sync.test.ts
```

Hermetic (no network) — builds local fixture repos and asserts the clone +
symlink layout, source-side `sourceDir` override, `uses:`-style subpath, source
union, `resourceTypes` honoring, idempotency, env-file parsing, and that
cross-project paths resolve to one realpath.
