# Runbook: Auto-configure Claude Code on the web from a layered agent config

Bootstrap a [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
session to "initialize as if it were running from another agent's repo" —
inheriting that agent's plugins, marketplaces, plugin config, and settings
**without committing any of it into the repo you're working in**.

The bootstrap is [`bin/setup-claude-web`](../../bin/setup-claude-web). It reads
a layered `agent.yaml` from an upstream agent repo, deep-merges the `extends`
chain, and applies the result.

## TL;DR

In the web environment's **Setup script** field (the environment preconfigures
the 1Password service-account token), paste:

```bash
curl -fsSL https://raw.githubusercontent.com/nsheaps/agents/main/bin/setup-claude-web | bash -s -- nsheaps/.ai-agent-jack
```

On the next session, Jack's plugins are already installed (cache warmed in the
snapshot), their SessionStart hooks run (1pass injects secrets via the preconfigured
token, github-app mints a token, mise installs tools), and Jack's settings apply —
all in a repo that contains none of that config.

## The config model: layered `agent.yaml`

Each agent repo has an `agent.yaml`. It may `extends` a parent, forming a chain
that is deep-merged **base → org → role** (leaf wins):

```
nsheaps/agents : agent.base.yaml     base — what any agent needs
        ▲ extends
nsheaps/.org   : agent.yaml          org  — org specifics
        ▲ extends
nsheaps/.ai-agent-jack : agent.yaml  role — Jack's delta only
```

So each layer declares only its difference. Five agents share one base + org and
override just what differs.

### Schema

```yaml
name: jack # identity (informational)
extends: nsheaps/.org # parent ref: owner/repo[:path][@ref] or a local path

marketplaces: # → settings.extraKnownMarketplaces
  ai-mktpl: nsheaps/ai-mktpl # string shorthand → github source
  agents: # or an explicit source map
    source: github
    repo: nsheaps/agents

plugins: # → settings.enabledPlugins + `claude plugin install`
  - 1pass@ai-mktpl
  - github-app@ai-mktpl

pluginSettings: # → ~/.claude/plugins.settings.yaml (how plugins behave)
  1pass:
    opExec:
      items: ["op://Agent-Jack/ENVIRONMENT"]
  github-app:
    ref: "op://Agent-Jack/github--app--jack"

settings: # → deep-merged into the target settings.json/local.json
  model: opus
  permissions:
    allow: ["Bash(git push)"]
```

### `extends` reference format

`owner/repo[:path][@ref]` — `path` defaults to `agent.yaml`, `ref` to the repo's
default branch. A value that looks like a path (`/…`, `./…`, `~/…`, or an existing
file/dir) is read locally instead of cloned (used by the tests).

### Merge semantics

- **maps** (`marketplaces`, `pluginSettings`, `settings`): deep-merged; child wins on scalar conflicts.
- **lists** (`plugins`, and any list such as `permissions.allow`): unioned in order, de-duplicated.
- **scalars** (`name`, `model`, …): child wins.

## Where it writes

| Output                              | Web (`CLAUDE_CODE_REMOTE` set)       | Local (not web)                                                               |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| marketplaces + plugins + `settings` | `~/.claude/settings.json`            | `~/.claude/settings.local.json` (your real `settings.json` is left untouched) |
| `pluginSettings`                    | `~/.claude/plugins.settings.yaml`    | `~/.claude/plugins.settings.yaml`                                             |
| plugin cache warm                   | `claude plugin install --scope user` | `--scope local` from a throwaway dir (warms the shared cache only)            |

Merges are non-destructive — pre-existing keys are preserved — and idempotent.

### Why warm the cache in the setup script?

The setup script runs as root **before** Claude Code launches and its filesystem
(including `~/.claude`) is snapshot-cached. Installing the plugins here means the
first session already has them, so their SessionStart hooks run on turn one. This
is the recommended workaround for the known "plugins in settings.json aren't
installed on first launch" issue ([ai-mktpl#261](https://github.com/nsheaps/ai-mktpl/issues/261)).

## Environment variables

| Variable                  | Meaning                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `CLAUDE_WEB_UPSTREAM`     | Upstream ref, if not passed as the positional arg.                     |
| `CLAUDE_CODE_REMOTE`      | Set by the web env → selects `settings.json` vs `settings.local.json`. |
| `CLAUDE_CONFIG_DIR`       | Config dir to write into (default `~/.claude`).                        |
| `CLAUDE_WEB_SKIP_INSTALL` | Skip the `claude plugin` calls — config-only mode (used by the tests). |

## Secrets

The script wires up plugins + their config; it does not handle secrets. The
1Password service-account token comes from the web environment, and the
`op://` references in the inherited `pluginSettings` resolve against it at session
start (via the `1pass` plugin). See
[create-1password-vault-and-service-account](./create-1password-vault-and-service-account.md)
and [create-github-app](./create-github-app.md).

## Testing

```bash
bash tests/setup-claude-web.test.sh   # offline (CLAUDE_WEB_SKIP_INSTALL), no network
```

## Verifying a live session

```bash
claude plugin list   # the inherited plugins appear installed + enabled
```

## Current status / follow-ups

- `agent.base.yaml` (base layer) lives in this repo.
- The org layer (`nsheaps/.org : agent.yaml`) and each agent repo's role
  `agent.yaml` (`extends`) are wired up separately — until then, point
  `--upstream` at any repo whose `agent.yaml` chain resolves (or a local path).
