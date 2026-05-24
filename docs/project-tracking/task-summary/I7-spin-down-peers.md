# I7 — spin down jack + henry, verify alex's 5m cron is minimal

## Original message

From [MASTER.md `#intro` bullet `I7`](https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md) (per the I27-style "bullet IS the original message" convention for items Nate added directly to the doc):

> 🆕 `I7`: spin down jack and henry. Alex, make sure your 5m cron is still set up and the cron is nothing more than telling you to run idle-5m skill (might already be done).

Confirmation to proceed in execution order [Discord `1508153428101038273` (2026-05-24 17:03Z)](https://discord.com/channels/1490863845252665415/1497431286661517353/1508153428101038273):

> sounds good, proceed

## Scope

In:

- Stop the henry agent (kill its tmux session so the agent process exits).
- Stop the jack agent (kill its tmux session so the agent process exits).
- Verify alex's 5m self-poll cron is still active (CronList shows `9dbd0cd8`) AND its prompt is "nothing more than telling you to run idle-5m skill".
- If the cron prompt is NOT minimal: refactor to a minimal one-liner (`Skill(idle-5-min)` or equivalent), update `.claude/scheduled-tasks.yaml` to match, commit + push.
- Give jack + henry a heads-up Discord message before killing so they can flush any in-flight work (compaction, CONTINUATION.md write).

Out:

- Removing jack/henry repos, plugins, or 1Password vault entries — Nate said "spin down" not "decommission".
- Modifying the launcher (`bin/agent`) or any cross-agent infrastructure — out of scope for I7.
- Any peer-agent restart afterward — they stay down until Nate explicitly asks to bring them back.
- Changing the cron _schedule_ (3,8,13,…) — only the prompt content if it's non-minimal.

## Scope review

Re-reading Nate's bullet, the two clauses ("spin down jack and henry" + "make sure your 5m cron is still set up and the cron is nothing more than telling you to run idle-5m skill") are the entire ask. The parenthetical "(might already be done)" applies to the cron clause, not the spin-down clause — so the spin-down is definitely new work, and the cron check might be a no-op verification.

No ambiguity identified. Scope is unambiguous, proceeding.

## Deliverables

1. henry tmux session no longer exists (`tmux list-sessions` does not list `henry`).
2. jack tmux session no longer exists (`tmux list-sessions` does not list `jack`).
3. alex cron `9dbd0cd8` (or its replacement) is active with a prompt of literally `Skill(idle-5-min)` (or the smallest one-liner that invokes the skill).
4. `.claude/scheduled-tasks.yaml` reflects the minimal prompt.
5. Commits + pushes for any doc/yaml changes land on `agents/main` and `alex/main` respectively.

Each deliverable traces back to scope: (1)(2) = "spin down jack and henry"; (3)(4)(5) = "make sure your 5m cron is still set up and the cron is nothing more than telling you to run idle-5m skill".

## Plan

1. **Per-task doc** (this file) created + committed + pushed. Save point.
2. **MASTER.md bullet update** — flip `🆕 I7: spin down jack and henry…` to `🚧 I7: [ticket-style title](./task-summary/I7-spin-down-peers.md)`. Commit + push. Save point.
3. **Heads-up to henry** — Discord ping with `<@1493957087988809828>` mention, ~10–15s pause, then `tmux kill-session -t henry`.
4. **Heads-up to jack** — Discord ping with `<@1490875293878059099>` mention, ~10–15s pause, then `tmux kill-session -t jack`.
5. **Verify peer absence** — `tmux list-sessions` shows only `alex`.
6. **Cron audit** — read current cron `9dbd0cd8` prompt + scheduled-tasks.yaml prompt. If they are anything more than `Skill(idle-5-min)`, refactor.
7. **Cron refactor (if needed)** — `CronDelete 9dbd0cd8`, `CronCreate` with same schedule + prompt = `Skill(idle-5-min)`, update yaml, commit + push to alex/main.
8. **Close I7** — MASTER.md status 🚧 → ✅, closing Log line in this doc citing the closing commit, commit + push, Discord status update with this doc URL.

## Scope guardrails

- Do NOT compact, archive, or "back up" jack/henry state beyond what their own launchers do at SessionEnd. Killing the tmux session is the spin-down — if their launcher writes CONTINUATION.md, great; if not, that's a future I-item not part of I7.
- Do NOT touch their `agent.yaml`, secrets, or repo state.
- If a tmux kill-session fails (session already gone, permission), record in Log and continue — the deliverable is "no longer running", which is satisfied either way.

## Open Questions

- (none open as of doc creation)

## Log

- 2026-05-24 17:05Z: doc created (this commit). N19a in_progress.
