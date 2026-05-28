---
type: bug
id: GSD-53
legacy_ids:
  - "1779912329"
created: 2026-05-27T20:05:29Z
state: triage
project: GSD
priority: 2
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-686"
    note: "#686: [RETRO/GSD-53] session env-chain bloat E2BIG — retro-filed 2026-05-28 per Nate 20:04Z"
events:
  - {
      ts: 2026-05-28T02:01:44Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-53 (state=triage)",
    }
---

# GSD-53 — session env-chain bloat E2BIG

## Problem

`CLAUDE_ENV_FILE` chaining grows unboundedly across hook runs, eventually causing `posix_spawn` to fail with `E2BIG: argument list too long` from inside claude. Once claude can't spawn subprocesses (Bash, exit.sh, observe restart, anything), the session is stuck — even `/agentic-behavior:restart` can't work because the exit script itself needs to spawn.

## Reproduction

Reproduced 2026-05-27: alex hit E2BIG on every Bash tool call. Recovery required handler to manually move the live session-env + shell-snapshot files to `.bak` from outside the agent (`mv ~/.agents/alex/.claude/session-env/<id>.bak`, same for `shell-snapshots/snapshot-zsh-*.sh.bak`) then Ctrl+C the tmux pane so the launcher loop respawned claude with a clean env.

Files manually `.bak`'d by Nate during recovery:

- `/home/nsheaps/.agents/alex/.claude/session-env/6560d0ff-f5b1-4a9c-b585-d996c6a12250.bak`
- `/home/nsheaps/.agents/alex/.claude/shell-snapshots/snapshot-zsh-1779911415743-s2c8h7.sh.bak`

## Root Cause Hypothesis

`[1pass] Chained $HOME/.env.local into CLAUDE_ENV_FILE` runs on every SessionStart hook fire, appending without dedup. Over many resume/compact cycles the file grows. Need either:

1. Idempotent append (check if already chained before adding), or
2. Truncate-and-rewrite each session, or
3. Cap the file size with a rotation/reset on launcher startup.

## Diagnostic Notes

- E2BIG is env + argv combined exceeding `ARG_MAX` (~2 MB on Linux), so it's the cumulative env size, not any single var.
- The Bash tool inherits the claude process env; once the parent process's env is too big, no child can be spawned at all.
- Moving session-env files on disk doesn't help the current process (its env is already loaded); only a restart fixes the live state.

## Fix Scope

- 1pass plugin's SessionStart chain step — make the append idempotent.
- Possibly launcher-side env hygiene check: warn if `CLAUDE_ENV_FILE` size > N bytes before spawning claude.

## Acceptance Criteria

1. SessionStart hook does not grow `CLAUDE_ENV_FILE` on repeated fires (idempotent or truncate-rewrite).
2. Manual `.bak` recovery is no longer needed to clear the bloat.
3. Optionally: launcher warns (does not fail) if `CLAUDE_ENV_FILE` is larger than a configurable threshold before spawning.
