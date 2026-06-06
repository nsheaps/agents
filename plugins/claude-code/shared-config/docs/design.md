# shared-config — design notes

## Goal

Share Claude Code config (rules, skills, commands, agents, and select
settings files) across repositories, with cross-project deduplication, so an
org can maintain one source of truth and have it appear in every project.

## Hook process (Setup + SessionStart)

1. Read settings; determine the github-app token (wait for it via
   `CLAUDE_ENV_FILE`, preferring it over ambient creds). Token wait is bounded
   (`waitForTokenTimeoutSeconds`, default 15; `0` disables).
2. Resolve config layers (low → high precedence):
   `$AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM` → user `plugins.settings.yaml`
   (`shared-config:`) → user `shared-config.settings.yaml` → project
   `plugins.settings.yaml` (`shared-config:`) → project
   `shared-config.settings.yaml`. `sources` are unioned; other keys last-wins.
3. Clone/update each source into `…/shared-configs/sources/<org>/<repo>/`
   (one clone per repo; fetch + hard reset each run).
4. Rebuild `…/shared-configs/<slug>/<targetBase>/<type>/<org>__<repo>` →
   `<clone>/<resolved type dir>` (slug derived from the project's git origin, or
   a hash of its realpath).
5. Point `<project>/<targetBase>/<type>/.shared` at the intermediate dir.
6. If `mergeSettings`, deep-merge source `settings/*.json|*.jsonnet` fragments
   into the project's settings (project wins; backups written).
7. Emit SessionStart JSON with `reloadSkills: true`.

Setup/SessionStart hooks must never break the session: the bash wrapper traps
`EXIT` and always emits JSON; the Python entrypoint swallows all exceptions.

## The dedup hypothesis (UNVERIFIED)

```
projectA/.claude/rules/.shared  ─> …/<slugA>/.claude/rules/  ─> …/sources/<org>/<repo>/rules
projectB/.claude/rules/.shared  ─> …/<slugB>/.claude/rules/  ─> …/sources/<org>/<repo>/rules
```

If Claude Code (esp. on the web with multiple projects in scope) recurses into
`.shared/`, follows symlinked dirs, and dedups by realpath, then a rule shared
by both projects loads exactly once. This is the design intent.

### What is verified vs not

- **Verified (tests/sync.test.sh):** filesystem layout, source-side `sourceDir`
  override, `uses:`-style subpath selection, settings merge precedence,
  idempotency, and that the same shared file resolves to a single realpath from
  multiple projects.
- **NOT verified (undocumented runtime behavior):** that Claude Code recurses
  into `.claude/<type>/.shared/…`, follows symlinked directories during
  rules/skills/commands/agents discovery, loads config from all projects in a
  web session, and dedups identical realpaths. See the claude-code-guide
  findings — these are documented as unknown.

## Open questions / follow-ups

- Confirm discovery recursion + symlink following for each resource type, and
  the dedup key (realpath vs content hash vs filename). Adjust the layout if the
  runtime expects a flatter structure (e.g. links directly under
  `.claude/skills/<name>` rather than `.claude/skills/.shared/<repo>/<name>`).
- `shared-config.settings.yaml` standalone file path is implemented but untested
  against real org sync flows.
- Cross-marketplace dependency on `github-app`/`shared-lib` is intentionally
  soft (runtime-detected, not declared in `plugin.json`) to avoid install-time
  resolution failures in the `agents` marketplace.
- Settings merge into a user's real `settings.json` is invasive; kept opt-in and
  experimental.
