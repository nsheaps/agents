# agent-tools-baseline

Centralized mise tool version baseline for all nsheaps agent repos.

## What this is

A single source of truth for the shared `[tools]` baseline across agent repos
(jack, alex, henry, agents). Each consumer repo vendors a copy of
`agent-baseline.mise.toml` into `.config/mise/conf.d/00-agent-baseline.toml`,
which mise loads at the lowest precedence — so a repo's own `mise.toml` always
overrides the baseline.

This is **not** a mise plugin (which would add a tool backend). It is a plain
`[tools]`-only fragment plus distribution scripts.

## How repos consume this

1. The file `.config/mise/conf.d/00-agent-baseline.toml` in each consumer repo is
   a vendored copy of `agent-baseline.mise.toml` (the canonical source here).
2. To sync/update it, run:
   ```
   mise run sync-mise-baseline
   ```
3. To verify it hasn't drifted (run automatically in CI):
   ```
   mise run check-mise-baseline
   ```

## How to override a baseline tool

Re-declare the tool in the repo's own `mise.toml`. It takes precedence over the
`conf.d` baseline because `mise.toml` is higher in mise's load order.

```toml
# In repo/mise.toml — overrides the baseline's bun version for this repo only
[tools]
bun = "1.2.0"
```

## Load order (mise precedence, high → low)

```
mise.local.toml          ← per-user, gitignored
mise.toml                ← repo-specific tools and tasks (overrides baseline)
.config/mise/config.toml ← (unused in these repos)
.config/mise/conf.d/     ← 00-agent-baseline.toml loaded here (lowest precedence)
```

## How to update the baseline

1. Edit `agent-baseline.mise.toml` in this file.
2. Run `mise run sync-mise-baseline` in the agents repo to update the local copy.
3. Commit both files together.
4. In each consumer repo (jack, alex, henry): run `mise run sync-mise-baseline` and commit.

## CI drift detection

Each consumer repo's CI runs `mise run check-mise-baseline` in the lint job. If the
vendored copy has drifted from the canonical (pinned) version, CI fails with a diff.

## Version and tagging

The current version is `0.1.0` (see `VERSION` file). Git tags (`v0.1.0`, etc.) are
used by the fetch-from-URL branch of `sync-mise-baseline` in consumer repos (Phase 2+).

## Files

```
packages/agent-tools-baseline/
├── README.md                     # this file
├── agent-baseline.mise.toml      # CANONICAL [tools]-only fragment
├── VERSION                       # current version (0.1.0)
└── tasks/
    ├── sync-mise-baseline        # copies canonical → .config/mise/conf.d/
    └── check-mise-baseline       # CI gate: vendored copy must match canonical
```
