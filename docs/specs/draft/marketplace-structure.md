# PRD: Marketplace Structure for agent-team

**Status**: Draft
**Author**: Tweety Bird (Docs Writer)
**Date**: 2026-02-16

## Vision

Make the `nsheaps/agent-team` repository function as a Claude Code plugin marketplace — a distributable collection of plugins focused on multi-agent orchestration, team coordination, and agent development.

The model to follow is [`nsheaps/ai`](https://github.com/nsheaps/.ai), which already operates as a working marketplace with 25+ plugins, per-plugin auto-versioning, and integration via `extraKnownMarketplaces` in settings.json.

## Current State

### Repository structure

```
nsheaps/agent-team/
├── .claude/
│   ├── agents/           # 8 agent definitions (orchestrator, coach, etc.)
│   ├── docs/             # Shared team docs (team-structure, communication-protocol, team-rules)
│   ├── skills/           # 2 standalone skills (NOT plugins)
│   │   ├── tmux-usage/SKILL.md
│   │   └── writing-agent-team-agents/SKILL.md
│   ├── settings.json
│   └── CLAUDE.md
├── docs/
│   └── LAUNCH-GUIDE.md
└── package.json          # Has release-it and prettier as devDependencies
```

### What exists today

- **Skills**: Two standalone skills in `.claude/skills/` — auto-discovered by Claude Code but NOT packaged as plugins
- **Agents**: Eight agent definitions in `.claude/agents/` — these define the Looney Tunes team
- **No plugin structure**: No `.claude-plugin/` directories, no `plugin.json` manifests, no `plugins/` top-level directory
- **No marketplace registration**: Not registered as an `extraKnownMarketplaces` source anywhere
- **Versioning**: `release-it` is a devDependency but only versions the root `package.json` (v0.1.0)

## Desired State

### Repository structure (target)

```
nsheaps/agent-team/
├── .claude/
│   ├── agents/           # Agent definitions (unchanged — team-internal, not distributed)
│   ├── docs/             # Shared team docs (unchanged — team-internal)
│   ├── settings.json
│   └── CLAUDE.md
├── plugins/
│   ├── agent-team-skills/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── .release-it.js
│   │   ├── skills/
│   │   │   ├── writing-agent-team-agents/SKILL.md
│   │   │   └── tmux-usage/SKILL.md
│   │   └── README.md
│   ├── <future-plugin>/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   └── ...
│   └── ...
├── docs/
├── .release-it.base.json   # Shared release-it config
└── package.json
```

### Key changes from current state

1. **New `plugins/` top-level directory** — contains distributable plugins, each with its own `.claude-plugin/plugin.json`
2. **Skills migrated into plugins** — existing `.claude/skills/` content moves into `plugins/<name>/skills/`
3. **Per-plugin versioning** — each plugin has its own `.release-it.js` extending a shared base config, using `@release-it/bumper` to version `plugin.json`
4. **Marketplace registration** — consumers add agent-team as an `extraKnownMarketplaces` entry in their settings.json
5. **Agents stay internal** — `.claude/agents/` are team-internal definitions, not distributed as plugins

## Key Features

### 1. Auto-versioning with release-it and conventional commits

Follow the exact pattern from `nsheaps/ai`:

- **Root**: `.release-it.base.json` with shared config (no git tag, no npm publish, no github release — just version bumping)
- **Per-plugin**: `plugins/<name>/.release-it.js` that extends the base and uses `@release-it/bumper` to read/write `plugin.json` version
- **After bump hook**: `prettier --write .claude-plugin/plugin.json`
- **Conventional commits**: Already a devDependency (`@release-it/conventional-changelog`)

Example `.release-it.base.json` (from nsheaps/ai):

```json
{
  "git": {
    "commit": false,
    "tag": false,
    "push": false,
    "requireCleanWorkingDir": false,
    "requireUpstream": false
  },
  "npm": { "publish": false },
  "github": { "release": false },
  "hooks": {
    "after:bump": "prettier --write .claude-plugin/plugin.json || true"
  },
  "increment": "patch"
}
```

Example per-plugin `.release-it.js`:

```javascript
module.exports = {
  extends: "../../.release-it.base.json",
  plugins: {
    "@release-it/bumper": {
      in: ".claude-plugin/plugin.json",
      out: ".claude-plugin/plugin.json",
    },
  },
};
```

### 2. Skills packaged as individual plugins

Each plugin contains:

- `.claude-plugin/plugin.json` — manifest with name, version, description, author, homepage, repository, keywords
- `skills/` — one or more SKILL.md files
- `commands/` — optional slash commands
- `agents/` — optional agent definitions (for distributable agents, NOT the team-internal ones)
- `hooks/` — optional hooks
- `README.md` — documentation

### 3. Plugins installable into the repo itself

The agent-team repo should consume its own plugins via `extraKnownMarketplaces` pointing to itself. This enables:

- Dogfooding — the team uses the plugins it builds
- Validation — broken plugins are caught immediately
- Self-reference — `enabledPlugins` in settings.json can list local plugins

Example settings.json entry:

```json
{
  "extraKnownMarketplaces": {
    "nsheaps-agent-team": {
      "source": {
        "source": "directory",
        "path": "."
      }
    }
  },
  "enabledPlugins": {
    "agent-team-skills@nsheaps-agent-team": true
  }
}
```

### 4. Symlink/auto-config pattern for distribution

Following the nsheaps/ai distribution model:

- **Local directory source**: Other repos point to the agent-team checkout via `extraKnownMarketplaces` with `"source": "directory"`
- **GitHub source**: For non-local consumers, use `"source": "github"` with `"repo": "nsheaps/agent-team"`
- **Plugin discovery**: Claude Code scans the `plugins/` directory for `.claude-plugin/plugin.json` manifests
- **Selective enabling**: Consumers choose which plugins to enable via `enabledPlugins`

## Migration Plan (High-Level)

> **Note**: This section outlines the implementation sequence. Each step should be its own task/PR.

1. Create `.release-it.base.json` at repo root
2. Add `@release-it/bumper` as devDependency
3. Create `plugins/` directory
4. Create first plugin (`agent-team-skills`) with `.claude-plugin/plugin.json` and `.release-it.js`
5. Move skills from `.claude/skills/` into `plugins/agent-team-skills/skills/`
6. Update `.claude/settings.json` to register self as marketplace and enable the plugin
7. Verify skills still load correctly via the plugin
8. Remove now-empty `.claude/skills/` directory

## Open Questions

These should be investigated before or during implementation:

1. **Plugin granularity**: Should each skill be its own plugin, or should related skills be grouped? The nsheaps/ai repo uses one plugin per logical unit (e.g., `scm-utils` groups commit + update-branch skills). For agent-team, grouping all skills into one `agent-team-skills` plugin seems right initially, but may need splitting as the collection grows.

2. **Agent distribution**: Should the agent definitions (`.claude/agents/*.md`) also be packaged as a plugin for distribution? Currently they're team-internal, but other teams might want to install the Looney Tunes roster. This is a separate concern from skills.

3. **Self-referencing marketplace path**: Does `"source": "directory", "path": "."` work for relative paths, or does it need an absolute path? The nsheaps/ai repo uses an absolute path (`/Users/nathan.heaps/src/nsheaps/ai`). If absolute paths are required, that reduces portability.

4. **GitHub marketplace source**: Does `"source": "github"` work for private repos? If agent-team is private, consumers may need the directory source approach.

5. **Versioning scope**: Should the root `package.json` version track independently from plugin versions? In nsheaps/ai, the root is `0.0.1` while plugins have their own version tracks. This seems intentional — the root version is irrelevant.

6. **Cross-marketplace dependencies**: Can a plugin in agent-team depend on a plugin from nsheaps/ai? For example, the agent-team-skills plugin might want to reference scm-utils. How are cross-marketplace dependencies handled (if at all)?

7. **CI integration**: Should plugin version bumps happen in CI, or are they manual? The nsheaps/ai base config disables git commit/tag/push, suggesting manual local bumps committed alongside changes.

## References

- [`nsheaps/ai` repository](https://github.com/nsheaps/.ai) — model marketplace implementation
- [`nsheaps/ai` settings.json](https://github.com/nsheaps/.ai/blob/main/.claude/settings.json) — marketplace registration pattern
- [`nsheaps/ai` .release-it.base.json](https://github.com/nsheaps/.ai/blob/main/.release-it.base.json) — shared versioning config
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)
- [release-it Documentation](https://github.com/release-it/release-it)
- [@release-it/bumper](https://github.com/release-it/bumper) — version bumping for non-npm files
- [ananddtyagi/claude-code-marketplace](https://github.com/ananddtyagi/claude-code-marketplace) — referenced in nsheaps/ai README as another marketplace example
