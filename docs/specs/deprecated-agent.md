---
name: deprecated-agent
status: draft
description: Single canonical bin/agent launcher script in apps/agent-cli/, invoked from each agent repo via a thin shim that passes agentName + repoDir
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
  - shim
  - agent-cli
source: https://discord.com/channels/1490863845252665415/1497431286661517353/1506480193143967855
---

# deprecated-agent

> **Spec for the canonical `bin/agent` launcher consolidation.** Replaces the three drifting per-agent copies (`.ai-agent-alex/bin/agent`, `.ai-agent-henry/bin/agent`, `.ai-agent-jack/bin/agent`) with a single script under `apps/agent-cli/bin/deprecated-agent`. Each agent repo's `bin/agent` becomes a tiny **shim file** (not a symlink) that resolves the agent name from the repo's `agent.yaml` and execs the canonical script with `<agentName> <repoDir>` as positional args. Every agent ships an IDENTICAL shim — the shim file is byte-for-byte the same across all three repos.

## Status

DRAFT — not yet implemented. This document is the contract we'll validate the implementation against. Implementation is a follow-up PR after spec approval.

**Pivot note (2026-05-20):** initial spec proposed a symlink + self-location-via-realpath design; Nate ([02:42:10Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1506487172067495996)) chose the shim variant instead. The canonical script no longer needs to walk filesystem ancestry — the shim hands it `<agentName>` and `<repoDir>` explicitly.

## Problem

Each agent repo (alex/henry/jack) currently maintains its own copy of `bin/agent` (~54 KB, ~1120 lines) plus the supporting `bin/lib/*.sh` helpers. The copies drift:

