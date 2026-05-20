---
name: deprecated-agent
status: draft
description: Single canonical bin/agent launcher script in apps/agent-cli/, symlinked from each agent repo; resolves agent context by self-location + agent.yaml walk-up
parent: agent-harness-lifecycle
related:
  - agents-cli
  - agent-harness-lifecycle
  - auth-credentials
owner: alex
created: 2026-05-20
updated: 2026-05-20
tags:
  - launcher
  - consolidation
  - symlink
  - agent-cli
source: https://discord.com/channels/1490863845252665415/1497431286661517353/1506480193143967855
---

# deprecated-agent

> **Spec for the canonical `bin/agent` launcher consolidation.** Replaces the three drifting per-agent copies (`.ai-agent-alex/bin/agent`, `.ai-agent-henry/bin/agent`, `.ai-agent-jack/bin/agent`) with a single script under `apps/agent-cli/bin/deprecated-agent`. Each agent repo's `bin/agent` becomes a symlink to it. The script resolves its agent context from the symlink's location (walk up to find `agent.yaml`), so the same source serves every agent.

## Status

DRAFT — not yet implemented. This document is the contract we'll validate the implementation against. Implementation is a follow-up PR after spec approval.

## Problem

Each agent repo (alex/henry/jack) currently maintains its own copy of `bin/agent` (~54 KB, ~1120 lines) plus the supporting `bin/lib/*.sh` helpers. The copies drift:

