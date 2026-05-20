---
name: using-settings-merge
description: Use when the handler asks to fold user-scope settings into the canonical repo-scope file, when an agent restart wiped out plugin enablement / marketplace registrations that need to be recovered, or when audit shows drift between `$CLAUDE_CONFIG_DIR/settings*.json` and `$AGENT_REPO/.claude/settings.json`. Trigger phrases — "merge my settings", "fold user-scope into repo-scope", "settings-merge", "recover the settings drift", "what plugins are enabled in my user-scope but not committed?". Requires `$AGENT_REPO/.claude/settings.json` to already exist as the target.
---

# using-settings-merge

`settings-merge` is the recovery tool. It does a 2-stage deep merge of the two user-scope settings files INTO `$AGENT_REPO/.claude/settings.json`, with the repo-scope target as source-of-truth (existing keys win, source-only keys are promoted, conflicts are warned + the target value is kept).

## When to run it

- After a fresh agent clone or first launch, to surface what user-scope state would have been promoted.
- After a manual edit to `~/.claude/settings.json` that should be persisted.
- After auditing drift and finding plugins enabled in user-scope but not in the committed repo-scope.
- When the handler explicitly asks.

## When NOT to run it

- **Automatically post-restart, without handler review.** The merge embeds user-scope state — could promote stale or unwanted keys (e.g., an experimental plugin you no longer want). Always `--dry-run` first and surface the proposed promotions/conflicts to the handler before applying.
- When `$AGENT_REPO/.claude/settings.json` doesn't exist — the tool errors. Create the file first (even as `{}`) if you're bootstrapping.

## Command

```bash
# When installed via plugin:
bun run ${CLAUDE_PLUGIN_ROOT}/dist/settings-merge.js [flags]

# When running from source:
bun run packages/settings-merge/src/bin.ts [flags]
```

Required env: `AGENT_REPO` (target), `CLAUDE_CONFIG_DIR` (source root — falls back to `~/.claude`).

## Flags

- `--dry-run` — show proposed promotions + conflicts; skip the write + backup. **Always run this first.**
- `--no-backup` — skip writing `$AGENT_REPO/.claude/settings.bak` (testing aid; do not use for real recoveries).
- `-q, --quiet` — suppress info-level stderr; warnings + errors still print.
- `-h, --help` — usage.

## Reading the output

Per-pass info lines on stderr:

```
INFO: settings.local.json: skipped (file does not exist)
INFO: settings.json: promoted enabledPlugins.task-utils@agents
INFO: settings.json: promoted extraKnownMarketplaces.foo
WARN: settings.json: enabledPlugins.bar@baz: target=true source=false — keeping target
INFO: [dry-run] target=<path>/.claude/settings.json backup=(none) promotions=2 conflicts=1
```

- `promoted <key>` — source-only key, added to target.
- `<key>: target=X source=Y — keeping target` — conflict; target's value won.
- `[dry-run]` prefix on the summary line — confirms no write happened.
- `backup=<path>` — where `settings.bak` was written. `(none)` in dry-run or with `--no-backup`.

## Recommended sequence

1. `bun run … settings-merge.js --dry-run` — review the punch list with the handler.
2. If happy: re-run without `--dry-run`. A `settings.bak` is created in the target's `.claude/` dir before the write — keep it until you've verified the merge is good.
3. Commit the updated `$AGENT_REPO/.claude/settings.json` so the merged state survives the next restart.

## Sibling skills

- [`what-survives-agent-restart`](../what-survives-agent-restart/SKILL.md) — why repo-scope is the canonical target.
- [`using-settings-write-guard`](../using-settings-write-guard/SKILL.md) — what to do when a fresh write triggers the hook warning (often the upstream cause of drift this skill recovers).