- **As of 2026-05-20**: henry and jack are byte-identical; alex is 4 lines behind on the bullet-1 launch-log reorder (task #147 implemented it locally, peers got the slightly-different final form).
- Fix-once propagation is impossible without a 3-PR fan-out.
- The `bin/lib/*` helpers ARE identical across agents, but they live three times on disk.

## Goal

One file to edit. One change to ship. A trivial identical shim in each repo dispatches into the canonical script.

## Non-goals

- Replacing `bin/agent` with a richer subcommand structure (`agent run`, `agent restart`, `agent debug`, …). That's the long-term [`agents-cli`](agents-cli.md) work. `deprecated-agent` is the back-compat shim that the eventual `agent` subcommand will displace.
- Touching `agent-kenny/bin/agent` — different launcher generation, out of scope.
- Changing any per-agent behavior. The canonical script must behave IDENTICALLY to today's henry/jack copy (the most-recent version), and alex must catch up via the shim swap.

## Design

### Location

```
nsheaps/agents/
└── apps/
    └── agent-cli/
        ├── bin/
        │   └── deprecated-agent      ← canonical launcher (was three copies)
        └── lib/                       ← (open question §1: bin/lib/ vs lib/)
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

### Shim contract

Each agent repo's `bin/agent` is a small executable shell file with the following IDENTICAL content across all three repos:

```bash
#!/usr/bin/env bash
# bin/agent — thin shim. Resolves agentName from agent.yaml and delegates to
# the canonical launcher at apps/agent-cli/bin/deprecated-agent in nsheaps/agents.
#
# This file is intentionally identical across alex/henry/jack. Edit the
# canonical script (apps/agent-cli/bin/deprecated-agent), not this shim.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_NAME="$(yq -r '.name' "$REPO_DIR/agent.yaml")"

# TODO(portability, open question §5): hardcoded path to the nsheaps/agents
# checkout. Nate confirmed (02:42:10Z) "for now assume yes" on the dev layout;
# production / CI / peer-machine support deferred. Replace with an env var
# (e.g. $AGENTS_REPO_DIR) or sibling-checkout convention when needed.
DEPRECATED_AGENT="/home/nsheaps/src/nsheaps/agents/apps/agent-cli/bin/deprecated-agent"

exec "$DEPRECATED_AGENT" "$AGENT_NAME" "$REPO_DIR" "$@"
```

**Key properties:**

- The shim is a REGULAR FILE, not a symlink. Each agent repo gets its own copy of the shim, but the bytes are identical.
- The shim does ONLY three things: (a) compute `REPO_DIR` lexically from `$(dirname "$0")/..`, (b) read `agentName` from `agent.yaml` via `yq`, (c) exec the canonical script with those values + any forwarded args.
- The canonical script receives `<agentName>` and `<repoDir>` as positional args — no filesystem ancestry walk needed.
- Any future portability fix (env var, sibling-checkout convention, mise-installable canonical path) is a one-line change to the shim, propagated identically to every agent repo.

### Canonical script signature

```bash
#!/usr/bin/env bash
# apps/agent-cli/bin/deprecated-agent
# Canonical launcher invoked by per-agent shims at <repo>/bin/agent.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "fatal: deprecated-agent must be invoked via a per-agent bin/agent shim" >&2
  echo "       usage: deprecated-agent <agentName> <repoDir> [claude args...]" >&2
  exit 1
fi

AGENT_NAME="$1"; shift
REPO_DIR="$1"; shift
# remaining "$@" = flags forwarded to claude

SCRIPT_PATH="$(realpath "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"          # apps/agent-cli/bin
LIB_DIR="$(dirname "$SCRIPT_PATH")/../lib"      # apps/agent-cli/lib (TBD §1)

# ... rest of the existing bin/agent body, unchanged, using $AGENT_NAME and $REPO_DIR
```

**Self-location is now trivial:**

- The canonical script's own location: `realpath "$0"`. Used to find `LIB_DIR`.
- The invoking agent's repo: `$REPO_DIR` (handed in by the shim).
- The agent name: `$AGENT_NAME` (handed in by the shim).

No `dirname "$0"` walk-up, no ambiguous "where was I invoked from", no symlink resolution edge cases.

### Per-agent config

All per-agent context still reads from `$REPO_DIR` (passed in by the shim):

- `REPO_DIR/agent.yaml` → `AGENT_NAME` (already resolved by shim, but canonical script can sanity-check the arg matches)
- `REPO_DIR/.claude/settings.local.json` → bootstrap `OP_SERVICE_ACCOUNT_TOKEN`
- `REPO_DIR/.envrc.template` → templated to `$AGENT_HOME_DIR/.envrc`
- `REPO_DIR/.claude/{prompts,tmp,logs}/` → CONTINUATION.md, restart-flags, launcher logs
- `REPO_DIR/.claude/.claude.json` → seed for `$AGENT_HOME_DIR/.claude/.claude.json`
- `REPO_DIR/bin/lib/` → **NOT USED** anymore — the canonical script sources from `LIB_DIR` (under apps/agent-cli/).

So the agent repos' existing `bin/lib/*.sh` directories become dead code after the shim swap and SHOULD be deleted in the same migration PR (per-agent) to keep the repos clean. Deletion is gated on open question §5 being resolved (stable `LIB_DIR`).

## Feature inventory & validation

The script must support every feature currently present in alex/henry/jack's `bin/agent`. The audit (see `.claude/tmp/deprecated-agent-audit.md` in the alex repo) catalogues 27 functional regions. Below: each region with its acceptance criterion.

### Startup safety

| #   | Feature                                                                                                                                                         | Validation                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Self-launch guard prevents recursion (`AGENT_LAUNCHER_PID`)                                                                                                     | Run `bin/agent`; from inside the resulting claude session, attempt to run `bin/agent` again — should exit 1 with "Cannot launch agent from inside a running agent session." |
| 2   | Env-var wipe on each launch: `AGENT_NAME`, `AGENT_HOME_DIR`, `XDG_*`, `GH_TOKEN`, `GITHUB_TOKEN`, `GITHUB_APP_*`, `GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `CLIENT_*` | Set `AGENT_NAME=wrong` in parent shell, run `bin/agent`; canonical script's `$1` is the shim-resolved name (from agent.yaml), so `AGENT_NAME=wrong` is overridden           |

### Shim correctness

| #   | Feature                                                                                    | Validation                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | Shim resolves `REPO_DIR` from `$(dirname "$0")/..` regardless of caller's cwd              | `cd /tmp && /path/to/.ai-agent-alex/bin/agent --version` resolves REPO_DIR to `.ai-agent-alex`, not `/tmp`                                                  |
| 4   | Shim resolves `AGENT_NAME` from `$REPO_DIR/agent.yaml` (key: `name`) via `yq -r '.name'`   | Each of alex/henry/jack's shim resolves to its OWN name; a missing or malformed agent.yaml aborts with a yq error (or shim's own clear error if we wrap it) |
| 5   | Shim execs the canonical script with `<agentName> <repoDir> [forwarded args]`              | Add a temporary `set -x` at the top of the canonical script; running any agent's `bin/agent --foo` shows `+ AGENT_NAME=<name>` and `+ REPO_DIR=<absolute>`  |
| 6   | Canonical script aborts cleanly if invoked WITHOUT the shim (e.g. directly with `<2 args`) | `apps/agent-cli/bin/deprecated-agent` (no args) prints the usage error to stderr and exits 1                                                                |
| 7   | Shim files are byte-identical across all three agent repos                                 | `sha256sum` of each repo's `bin/agent` produces the same hash                                                                                               |

### Agent identity & env derivation

| #   | Feature                                                                            | Validation                                                                                                        |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 8   | Canonical script accepts `$AGENT_NAME` from arg, exports it as env var             | After launch, `env \| grep ^AGENT_NAME=` matches the value passed by the shim                                     |
| 9   | `AGENT_HOME_DIR = $HOME/.agents/$AGENT_NAME`                                       | After launch, env shows the correct per-agent path                                                                |
| 10  | XDG vars (`XDG_CONFIG_HOME`, `XDG_DATA_HOME`, etc.) export BEFORE mise/direnv runs | `ls $AGENT_HOME_DIR/.local/share/mise/installs` populated after first launch (not `~/.local/share/mise/installs`) |
| 11  | `AGENT_DEBUG=*` default; never `DEBUG=*` (would leak auth headers via axios)       | `env \| grep ^DEBUG=` post-launch shows nothing                                                                   |

### Flag parsing

| #   | Feature                                                                          | Validation                                                               |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 12  | `--tmux` / `--no-tmux` toggles tmux session creation                             | `bin/agent --no-tmux` does not create a tmux session                     |
| 13  | `--force-patch` / `--no-force-patch` overrides patch policy                      | With `--force-patch`, first iteration patches even if symlink is valid   |
| 14  | `--patch-if-untested` / `--no-patch-if-untested` (default true)                  | With `--no-patch-if-untested`, an untested claude version is NOT patched |
| 15  | `--with-dialog-accept-fallback` enables tmux DevChannelsDialog auto-accept       | When dialog appears mid-launch, the watcher sends Enter                  |
| 16  | Other args are forwarded to claude (via the shim → canonical → build_args chain) | `bin/agent --debug` passes `--debug` through to claude                   |

### Logging

| #   | Feature                                                                                                   | Validation                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 17  | `LOG_FILE = $REPO_DIR/.claude/logs/launcher.<epoch>.log` per iteration                                    | After launch, `launcher.<epoch>.log` exists in the agent repo with iteration-specific content       |
| 18  | `restart-history.log` records every restart with timestamp                                                | Re-exec via signal; `restart-history.log` gains an entry                                            |
| 19  | `log()` writes to stderr AND `$LOG_FILE` so `build_args` stdout stays clean                               | Stderr has timestamped lines; `build_args` output (stdout) is bare args                             |
| 20  | Bullet-1 ordering: "Running claude:" log lands BEFORE `build_prompt()` so the prompt-snapshot includes it | First message of a fresh restart contains the `Running claude:` line within the launcher-logs block |

### Env injection

| #   | Feature                                                                                                                                               | Validation                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 21  | Bootstrap: read `.env` from `$REPO_DIR/.claude/settings.local.json`, export keys (incl. `OP_SERVICE_ACCOUNT_TOKEN`)                                   | `op whoami` succeeds inside a Bash tool call in the resulting session                                                                |
| 22  | `mise activate bash` + `mise env -s bash`, stderr → `$LOG_FILE`                                                                                       | `mise ls` works inside the resulting session; trust errors visible in launcher log                                                   |
| 23  | claude-utils lib sourced from `mise where github:nsheaps/claude-utils`/lib                                                                            | After launch, `claude_resolve_binary` (or another claude-utils function) available                                                   |
| 24  | `.envrc.template` → `$AGENT_HOME_DIR/.envrc` (idempotent), then `source` it                                                                           | First launch: file materialized; per-agent `.env.local` values appear in env                                                         |
| 25  | `op_inject_env` runs AFTER `.envrc`/`.env.local` sourcing so fresh op-exec values override stale (#177)                                               | After launch, `CLAUDE_CODE_OAUTH_TOKEN` matches the current 1Password vault value (post-rotation), not the previous .env.local value |
| 26  | PEM materialization: when `GITHUB_APP_PRIVATE_KEY` is in env but `_PATH` isn't, write the key to `$AGENT_HOME_DIR/.config/github-app-<id>.pem` (0600) | `gh-auth` next step finds and reads the PEM                                                                                          |

### Marketplace + plugins

| #   | Feature                                                                             | Validation                                                                                         |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 27  | `marketplace_bootstrap` adds declared marketplaces if missing                       | First launch: marketplace clone appears under `$AGENT_HOME_DIR/.claude/plugins/marketplaces/`      |
| 28  | `marketplace_prune_orphans` removes auto-installed plugins not declared in settings | Run with an orphaned plugin present; subsequent launch removes it                                  |
| 29  | Claude CLI patching is delegated to `$REPO_DIR/bin/claude` (the per-agent wrapper)  | `bin/claude-patched` symlink points at a per-version output; broken state surfaces in launcher log |

### Auth refresh

| #   | Feature                                                                                            | Validation                                                                                               |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 30  | Pre-marketplace `gh-auth` token refresh from GitHub App credentials (#104)                         | Launcher log shows refresh timestamps; `gh auth status` post-launch reports the App identity             |
| 31  | `GH_TOKEN` exported ONLY when app/installation identity matches AND refresh succeeded (#102, #104) | On identity mismatch (e.g. wrong vault env), `GH_TOKEN` is NOT exported; launcher logs the gate decision |

### direnv

| #   | Feature                                                                        | Validation                                                                                   |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 32  | `direnv allow .` + `direnv export bash` with stderr → `$LOG_FILE`, 30s timeout | `direnv: error` line in output aborts the launcher iteration (exit 1)                        |
| 33  | `which -a claude` + `mise which claude` divergence surfaced in log             | When a globally-installed claude shadows the mise version, the launcher log makes it obvious |

### Args & prompt

| #   | Feature                                                                                                                                                                                           | Validation                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 34  | `build_args`: `--name "[Agent <name>]"`, `--debug`, `--append-system-prompt-file`, `--continue`, `--dangerously-load-development-channels`, `--permission-mode`, `--dangerously-skip-permissions` | `ps -ef \| grep claude` shows the expected set                                                    |
| 35  | One-time CLI flags: read `.claude/tmp/restart-flags`, consume (rm) after read                                                                                                                     | After a launch that consumed it, the file is gone                                                 |
| 36  | `build_prompt`: launcher-log snippet + CONTINUATION.md + preserved todos + system footer                                                                                                          | First message in the new session contains all four parts                                          |
| 37  | CONTINUATION.md is archived after consumption (per #169) — not embedded twice                                                                                                                     | After consumption, `.claude/prompts/CONTINUATION.md` is moved to a consumed-continuations archive |
| 38  | Startup-prompt log: `## Launcher Logs (since last start)` block stripped from the in-file log to avoid recursion                                                                                  | `tail launcher.<epoch>.log` shows the prompt without the embedded launcher-log section            |

### Restart loop

| #   | Feature                                                                            | Validation                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 39  | `ensure_tmux`: drop into / attach a tmux session named `$AGENT_NAME`               | First launch outside tmux: `tmux ls` shows `<AGENT_NAME>`                                                                                                                  |
| 40  | Cold-start retry: claude rc=1 with `--continue` → strip `--continue`, re-run once  | First-ever launch on a fresh state succeeds on the retry                                                                                                                   |
| 41  | Fast-crash warn: runtime < 10s → log a warning                                     | A bin/agent that fails immediately produces a "possible startup failure" line                                                                                              |
| 42  | Re-exec `$0 "$@"` after every iteration so script edits take effect on next launch | Edit `bin/agent` (the shim) OR `apps/agent-cli/bin/deprecated-agent` (the canonical script) mid-session, exit; next iteration runs the new version of WHICHEVER you edited |

## Open questions

1. **`lib/` placement**: `apps/agent-cli/lib/` vs `apps/agent-cli/bin/lib/`? The latter mirrors today's per-agent structure but feels redundant. Recommend `apps/agent-cli/lib/` — `bin/` is for executables.
2. **Naming**: `deprecated-agent` is intentional during migration to a proper `agent` subcommand under [`agents-cli`](agents-cli.md). Confirming this is the back-compat shim, not a long-term name. Once `agent` subcommand exists, this shim is retired (and each repo's `bin/agent` shim updates the `DEPRECATED_AGENT` target).
3. **Migration order**: which agent gets the shim first? Recommend henry (peer-validatable, not self) → jack → alex.
4. **Per-agent rc.d**: `$AGENT_HOME_DIR/rc.d/` (and the `rc.d/` in agent repos) is loaded by `.envrc.template` — out of scope for this consolidation since it's already per-agent. Just noting.
5. **Hardcoded path portability** (NEW — from shim pivot): the shim contains `DEPRECATED_AGENT="/home/nsheaps/src/nsheaps/agents/apps/agent-cli/bin/deprecated-agent"` which is Nate's dev-machine layout. Production / CI / peer-agent-machine / fresh-clone support is not yet handled. Nate (02:42:10Z) said "for now assume yes" on this layout. Options to resolve later:
   - **(a)** Env var: shim does `exec "${AGENTS_REPO_DIR:?set in .envrc}/apps/agent-cli/bin/deprecated-agent" …`. Requires `AGENTS_REPO_DIR` be set during shim execution — possibly via a per-agent `.envrc` line.
   - **(b)** Sibling-checkout convention: hardcode a relative path like `"$REPO_DIR/../agents/apps/agent-cli/bin/deprecated-agent"` (assumes all agent repos are siblings of an `agents` checkout). Brittle but no env needed.
   - **(c)** Mise tool: publish `apps/agent-cli` as a mise-installable tool, then the shim becomes `exec "$(mise where agents-cli)/bin/deprecated-agent" …`. Stable across machines, requires mise to be activated.
     This question MUST be resolved before any production rollout. Spec-PR review can defer it; implementation-PR review must address it.
6. **Versioning**: does `apps/agent-cli` get a semver of its own? Mise-installable? Or just lives as a path in nsheaps/agents that's hardcoded in the shim during dev? (Tightly coupled with §5.)

## Migration plan (for the implementation PR — NOT this spec PR)

1. Land THIS spec PR (review-only).
2. Copy henry/jack's `bin/agent` byte-for-byte to `apps/agent-cli/bin/deprecated-agent` + copy `bin/lib/*` to `apps/agent-cli/lib/`.
3. Modify the canonical script's argument handling: accept `<agentName> <repoDir>` as positional args (replacing the current self-location dance).
4. Update the canonical script's `source` paths to use `LIB_DIR` (see §Canonical script signature).
5. **Resolve open question §5 (hardcoded path portability) AND §6 (versioning)** before step 9. The agent-repo `bin/lib/` deletion is GATED on a stable `LIB_DIR` path. For the spec-PR + first impl-PR cycle, accept the hardcoded `/home/nsheaps/...` path per Nate's "for now assume yes" decision, but document it as a known follow-up.
6. Sync alex's bin/agent to the henry/jack version first (task #207) — pre-consolidation drift fix. (Already done.)
7. Write the shim file (copy the §Shim contract block above), drop it into henry's repo as `bin/agent`, replacing the existing file. Restart henry. Validate every row in the feature table.
8. Repeat for jack.
9. Repeat for alex (last per modify-self-last).
10. (Gated on step 5 resolution) Remove `bin/lib/` directories from each agent repo.

## Rollback

Each per-agent migration is a single-commit file swap (regular file → regular file with different content). To roll back: `git checkout HEAD~1 -- bin/agent` restores the previous full launcher. No symlinks involved means no broken-link state to recover from.

## Out of scope / not covered

- `bin/claude` (the per-agent claude wrapper that owns binary patching) — stays per-agent for now; can be consolidated later via the same pattern.
- `bin/start-agent` / `bin/run-agent` / `bin/attach-agent` / `bin/run-and-attach-agent` — same story, per-agent for now.
- agent-team-cli concerns — separate.

## Source

Handler ask: Nate Discord [2026-05-20 02:14:27Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1506480193143967855) — "Make this script: nsheaps/agents:apps/agent-cli/bin/deprecated-agent. Make it work exactly like bin/agent. Then in henry's repo, update bin/agent symlink to deprecated-agent script. This script needs to work for all the agents. … I want to manage only one copy of the script."

Pivot from symlink → shim: Nate Discord [2026-05-20 02:42:10Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1506487172067495996) — "for 147 would it be easier to instead of symlinking bin/agent > deprecated-agent, bin/agent is a simple `exec /home/nsheaps/src/nsheaps/agents/apps/agent-cli/bin/deprecated-agent "$(yq ../agents.yaml '.agentName')"`? … 1. for now assume yes 2. always pull from agents.yaml, we want bin/agent to be exactly the same for each agent. Go with the shim option instead, pivot the approach of 147."