- **As of 2026-05-20**: henry and jack are byte-identical; alex is 4 lines behind on the bullet-1 launch-log reorder (task #147 implemented it locally, peers got the slightly-different final form).
- Fix-once propagation is impossible without a 3-PR fan-out.
- The `bin/lib/*` helpers ARE identical across agents, but they live three times on disk.

## Goal

One file to edit. One change to ship. Symlinks fan it out.

## Non-goals

- Replacing `bin/agent` with a richer subcommand structure (`agent run`, `agent restart`, `agent debug`, …). That's the long-term [`agents-cli`](agents-cli.md) work. `deprecated-agent` is the back-compat shim that the eventual `agent` subcommand will displace.
- Touching `agent-kenny/bin/agent` — different launcher generation, out of scope.
- Changing any per-agent behavior. The canonical script must behave IDENTICALLY to today's henry/jack copy (the most-recent version), and alex must catch up via the symlink swap.

## Design

### Location

```
nsheaps/agents/
└── apps/
    └── agent-cli/
        ├── bin/
        │   └── deprecated-agent      ← canonical launcher (was three copies)
        └── lib/                       ← (open question: bin/lib/ vs lib/)
            ├── agent-name.sh
            ├── agent-env.sh
            ├── op-inject.sh
            ├── marketplace.sh
            ├── claude-patch.sh
            ├── seed-claude-json.sh
            ├── tmux.sh
            ├── stdlib.sh
            ├── test-env.sh
            └── patch-binary.py
```

### Symlink contract

Each agent repo's `bin/agent` becomes:

```bash
bin/agent → /path/to/nsheaps/agents/apps/agent-cli/bin/deprecated-agent
```

The symlink target MAY be:
- an absolute path during local development (as above), OR
- a relative path through a sibling checkout (e.g. `../../agents/apps/agent-cli/bin/deprecated-agent`), OR
- a mise-resolved path (if `apps/agent-cli` is published as a mise tool — TBD).

The script MUST NOT care which form the symlink takes — it only looks at `realpath "$0"` to find ITSELF and `dirname "$0"` (pre-realpath) to find the AGENT REPO that invoked it.

### Self-location

```bash
# SCRIPT_PATH: canonical script location (follow symlinks)
SCRIPT_PATH="$(realpath "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"          # apps/agent-cli/bin
LIB_DIR="$(dirname "$SCRIPT_PATH")/../lib"      # apps/agent-cli/lib (TBD)

# INVOCATION_PATH: where the user/symlink called from (do NOT follow symlinks)
INVOCATION_PATH="$0"
INVOCATION_DIR="$(dirname "$INVOCATION_PATH")"  # e.g. .ai-agent-alex/bin

# REPO_DIR: walk up from INVOCATION_DIR until agent.yaml is found
REPO_DIR="$(_find_repo_root_via_agent_yaml "$INVOCATION_DIR")"
```

The walk-up failure mode (no `agent.yaml` anywhere up to `/`) MUST abort the launcher with a clear error pointing at the missing file (current behavior: relies on `cd $(dirname $0)/..` and assumes that's the repo root — this spec makes the contract explicit).

### Per-agent config

All per-agent context still reads from `REPO_DIR` (the agent repo containing the symlink):

- `REPO_DIR/agent.yaml` → `AGENT_NAME` (via `agent_name_resolve`)
- `REPO_DIR/.claude/settings.local.json` → bootstrap `OP_SERVICE_ACCOUNT_TOKEN`
- `REPO_DIR/.envrc.template` → templated to `$AGENT_HOME_DIR/.envrc`
- `REPO_DIR/.claude/{prompts,tmp,logs}/` → CONTINUATION.md, restart-flags, launcher logs
- `REPO_DIR/.claude/.claude.json` → seed for `$AGENT_HOME_DIR/.claude/.claude.json`
- `REPO_DIR/bin/lib/` → **NOT USED** anymore — the canonical script sources from `LIB_DIR` (under apps/agent-cli/).

So the agent repos' existing `bin/lib/*.sh` directories become dead code after the symlink swap and SHOULD be deleted in the same migration PR (per-agent) to keep the repos clean.

## Feature inventory & validation

The script must support every feature currently present in alex/henry/jack's `bin/agent`. The audit (see `.claude/tmp/deprecated-agent-audit.md` in the alex repo) catalogues 27 functional regions. Below: each region with its acceptance criterion.

### Startup safety

| # | Feature | Validation |
|---|---|---|
| 1 | Self-launch guard prevents recursion (`AGENT_LAUNCHER_PID`) | Run `bin/agent`; from inside the resulting claude session, attempt to run `bin/agent` again — should exit 1 with "Cannot launch agent from inside a running agent session." |
| 2 | Env-var wipe on each launch: `AGENT_NAME`, `AGENT_HOME_DIR`, `XDG_*`, `GH_TOKEN`, `GITHUB_TOKEN`, `GITHUB_APP_*`, `GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `CLIENT_*` | Set `AGENT_NAME=wrong` in parent shell, run `bin/agent`; launcher resolves to the actual name from `agent.yaml`, not "wrong" |

### Self-location & repo discovery

| # | Feature | Validation |
|---|---|---|
| 3 | `realpath "$0"` resolves the symlink to the canonical script | Symlink `.ai-agent-alex/bin/agent` → `apps/agent-cli/bin/deprecated-agent`; running the symlink logs the canonical path on a `[debug] script=` line |
| 4 | `REPO_DIR` walk-up finds the AGENT repo's `agent.yaml`, NOT the script's nearest ancestor | When invoked via the alex symlink, `REPO_DIR` resolves to `.ai-agent-alex`, NOT `nsheaps/agents` |
| 5 | Walk-up failure (no `agent.yaml` found up to `/`) aborts with a clear error | Move agent.yaml out of the way, run the symlink → exit 1 with "agent.yaml not found in any ancestor of \<dir\>" |

### Agent identity & env derivation

| # | Feature | Validation |
|---|---|---|
| 6 | `agent_name_resolve` reads `$REPO_DIR/agent.yaml` (key: `name`) and exports `AGENT_NAME` | `bin/agent` invocation from each of alex/henry/jack resolves to its OWN name |
| 7 | `AGENT_HOME_DIR = $HOME/.agents/$AGENT_NAME` | After launch, env `\| grep AGENT_HOME_DIR` shows the correct per-agent path |
| 8 | XDG vars (`XDG_CONFIG_HOME`, `XDG_DATA_HOME`, etc.) export BEFORE mise/direnv runs | `ls $AGENT_HOME_DIR/.local/share/mise/installs` populated after first launch (not `~/.local/share/mise/installs`) |
| 9 | `AGENT_DEBUG=*` default; never `DEBUG=*` (would leak auth headers via axios) | `env \| grep ^DEBUG=` post-launch shows nothing |

### Flag parsing

| # | Feature | Validation |
|---|---|---|
| 10 | `--tmux` / `--no-tmux` toggles tmux session creation | `bin/agent --no-tmux` does not create a tmux session |
| 11 | `--force-patch` / `--no-force-patch` overrides patch policy | With `--force-patch`, first iteration patches even if symlink is valid |
| 12 | `--patch-if-untested` / `--no-patch-if-untested` (default true) | With `--no-patch-if-untested`, an untested claude version is NOT patched |
| 13 | `--with-dialog-accept-fallback` enables tmux DevChannelsDialog auto-accept | When dialog appears mid-launch, the watcher sends Enter |
| 14 | Other args are forwarded to claude | `bin/agent --debug` passes `--debug` through to claude |

### Logging

| # | Feature | Validation |
|---|---|---|
| 15 | `LOG_FILE = $REPO_DIR/.claude/logs/launcher.<epoch>.log` per iteration | After launch, `launcher.<epoch>.log` exists with iteration-specific content |
| 16 | `restart-history.log` records every restart with timestamp | Re-exec via signal; `restart-history.log` gains an entry |
| 17 | `log()` writes to stderr AND `$LOG_FILE` so `build_args` stdout stays clean | Stderr has timestamped lines; `build_args` output (stdout) is bare args |
| 18 | Bullet-1 ordering: "Running claude:" log lands BEFORE `build_prompt()` so the prompt-snapshot includes it | First message of a fresh restart contains the `Running claude:` line within the launcher-logs block |

### Env injection

| # | Feature | Validation |
|---|---|---|
| 19 | Bootstrap: read `.env` from `$REPO_DIR/.claude/settings.local.json`, export keys (incl. `OP_SERVICE_ACCOUNT_TOKEN`) | `op whoami` succeeds inside a Bash tool call in the resulting session |
| 20 | `mise activate bash` + `mise env -s bash`, stderr → `$LOG_FILE` | `mise ls` works inside the resulting session; trust errors visible in launcher log |
| 21 | claude-utils lib sourced from `mise where github:nsheaps/claude-utils`/lib | After launch, `claude_resolve_binary` (or another claude-utils function) available |
| 22 | `.envrc.template` → `$AGENT_HOME_DIR/.envrc` (idempotent), then `source` it | First launch: file materialized; per-agent `.env.local` values appear in env |
| 23 | `op_inject_env` runs AFTER `.envrc`/`.env.local` sourcing so fresh op-exec values override stale (#177) | After launch, `CLAUDE_CODE_OAUTH_TOKEN` matches the current 1Password vault value (post-rotation), not the previous .env.local value |
| 24 | PEM materialization: when `GITHUB_APP_PRIVATE_KEY` is in env but `_PATH` isn't, write the key to `$AGENT_HOME_DIR/.config/github-app-<id>.pem` (0600) | `gh-auth` next step finds and reads the PEM |

### Marketplace + plugins

| # | Feature | Validation |
|---|---|---|
| 25 | `marketplace_bootstrap` adds declared marketplaces if missing | First launch: marketplace clone appears under `$AGENT_HOME_DIR/.claude/plugins/marketplaces/` |
| 26 | `marketplace_prune_orphans` removes auto-installed plugins not declared in settings | Run with an orphaned plugin present; subsequent launch removes it |
| 27 | Claude CLI patching is delegated to `$REPO_DIR/bin/claude` (the per-agent wrapper) | `bin/claude-patched` symlink points at a per-version output; broken state surfaces in launcher log |

### Auth refresh

| # | Feature | Validation |
|---|---|---|
| 28 | Pre-marketplace `gh-auth` token refresh from GitHub App credentials (#104) | Launcher log shows refresh timestamps; `gh auth status` post-launch reports the App identity |
| 29 | `GH_TOKEN` exported ONLY when app/installation identity matches AND refresh succeeded (#102, #104) | On identity mismatch (e.g. wrong vault env), `GH_TOKEN` is NOT exported; launcher logs the gate decision |

### direnv

| # | Feature | Validation |
|---|---|---|
| 30 | `direnv allow .` + `direnv export bash` with stderr → `$LOG_FILE`, 30s timeout | `direnv: error` line in output aborts the launcher iteration (exit 1) |
| 31 | `which -a claude` + `mise which claude` divergence surfaced in log | When a globally-installed claude shadows the mise version, the launcher log makes it obvious |

### Args & prompt

| # | Feature | Validation |
|---|---|---|
| 32 | `build_args`: `--name "[Agent <name>]"`, `--debug`, `--append-system-prompt-file`, `--continue`, `--dangerously-load-development-channels`, `--permission-mode`, `--dangerously-skip-permissions` | `ps -ef \| grep claude` shows the expected set |
| 33 | One-time CLI flags: read `.claude/tmp/restart-flags`, consume (rm) after read | After a launch that consumed it, the file is gone |
| 34 | `build_prompt`: launcher-log snippet + CONTINUATION.md + preserved todos + system footer | First message in the new session contains all four parts |
| 35 | CONTINUATION.md is archived after consumption (per #169) — not embedded twice | After consumption, `.claude/prompts/CONTINUATION.md` is moved to a consumed-continuations archive |
| 36 | Startup-prompt log: `## Launcher Logs (since last start)` block stripped from the in-file log to avoid recursion | `tail launcher.<epoch>.log` shows the prompt without the embedded launcher-log section |

### Restart loop

| # | Feature | Validation |
|---|---|---|
| 37 | `ensure_tmux`: drop into / attach a tmux session named `$AGENT_NAME` | First launch outside tmux: `tmux ls` shows `<AGENT_NAME>` |
| 38 | Cold-start retry: claude rc=1 with `--continue` → strip `--continue`, re-run once | First-ever launch on a fresh state succeeds on the retry |
| 39 | Fast-crash warn: runtime < 10s → log a warning | A bin/agent that fails immediately produces a "possible startup failure" line |
| 40 | Re-exec `$0 "$@"` after every iteration so script edits take effect on next launch | Edit `bin/agent` mid-session, exit; next iteration runs the new version |

## Open questions

1. **`lib/` placement**: `apps/agent-cli/lib/` vs `apps/agent-cli/bin/lib/`? The latter mirrors today's per-agent structure but feels redundant. Recommend `apps/agent-cli/lib/` — `bin/` is for executables.
2. **Naming**: `deprecated-agent` is intentional during migration to a proper `agent` subcommand under [`agents-cli`](agents-cli.md). Confirming this is the back-compat shim, not a long-term name. Once `agent` subcommand exists, this shim is retired (and each repo's `bin/agent` symlink updates target).
3. **Migration order**: which agent gets symlinked first? Recommend henry (peer-validatable, not self) → jack → alex.
4. **Per-agent rc.d**: `$AGENT_HOME_DIR/rc.d/` (and the `rc.d/` in agent repos) is loaded by `.envrc.template` — out of scope for this consolidation since it's already per-agent. Just noting.
5. **Versioning**: does `apps/agent-cli` get a semver of its own? Mise-installable? Or just lives as a path in nsheaps/agents that's hardcoded in symlinks during dev?

## Migration plan (for the implementation PR — NOT this spec PR)

1. Land THIS spec PR (review-only).
2. Copy henry/jack's `bin/agent` byte-for-byte to `apps/agent-cli/bin/deprecated-agent` + copy `bin/lib/*` to `apps/agent-cli/lib/`.
3. Update the canonical script's `source` paths to use `LIB_DIR` (see §Self-location).
4. Add `_find_repo_root_via_agent_yaml` (walk-up) and update REPO_DIR derivation.
5. Sync alex's bin/agent to the henry/jack version first (task #207) — pre-consolidation drift fix.
6. On henry's repo: replace `bin/agent` regular file with the symlink. Restart henry. Validate every row in the feature table.
7. Repeat for jack.
8. Repeat for alex (last per modify-self-last).
9. Remove `bin/lib/` directories from each agent repo (now unused).

## Rollback

Each per-agent migration is a single-commit symlink swap. To roll back: replace the symlink with the previous `bin/agent` file content (recoverable from git).

## Out of scope / not covered

- `bin/claude` (the per-agent claude wrapper that owns binary patching) — stays per-agent for now; can be consolidated later via the same pattern.
- `bin/start-agent` / `bin/run-agent` / `bin/attach-agent` / `bin/run-and-attach-agent` — same story, per-agent for now.
- agent-team-cli concerns — separate.

## Source

Handler ask: Nate Discord [2026-05-20 02:14:27Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1506480193143967855) — "Make this script: nsheaps/agents:apps/agent-cli/bin/deprecated-agent. Make it work exactly like bin/agent. Then in henry's repo, update bin/agent symlink to deprecated-agent script. This script needs to work for all the agents. … I want to manage only one copy of the script."
