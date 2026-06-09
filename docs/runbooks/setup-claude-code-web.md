# Runbook: Auto-configure Claude Code on the web

Bootstrap a [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
environment with a standard marketplace + plugin set so unattended sessions
auto-configure permissions, secrets, git auth, and tool installs — no
interactive prompts, no per-session manual setup.

The bootstrap lives in [`bin/setup-claude-web`](../../bin/setup-claude-web) and is
designed to be `curl`-ed and run from the web environment's **Setup script**.

## TL;DR

In the cloud environment settings (**Cloud environment → Setup script**), paste:

```bash
curl -fsSL https://raw.githubusercontent.com/nsheaps/agents/main/bin/setup-claude-web | bash
```

That's it. On the next session the standard plugins are installed and enabled.

## What it configures

| Plugin             | Why it's in the standard set                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `dangerous-bypass` | Auto-approves **all** permission requests (unattended web agent has no human to approve prompts). |
| `1pass`            | Installs the 1Password CLI and injects secrets at session start.                                  |
| `github-app`       | Generates + refreshes a GitHub App token, configures git identity.                                |
| `shared-lib`       | Runtime bash libraries that `1pass` + `github-app` depend on.                                     |
| `mise`             | Installs tools declared in `mise.toml` on session start.                                          |

All come from the [`nsheaps/ai-mktpl`](https://github.com/nsheaps/ai-mktpl) marketplace.

## Why a setup script (not just settings.json)

Claude Code's **Setup script** runs as root _before_ Claude Code launches, and its
filesystem state — including `~/.claude` — is cached as a VM snapshot. Installing
plugins here **warms the plugin cache** so the very first session already has them
available. This is the recommended workaround for the known issue where plugins
declared in `settings.json` are not installed on first launch but appear on later
ones ([ai-mktpl#261](https://github.com/nsheaps/ai-mktpl/issues/261)).

The script does both, belt-and-suspenders:

1. `claude plugin marketplace add` + `claude plugin install` (warms the cache, writes scoped settings).
2. A non-destructive `jq` merge of `enabledPlugins` + `extraKnownMarketplaces` into
   the user `settings.json`, so the config is present even if the CLI isn't on PATH
   at setup time.

It is idempotent — safe to re-run, never clobbers unrelated settings.

## Customizing

Override the defaults with environment variables in the setup script before the
`curl`. Examples:

```bash
# Only the three core plugins, no mise/shared-lib autoselect (deps still resolve):
export CLAUDE_WEB_PLUGINS="dangerous-bypass@ai-mktpl 1pass@ai-mktpl github-app@ai-mktpl"
curl -fsSL https://raw.githubusercontent.com/nsheaps/agents/main/bin/setup-claude-web | bash
```

```bash
# Add a second marketplace and a plugin from it:
export CLAUDE_WEB_MARKETPLACES="ai-mktpl=nsheaps/ai-mktpl agents=nsheaps/agents"
export CLAUDE_WEB_PLUGINS="1pass@ai-mktpl github-app@ai-mktpl agent-utils@agents"
curl -fsSL https://raw.githubusercontent.com/nsheaps/agents/main/bin/setup-claude-web | bash
```

| Variable                  | Default                                                                                          | Meaning                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `CLAUDE_WEB_MARKETPLACES` | `ai-mktpl=nsheaps/ai-mktpl`                                                                      | `<name>=<owner/repo>` tokens, whitespace-sep.    |
| `CLAUDE_WEB_PLUGINS`      | `dangerous-bypass@ai-mktpl 1pass@ai-mktpl github-app@ai-mktpl shared-lib@ai-mktpl mise@ai-mktpl` | `<plugin>@<marketplace>` tokens, whitespace-sep. |
| `CLAUDE_WEB_SCOPE`        | `user`                                                                                           | `user` \| `project` \| `local`.                  |
| `CLAUDE_CONFIG_DIR`       | `$HOME/.claude`                                                                                  | Where the user `settings.json` is written.       |

> ⚠️ **Security:** `dangerous-bypass` auto-approves _every_ tool call without
> confirmation. That is intentional for an unattended web agent but means there is
> no human-in-the-loop. Drop it from `CLAUDE_WEB_PLUGINS` (the narrower
> `web-auto-approve@ai-mktpl` is an alternative) if you want prompts.

## Secrets

This script only wires up the **plugins**. The `1pass` and `github-app` plugins
still need their own configuration (an `OP_SERVICE_ACCOUNT_TOKEN` env var,
`op://` references, and `GITHUB_APP_*` env) supplied by the environment and a
`plugins.settings.yaml`. See those plugins' READMEs and the
[create-1password-vault-and-service-account](./create-1password-vault-and-service-account.md)
and [create-github-app](./create-github-app.md) runbooks.

## Verifying

In a fresh session:

```bash
claude plugin list
```

The five plugins (or your custom set) should appear as installed + enabled.
