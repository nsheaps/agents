# shared-config — design notes

## Goal

Share Claude Code config (rules, skills, commands, agents, and select
settings files) across repositories, with cross-project deduplication, so an
org can maintain one source of truth and have it appear in every project.

## Implementation

Single Bun/TypeScript entrypoint `src/index.ts`, invoked directly by `bun` from
the hook (`hooks.json` → `bun "${CLAUDE_PLUGIN_ROOT}/src/index.ts"`). No build
step and zero external deps — it uses `Bun.YAML.parse`, `node:fs`/`node:crypto`,
and spawns the `git` binary. Functions are exported so `bun test` can drive them.

## Hook process (Setup + SessionStart)

1. Resolve the local config layers (no network) to learn
   `waitForTokenTimeoutSeconds`.
2. Wait (bounded by that timeout; default 15, `0` disables) for the
   **github-app** plugin to publish `GH_TOKEN` into `CLAUDE_ENV_FILE`, preferring
   it (via the `GITHUB_TOKEN_FILE` signal) over ambient creds. The env file is
   parsed in TS (`export K=V` + recursive `source` lines).
3. Resolve settings across layers (low → high): `$AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM`
   bootstrap → plugin defaults (`${CLAUDE_PLUGIN_ROOT}/shared-config.settings.yaml`)
   → user `plugins.settings.yaml` → user standalone → project
   `plugins.settings.yaml` → project standalone. `sources` are unioned; other
   keys last-wins (with string→type coercion).
4. Clone/update each source into `…/shared-configs/sources/<org>/<repo>/`
   (one clone per repo; fetch + hard reset each run; tokened via the github-app
   token using `http.extraheader`, never persisted to the repo config).
5. Rebuild `…/shared-configs/<slug>/<targetBase>/<type>/<org>__<repo>` →
   `<clone>/<resolved type dir>` (slug derived from the project's git origin, or
   a hash of its realpath).
6. Point `<project>/<targetBase>/<type>/.shared` at the intermediate dir.
7. If `mergeSettings`, deep-merge source `settings/*.json|*.jsonnet` fragments
   into the project's settings (project wins; backups written).
8. Emit SessionStart JSON with `reloadSkills: true`.

Setup/SessionStart hooks must never break the session: `main()` wraps the run in
try/catch and always emits JSON to stdout, exiting 0 even on error.

> Config is read directly in TypeScript (replicating the standard 3-tier
> `plugins.settings.yaml` semantics) rather than sourcing the shared-lib bash
> `plugin-config-read.sh`, because the entrypoint is pure Bun/TS with no shell.

## Cross-project dedup

```
projectA/.claude/rules/.shared  ─> …/<slugA>/.claude/rules/  ─> …/sources/<org>/<repo>/rules
projectB/.claude/rules/.shared  ─> …/<slugB>/.claude/rules/  ─> …/sources/<org>/<repo>/rules
```

Claude Code (on the web, with multiple projects in scope) recurses into the
linked dirs, follows the symlinks, and dedups by realpath, so a rule shared by
both projects loads exactly once. The shared cache + indirection exist to make
every project resolve identical resources to one realpath inside a single clone.

`tests/sync.test.ts` (`bun test`) asserts the filesystem layer: ref parsing,
source normalization/dedup, env-file parsing, link-tree construction, source-side
`sourceDir` override, `uses:`-style subpath selection, source union,
`resourceTypes` honoring, idempotency, and that the same shared file resolves to
a single realpath from multiple projects.

## Dependencies

Declared in `plugin.json`: `github-app ^0.5` (from the ai-mktpl marketplace
today; the repos are expected to consolidate under `nsheaps/agents` long term).
Runtime needs `bun` and `git`; `jsonnet` is optional.

## Open questions / follow-ups

- The standalone `shared-config.settings.yaml` overlay and the settings-merge
  feature are implemented and unit-tested but still to be exercised against real
  org sync flows.
- If a resource type needs a flatter on-disk layout than
  `.claude/<type>/.shared/<repo>/…`, adjust the link tree accordingly.
