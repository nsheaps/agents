# Spec: Layered agent config bootstrap for Claude Code on the web

Status: draft

## Problem & Requirements

A new repo opened in Claude Code on the web should be able to operate with the
same plugins, secrets, git auth, and settings as one of our agents — **without
committing any of that config into the repo**. The web environment preconfigures
a 1Password service-account token and runs a setup script; by the time Claude
starts, the agent's plugins should already be installed and their SessionStart
hooks should have run.

Requirements:

1. A single **curl-able** script invoked from the web environment's Setup script.
2. It takes an **upstream** agent config reference (e.g. `nsheaps/.ai-agent-jack`):
   "initialize as if running from that repo." No hardcoded plugin/marketplace set.
3. Config is **layered** via `extends`: a base agent config, an org config, and a
   per-agent/role config, each declaring only its delta. Deep-merged base → leaf.
4. It installs/enables the resolved plugins (warming the snapshot cache so first
   launch has them) and materializes the resolved `plugins.settings.yaml`.
5. It also supports a general **settings passthrough** merged into the user
   settings file.
6. Write target by environment: web → `~/.claude/settings.json`; otherwise →
   `~/.claude/settings.local.json` (leave the real `settings.json` untouched).

## Technical Design

`bin/setup-claude-web` — a bash entry point (so `curl … | bash` works) that
ensures Python 3 + PyYAML, then hands off to an embedded Python resolver.

Resolver steps:

1. **Resolve the `extends` chain** from the upstream ref. Each ref is
   `owner/repo[:path][@ref]` (shallow-cloned) or a local path. Cycle/depth
   guarded. Returns configs base-first.
2. **Deep-merge** the chain: maps deep-merge (child wins); lists union+dedupe;
   scalars child-wins.
3. **Translate** the merged config:
   - `marketplaces` → `extraKnownMarketplaces` (string shorthand → github source).
   - `plugins` → `enabledPlugins` + `claude plugin install`.
   - `pluginSettings` → `~/.claude/plugins.settings.yaml` (deep-merged).
   - `settings` → deep-merged into the target settings file.
4. **Warm the cache**: web uses `--scope user` (writes the target `settings.json`);
   local uses `--scope local` from a throwaway dir (warms the shared cache without
   touching the user's `settings.json`). `CLAUDE_WEB_SKIP_INSTALL=1` skips this
   (config-only / offline tests).

All writes are non-destructive (deep-merge into existing) and idempotent.

### Config layout (3-repo split)

| Layer | Location                         | Declares                        |
| ----- | -------------------------------- | ------------------------------- |
| base  | `nsheaps/agents:agent.base.yaml` | universal marketplace + plugins |
| org   | `nsheaps/.org:agent.yaml`        | org specifics                   |
| role  | `nsheaps/.ai-agent-*:agent.yaml` | role delta (`extends` org)      |

### Scope of the initial PR

- `bin/setup-claude-web`, `agent.base.yaml`, the runbook, this spec, and an
  offline test suite (`tests/setup-claude-web.test.sh`).
- Follow-ups: create `nsheaps/.org:agent.yaml`, and add `extends` + role deltas to
  each agent repo's `agent.yaml`.

## References

- Runbook (schema + usage): [`docs/runbooks/setup-claude-code-web.md`](../../runbooks/setup-claude-code-web.md)
- First-launch plugin install issue: [ai-mktpl#261](https://github.com/nsheaps/ai-mktpl/issues/261)
- [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
