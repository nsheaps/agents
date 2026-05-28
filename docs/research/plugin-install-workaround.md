# Non-Interactive Claude Code Plugin Installation

**Question**: How can Claude Code plugins be installed non-interactively, without interactive confirmation prompts, to support automation and teammate orchestration?

**Answer**: The evidence suggests that `claude plugin install`, `claude plugin enable`, `claude plugin disable`, `claude plugin uninstall`, and `claude plugin marketplace add` **already work non-interactively from the CLI** without any special flags. No `--yes`, `CI=true`, or other environment variables are needed. Additionally, plugins can be configured by directly editing `~/.claude/settings.json` (specifically the `enabledPlugins` and `extraKnownMarketplaces` keys) and `~/.claude/plugins/installed_plugins.json`.

**Confidence**: High (verified by direct testing on 2026-02-23)

---

## 1. Undocumented Flags and Environment Variables

**Finding**: There are NO undocumented flags or environment variables needed. The CLI subcommands work non-interactively by default.

**Confidence**: High

**Evidence (direct testing, 2026-02-23)**:

```bash
# All of these work without prompts, TTY, or special flags:
claude plugin install typescript-lsp@claude-plugins-official --scope user  # silent success
claude plugin enable typescript-lsp@claude-plugins-official               # "Successfully enabled"
claude plugin disable typescript-lsp@claude-plugins-official              # "Successfully disabled"
claude plugin uninstall typescript-lsp@claude-plugins-official --scope user # silent success
claude plugin marketplace add anthropics/claude-code                       # silent success
claude plugin list --json                                                  # outputs JSON array
```

The `--help` output for `claude plugin install` shows only two options:

- `-h, --help` — Display help
- `-s, --scope <scope>` — Installation scope: user, project, or local (default: "user")

There is no `--yes`, `--non-interactive`, `--no-confirm`, or similar flag because none is needed.

**What about `--dangerously-skip-permissions`?** This flag affects tool permission checks during sessions, not plugin installation. It has no effect on plugin install behavior.

**Environment variables checked**: `CLAUDE_ACCEPT_ALL`, `CLAUDE_NON_INTERACTIVE`, `CI=true`, `CLAUDE_AUTO_ACCEPT` — none of these are documented or appear in help output. They are not needed since install already works without prompts.

### Sources

- `claude plugin install --help` output (local, 2026-02-23)
- `claude --help` output (local, 2026-02-23)
- Direct CLI testing (local, 2026-02-23)

---

## 2. Direct Settings Editing

**Finding**: Plugins can be enabled/disabled by editing `enabledPlugins` in `~/.claude/settings.json`. The `installed_plugins.json` file tracks physical installation state. Both files are standard JSON and can be edited programmatically.

**Confidence**: High

### `enabledPlugins` in `~/.claude/settings.json`

Format:

```json
{
  "enabledPlugins": {
    "plugin-name@marketplace-name": true,
    "another-plugin@marketplace-name": false
  }
}
```

Claude Code reads this on session start. Setting a value to `true` enables the plugin; `false` disables it. This is confirmed by the official docs and by the actual file on disk.

### `extraKnownMarketplaces` in `~/.claude/settings.json`

Format:

```json
{
  "extraKnownMarketplaces": {
    "marketplace-name": {
      "source": {
        "source": "github",
        "repo": "owner/repo"
      }
    }
  }
}
```

Supported source types: `github`, `git`, `url`, `npm`, `file`, `directory`, `hostPattern`.

### `~/.claude/plugins/installed_plugins.json`

This file tracks physical plugin installations with this structure:

```json
{
  "version": 2,
  "plugins": {
    "plugin-name@marketplace-name": [
      {
        "scope": "user",
        "installPath": "/Users/.../.claude/plugins/cache/marketplace/plugin/version",
        "version": "1.0.0",
        "installedAt": "2026-01-08T16:41:54.846Z",
        "lastUpdated": "2026-02-19T20:17:40.947Z",
        "gitCommitSha": "optional-sha"
      }
    ]
  }
}
```

