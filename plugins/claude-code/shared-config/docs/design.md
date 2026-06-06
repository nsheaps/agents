# shared-config — design notes

## Goal

Share Claude Code config (rules, skills, commands, agents, and select
settings files) across repositories, with cross-project deduplication, so an
org can maintain one source of truth and have it appear in every project.

## Hook process (Setup + SessionStart)

1. Source the **shared-lib** (`plugin-config-read.sh`, `log.sh`) from its
   dependency data dir and resolve the repo-level `shared-config:` settings via
   the standard 3-tier mechanism (`plugin_get_config` / `plugin_get_config_json`,
   with `""`/`[]` sentinels so the Python layer can tell "unset" from "set").
2. Wait (bounded by `waitForTokenTimeoutSeconds`, default 15, `0` disables) for
   the **github-app** plugin to publish `GH_TOKEN` into `CLAUDE_ENV_FILE`,
   preferring it (via the `GITHUB_TOKEN_FILE` signal) over ambient creds.
3. Pass the resolved config (JSON) to `shared_config_sync.py`, which layers in
   the remaining overlays (low → high): `$AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM`
   bootstrap → user standalone `shared-config.settings.yaml` → shared-lib config
   → project standalone `shared-config.settings.yaml`. `sources` are unioned;
   other keys last-wins.
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

Setup/SessionStart hooks must never break the session: the bash wrapper traps
`EXIT` and always emits JSON; the Python entrypoint swallows all exceptions.

## Cross-project dedup

```
projectA/.claude/rules/.shared  ─> …/<slugA>/.claude/rules/  ─> …/sources/<org>/<repo>/rules
projectB/.claude/rules/.shared  ─> …/<slugB>/.claude/rules/  ─> …/sources/<org>/<repo>/rules
```

Claude Code (on the web, with multiple projects in scope) recurses into the
linked dirs, follows the symlinks, and dedups by realpath, so a rule shared by
both projects loads exactly once. The shared cache + indirection exist to make
every project resolve identical resources to one realpath inside a single clone.

`tests/sync.test.sh` asserts the filesystem layer: link-tree construction,
source-side `sourceDir` override, `uses:`-style subpath selection, settings
merge precedence, idempotency, the shared-lib JSON boundary + source union, and
that the same shared file resolves to a single realpath from multiple projects.

## Dependencies

Declared in `plugin.json`: `shared-lib ^1.0` and `github-app ^0.5` (both from
the ai-mktpl marketplace today; the repos are expected to consolidate under
`nsheaps/agents` long term).

## Open questions / follow-ups

- The standalone `shared-config.settings.yaml` overlay and the settings-merge
  feature are implemented and unit-tested but still to be exercised against real
  org sync flows.
- If a resource type needs a flatter on-disk layout than
  `.claude/<type>/.shared/<repo>/…`, adjust the link tree accordingly.
