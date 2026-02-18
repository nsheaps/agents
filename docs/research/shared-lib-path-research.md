# Shared Library Paths Between Claude Code Plugins — Research Report

**Date**: 2026-02-17
**Context**: PR [#164](https://github.com/nsheaps/ai-mktpl/pull/164) in nsheaps/ai-mktpl extracts `plugins/shared/lib/safe-settings-write.sh` and sources it from two sibling plugins via relative path.

---

## Question 1: Can a plugin guarantee the path to a neighboring plugin's files?

**Answer: No — not in installed/cached state.**

### How `CLAUDE_PLUGIN_ROOT` works

- `${CLAUDE_PLUGIN_ROOT}` resolves to the **individual plugin's root directory**, not any parent.
- Each plugin gets its own isolated root. There is no "marketplace root" or "parent plugins root" variable.

### Installed cache structure (verified empirically)

```
~/.claude/plugins/cache/nsheaps-claude-plugins/
├── statusline/
│   └── 0.1.10/          ← CLAUDE_PLUGIN_ROOT for statusline
│       ├── .claude-plugin/plugin.json
│       ├── bin/statusline.sh
│       └── hooks/...
├── statusline-iterm/
│   └── 0.1.23/          ← CLAUDE_PLUGIN_ROOT for statusline-iterm
│       ├── .claude-plugin/plugin.json
│       ├── bin/statusline.sh
│       └── hooks/...
└── (no shared/ directory exists in cache)
```

**Key observation**: The `plugins/shared/` directory from the source repo is NOT a registered plugin (it has no `.claude-plugin/plugin.json`), so it is **never copied to the cache**. Relative paths like `../../shared/lib/safe-settings-write.sh` resolve to nothing in the installed state.

### PR #164's current approach

The hooks resolve the shared lib path at runtime:
```bash
SHARED_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/shared/lib/safe-settings-write.sh"
```

This traverses up two directories from the hook script's location, expecting to find `shared/` as a sibling of the plugin directory. **This works in the source tree** (`plugins/statusline/hooks/` → `plugins/shared/`) but **fails in the installed cache** because:

1. The hook runs from `~/.claude/plugins/cache/nsheaps-claude-plugins/statusline/0.1.10/hooks/`
2. Two levels up is `~/.claude/plugins/cache/nsheaps-claude-plugins/statusline/`
3. There is no `shared/` directory there

**Verdict: The relative-path approach in PR #164 will break when plugins are installed from the marketplace.**

---

## Question 2: Do symlinks propagate on install?

**Answer: Yes — symlinks are resolved and their target content is copied.**

From the [Claude Code plugin docs](https://code.claude.com/docs/en/plugins):
> If your plugin needs to access files outside its directory, you can create symbolic links to external files within your plugin directory. Symlinks are honored during the copy process: the symlinked content will be copied into the plugin cache.

### What this means in practice

If you symlink the shared lib *into* each plugin:
```
plugins/statusline/lib/safe-settings-write.sh → ../../shared/lib/safe-settings-write.sh  (symlink)
plugins/statusline-iterm/lib/safe-settings-write.sh → ../../shared/lib/safe-settings-write.sh  (symlink)
```

Then when installed, each plugin's cache will contain a **real copy** of the file:
```
~/.claude/plugins/cache/.../statusline/0.1.10/lib/safe-settings-write.sh       (real file)
~/.claude/plugins/cache/.../statusline-iterm/0.1.23/lib/safe-settings-write.sh  (real file)
```

**This is the correct approach** — each plugin gets its own copy, referenced via `${CLAUDE_PLUGIN_ROOT}/lib/safe-settings-write.sh`.

### Important caveats

- The copy is a **snapshot at install time** — changes to the original don't propagate to installed plugins until re-install/upgrade.
- The symlink itself is not preserved; the resolved content is copied.
- This only works for files symlinked *into* the plugin's own directory tree.

---

## Question 3: Recommended pattern for sharing code between plugins

### Recommended: Symlink into each plugin (Option A)

**Source tree layout:**
```
plugins/
├── shared/                              # NOT a plugin, just a shared source directory
│   └── lib/
│       └── safe-settings-write.sh       # Single source of truth
├── statusline/
│   ├── .claude-plugin/plugin.json
│   ├── lib/
│   │   └── safe-settings-write.sh → ../../shared/lib/safe-settings-write.sh
│   └── hooks/
│       └── configure-statusline.sh      # sources ${CLAUDE_PLUGIN_ROOT}/lib/safe-settings-write.sh
└── statusline-iterm/
    ├── .claude-plugin/plugin.json
    ├── lib/
    │   └── safe-settings-write.sh → ../../shared/lib/safe-settings-write.sh
    └── hooks/
        └── configure-statusline.sh      # sources ${CLAUDE_PLUGIN_ROOT}/lib/safe-settings-write.sh
```

**Hook script change:**
```bash
# BEFORE (PR #164 — broken in cache):
SHARED_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/shared/lib/safe-settings-write.sh"

# AFTER (works everywhere):
SHARED_LIB="${CLAUDE_PLUGIN_ROOT}/lib/safe-settings-write.sh"
```

**Why this works:**
1. During development, the symlink resolves to the shared source.
2. During install, the symlink target is copied into the plugin's cache as a real file.
3. `${CLAUDE_PLUGIN_ROOT}/lib/safe-settings-write.sh` resolves correctly in both contexts.
4. Single source of truth maintained via symlinks in the repo.

### Alternative: Symlink the entire shared directory

```
plugins/statusline/shared → ../shared/         # Symlink entire directory
plugins/statusline-iterm/shared → ../shared/   # Symlink entire directory
```

Then reference as `${CLAUDE_PLUGIN_ROOT}/shared/lib/safe-settings-write.sh`. Same principle, just different granularity.

### NOT recommended

| Approach | Why not |
|----------|---------|
| Relative paths crossing plugin boundaries (`../../shared/...`) | Breaks in installed cache; `shared/` isn't a plugin and won't be cached |
| Relying on predictable cache paths | Version directories change; violates plugin isolation model |
| Making `shared/` a plugin just to get it cached | Adds unnecessary plugin overhead for a library with no hooks/commands/skills |
| Copying files manually (no symlinks) | Violates DRY; files drift out of sync |

---

## Summary of Findings

| Question | Answer |
|----------|--------|
| Can one plugin reference another's files? | No — each plugin is isolated with its own `CLAUDE_PLUGIN_ROOT` |
| Does `CLAUDE_PLUGIN_ROOT` help cross-plugin? | No — it only points to the current plugin's root |
| Do symlinks propagate on install? | Yes — resolved content is copied into the cache |
| PR #164's relative path approach? | **Broken in installed state** — `shared/` won't exist in cache |
| Recommended fix? | Symlink shared files *into* each plugin, reference via `CLAUDE_PLUGIN_ROOT` |

---

## References

- [Claude Code Plugin Docs — Caching and File Resolution](https://code.claude.com/docs/en/plugins)
- Empirical verification of cache structure at `~/.claude/plugins/cache/nsheaps-claude-plugins/`
- PR #164 diff: `plugins/shared/lib/safe-settings-write.sh` sourced from two hooks via relative path
