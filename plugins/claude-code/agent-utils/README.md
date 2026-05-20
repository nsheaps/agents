# agent-utils

Plugin for multi-agent orchestration infrastructure: skills for agent-team coordination + three small Bun/TS tools for settings management. All tools and hooks expect Bun (`>=1.3`) on `$PATH`; agents bootstrapped via `mise.toml` already have it.

## Skills

| Skill                       | Summary                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `tmux-usage`                | Conventions for inspecting peer-agent tmux panes (non-destructive `capture-pane` etc). |
| `writing-agent-team-agents` | Authoring patterns for new agent-team members (orchestrator/PM/eng/QA roles).          |

## Tools

All three tools are JavaScript bundles (built from TypeScript source via `bun build --target=bun`) shipped under `dist/`. They invoke via `bun run ${CLAUDE_PLUGIN_ROOT}/dist/<tool>.js`.

### `settings-write-guard` — PostToolUse hook (wired via `hooks/hooks.json`)

Watches every tool call and warns when the agent writes a `.claude/settings*.json` file OUTSIDE `$AGENT_REPO/.claude/settings.json` (the canonical, restart-persistent settings location). Also fires on `Bash(claude plugin …)` and `/plugin` SlashCommand invocations, since those mutate user-scope settings that don't survive an agent restart.

The hook is informational — it does NOT block the write. See the `agent-utils-phase-2` TODO in source for a planned upgrade to a blocking PreToolUse variant (with an out-of-harness-subagent escape valve).

### `settings-merge` — CLI

Two-stage merge of `$CLAUDE_CONFIG_DIR/.claude/settings.local.json` then `$CLAUDE_CONFIG_DIR/.claude/settings.json` into `$AGENT_REPO/.claude/settings.json`, with `$AGENT_REPO` as the source of truth (existing keys win; new keys from the user-scope files are promoted; conflicts are warned). Creates a `.claude/settings.bak` backup before writing.

Flags: `--dry-run`, `--no-backup`, `--quiet`, `--help`.

### `config-merge` — CLI (general-purpose)

Generic JSON deep-merge with target-wins semantics. The settings-specific behavior of `settings-merge` is layered on top.

Flags: `--in-place`, `--quiet`, `--diff-only`, `--help`.

## Source

Source-of-truth lives in [`nsheaps/.ai-agent-alex/packages/`](https://github.com/nsheaps/.ai-agent-alex/tree/main/packages) as a Bun/TS monorepo (workspaces). Each tool has Jest BDD tests under `packages/<tool>/src/__tests__/` and a GHA CI pipeline (`ts-ci.yaml`) that runs format-check, typecheck, tests, and build on every PR.

## Rebuilding the bundles

```bash
# from nsheaps/.ai-agent-alex
for pkg in config-merge settings-merge settings-write-guard; do
  bun build packages/$pkg/src/bin.ts --target=bun \
    --outfile <path-to-agents-repo>/plugins/claude-code/agent-utils/dist/$pkg.js
done
```

Current bundle sizes: `config-merge.js` ~5.7 KB, `settings-merge.js` ~8.3 KB, `settings-write-guard.js` ~3.8 KB (workspace `@agent-utils/shared` imports inlined at build).