For project-scoped plugins, entries also include `"projectPath"`.

### Known Bug: enabledPlugins and installed_plugins.json Desync

[Issue #20661](https://github.com/anthropics/claude-code/issues/20661) (closed as duplicate of [#17832](https://github.com/anthropics/claude-code/issues/17832)): When installing plugins (especially from directory-based marketplaces), the plugin is added to `installed_plugins.json` but NOT to `enabledPlugins` in `settings.json`. This causes the plugin to appear installed but not show in the "Installed" tab.

**Workaround**: After running `claude plugin install`, also manually add the entry to `enabledPlugins` in `settings.json`, or run `claude plugin enable plugin-name@marketplace`.

### Sources

- [Plugin settings documentation](https://code.claude.com/docs/en/settings) — enabledPlugins and extraKnownMarketplaces format
- [Issue #20661](https://github.com/anthropics/claude-code/issues/20661) — Installed but not enabled bug
- [Issue #17832](https://github.com/anthropics/claude-code/issues/17832) — Directory marketplace plugins not auto-enabled
- `~/.claude/settings.json` (local inspection, 2026-02-23)
- `~/.claude/plugins/installed_plugins.json` (local inspection, 2026-02-23)

---

## 3. GitHub Issues

**Finding**: Multiple feature requests exist for non-interactive plugin install, but the evidence suggests the CLI subcommands already work without prompts. The confusion likely stems from the fact that `/plugin install` (the interactive slash command) is different from `claude plugin install` (the CLI subcommand).

**Confidence**: Medium-High

### Relevant Issues

| Issue                                                            | Title                                                  | Status                       | Notes                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------- |
| [#19522](https://github.com/anthropics/claude-code/issues/19522) | Non-interactive plugin installation                    | Open                         | Requests `claude --not-interactive /plugin install`. No Anthropic response. |
| [#12840](https://github.com/anthropics/claude-code/issues/12840) | Headless/programmatic plugin installation              | Closed (NOT_PLANNED)         | Requests `claude -p "/plugin install"`. Closed after 60 days of inactivity. |
| [#13505](https://github.com/anthropics/claude-code/issues/13505) | Declarative plugin management for Nix/NixOS            | Closed (by author)           | Proposes `claude plugin install --no-interactive` and `claude plugin sync`. |
| [#12999](https://github.com/anthropics/claude-code/issues/12999) | CLI subcommands for programmatic plugin management     | Closed (duplicate of #11676) | Proposes `claude plugin install`, `update`, `remove` CLI subcommands.       |
| [#27247](https://github.com/anthropics/claude-code/issues/27247) | enabledPlugins in settings.local.json silently ignored | Open                         | Critical bug for our use case.                                              |
| [#20661](https://github.com/anthropics/claude-code/issues/20661) | Installed but not added to enabledPlugins              | Closed (dup of #17832)       | Install doesn't auto-enable.                                                |

**Key observation**: Issue #12999 proposed `claude plugin install` as a CLI subcommand — and this was implemented. The current `claude plugin` CLI subcommand tree includes `install`, `uninstall`, `enable`, `disable`, `list`, `update`, and `marketplace` subcommands that all work non-interactively. Many of the feature requests may have been filed before these CLI subcommands existed, or may not be aware they exist.

### Sources

- [Issue #19522](https://github.com/anthropics/claude-code/issues/19522)
- [Issue #12840](https://github.com/anthropics/claude-code/issues/12840)
- [Issue #13505](https://github.com/anthropics/claude-code/issues/13505)
- [Issue #12999](https://github.com/anthropics/claude-code/issues/12999)
- [Issue #27247](https://github.com/anthropics/claude-code/issues/27247)
- [Issue #20661](https://github.com/anthropics/claude-code/issues/20661)

---

## 4. `--plugin-dir` Approach

**Finding**: `--plugin-dir` loads plugins from a local directory for the current session only. It does NOT persist across sessions and does NOT require installation.

**Confidence**: High

### Usage

```bash
claude --plugin-dir ./my-plugin
claude --plugin-dir ./plugin-one --plugin-dir ./plugin-two
```

### Behavior

- Loads the plugin directory directly without requiring `claude plugin install`
- Session-only — does not modify `settings.json` or `installed_plugins.json`
- Useful for development/testing, NOT for persistent automated setup
- The directory must contain a `.claude-plugin/plugin.json` manifest

### For a Local Marketplace Directory

You can set up a directory-based marketplace source in `extraKnownMarketplaces`:

```json
{
  "extraKnownMarketplaces": {
    "my-marketplace": {
      "source": {
        "source": "directory",
        "path": "/absolute/path/to/marketplace"
      }
    }
  }
}
```

Then install plugins from it: `claude plugin install my-plugin@my-marketplace`

This DOES persist across sessions (unlike `--plugin-dir`).

### Sources

- [Plugins documentation](https://code.claude.com/docs/en/plugins) — --plugin-dir usage
- [Discover plugins documentation](https://code.claude.com/docs/en/discover-plugins) — marketplace sources
- `claude --help` output (local, 2026-02-23)

---

## 5. Plugin Cache Structure

**Finding**: The plugin cache at `~/.claude/plugins/` has a well-defined structure that could theoretically be populated manually, but this is fragile and NOT recommended.

**Confidence**: High (structure verified), Low (manual population reliability)

### Directory Layout

```
~/.claude/plugins/
├── blocklist.json              # Blocked plugins (security)
├── cache/                      # Installed plugin files
│   ├── claude-plugins-official/  # One dir per marketplace
│   │   ├── typescript-lsp/
│   │   │   └── 1.0.0/           # One dir per version
│   │   ├── code-simplifier/
│   │   │   └── 1.0.0/
│   │   └── ...
│   ├── nsheaps-claude-plugins/
│   └── ...
├── install-counts-cache.json   # Download/install statistics
├── installed_plugins.json      # Installation registry (version 2)
├── known_marketplaces.json     # Marketplace registry
└── marketplaces/               # Marketplace catalog caches
    ├── claude-plugins-official/
    ├── claude-code-plugins/
    └── ...
```

### Key Files

| File                      | Purpose                                               | Editable?                    |
| ------------------------- | ----------------------------------------------------- | ---------------------------- |
| `installed_plugins.json`  | Tracks all installed plugins, versions, scopes, paths | Yes (JSON, version 2 format) |
| `known_marketplaces.json` | Maps marketplace names to sources and local paths     | Yes (JSON)                   |
| `blocklist.json`          | Plugins blocked for security reasons                  | Yes (JSON)                   |
| `cache/`                  | Actual plugin files (copied from marketplace)         | Could be manually populated  |

### Manual Population

Theoretically possible by:

1. Copying plugin files into `cache/<marketplace>/<plugin>/<version>/`
2. Adding an entry to `installed_plugins.json`
3. Adding `"plugin@marketplace": true` to `enabledPlugins` in `settings.json`

However, this is brittle and not recommended. Use `claude plugin install` instead (it works non-interactively).

### Sources

- `~/.claude/plugins/` directory listing (local inspection, 2026-02-23)
- `~/.claude/plugins/installed_plugins.json` (local inspection, 2026-02-23)
- `~/.claude/plugins/known_marketplaces.json` (local inspection, 2026-02-23)

---

## 6. `settings.local.json` and `enabledPlugins`

**Finding**: There is a CONFIRMED BUG where `enabledPlugins` in `settings.local.json` is silently ignored unless the key also exists in `settings.json`. This is critical for our design principle of plugins writing to `settings.local.json`.

**Confidence**: High (confirmed by [Issue #27247](https://github.com/anthropics/claude-code/issues/27247))

### The Bug

Per [Issue #27247](https://github.com/anthropics/claude-code/issues/27247) (open, filed 2026-02-20):

- If `enabledPlugins` exists ONLY in `settings.local.json`, it is silently dropped during settings merge
- If `enabledPlugins` exists in BOTH `settings.json` and `settings.local.json`, the local values correctly override
- The workaround is to ensure `enabledPlugins` exists in `settings.json` (even as `{}`)

### Settings Precedence (documented)

From highest to lowest:

1. Managed (`managed-settings.json`)
2. Command line arguments
3. Local (`.claude/settings.local.json`)
4. Project (`.claude/settings.json`)
5. User (`~/.claude/settings.json`) — lowest

### Workaround for Our Design

To use `settings.local.json` for `enabledPlugins` (our preferred approach):

1. Ensure `~/.claude/settings.json` contains at minimum: `"enabledPlugins": {}`
2. Then `settings.local.json` overrides will work correctly
3. This is a workaround for the bug in [#27247](https://github.com/anthropics/claude-code/issues/27247)

### Sources

- [Issue #27247](https://github.com/anthropics/claude-code/issues/27247) — enabledPlugins in settings.local.json silently ignored
- [Settings documentation](https://code.claude.com/docs/en/settings) — settings precedence

---

## Recommended Automation Approach

Based on all findings, the evidence suggests this is the most reliable non-interactive plugin installation workflow:

```bash
#!/usr/bin/env bash
# Non-interactive plugin installation for Claude Code

# 1. Add marketplace (if not already known)
claude plugin marketplace add owner/repo

# 2. Install the plugin
claude plugin install plugin-name@marketplace-name --scope user

# 3. Enable the plugin (install may not auto-enable for directory marketplaces)
claude plugin enable plugin-name@marketplace-name

# 4. Verify
claude plugin list --json
```

For fully declarative setup without CLI (e.g., Nix, dotfiles):

```bash
# Ensure enabledPlugins key exists in settings.json (workaround for #27247)
# Then populate installed_plugins.json and enabledPlugins programmatically
# Use jq or similar to merge entries
```

---

## Open Questions

1. **Will the #27247 bug be fixed?** — No Anthropic response yet. Until fixed, `settings.local.json`-only `enabledPlugins` will not work.
2. **Does `claude plugin install` auto-enable?** — Testing showed it does for GitHub-based marketplaces, but [#17832](https://github.com/anthropics/claude-code/issues/17832) reports it does NOT for directory-based marketplaces. Needs further verification per marketplace type.
3. **Is there a `claude plugin sync` command?** — Not yet. Proposed in [#13505](https://github.com/anthropics/claude-code/issues/13505) but not implemented.
4. **Exit codes** — `claude plugin install` returned exit code 0 silently on success. Need to verify error exit codes for failure cases (non-existent plugin, network failure, etc.).

---

## Sources (Complete)

### Official Documentation

- [Plugins (Create)](https://code.claude.com/docs/en/plugins) — Plugin structure, --plugin-dir
- [Discover and Install Plugins](https://code.claude.com/docs/en/discover-plugins) — Installation, marketplaces, team config
- [Settings](https://code.claude.com/docs/en/settings) — enabledPlugins, extraKnownMarketplaces, settings precedence

### GitHub Issues

- [#19522](https://github.com/anthropics/claude-code/issues/19522) — Non-interactive plugin installation (Open)
- [#12840](https://github.com/anthropics/claude-code/issues/12840) — Headless/programmatic plugin installation (Closed, NOT_PLANNED)
- [#13505](https://github.com/anthropics/claude-code/issues/13505) — Declarative plugin management for Nix (Closed by author)
- [#12999](https://github.com/anthropics/claude-code/issues/12999) — CLI subcommands for plugin management (Closed, duplicate of #11676)
- [#27247](https://github.com/anthropics/claude-code/issues/27247) — enabledPlugins in settings.local.json silently ignored (Open)
- [#20661](https://github.com/anthropics/claude-code/issues/20661) — Installed but not added to enabledPlugins (Closed, dup of #17832)
- [#17832](https://github.com/anthropics/claude-code/issues/17832) — Directory marketplace plugins not auto-enabled

### Local Verification

- All CLI commands tested locally on 2026-02-23
- File structures inspected at `~/.claude/plugins/` and `~/.claude/settings.json`
