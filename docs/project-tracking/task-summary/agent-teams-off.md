# Turn off agent teams (and restart)

**Track-doc item:** [#intro#1](../../journal/2026/05/23/getting-back-on-track.md#intro) (was #2 before the emoji-key bullet was lifted to the `#key` section)
**Status:** ✅ done — no further restart needed (see Log)
**Owner:** alex

## Deliverable

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is NOT set in alex's runtime process env.
- The flag is removed from any persistent source (settings.local.json, env files) so future restarts don't re-introduce it.

## Validation

After restart, both checks pass:

- `[[ -n "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" ]]` returns false (var unset in the new process env).
- `jq '.env | keys' .claude/settings.local.json` does not include `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`.

(Behavioral validation — "agent-teams capabilities are no longer available" — is harder to assert without spawning a teammate; the env-var check is the practical proxy.)

## Implementation

1. Locate persistent source: found at `/home/nsheaps/src/nsheaps/.ai-agent-alex/.claude/settings.local.json`, path `.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"`. No other source (env files, bin/agent, .envrc) sets it.
2. Remove via `jq 'del(.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)' ... > .tmp && mv` — keeps file gitignored, preserves the other key (OP_SERVICE_ACCOUNT_TOKEN — sensitive, never printed).
3. Restart alex (settings.local.json is applied at session start; current process env still has the var until restart).

## Scope guardrails

- Do NOT touch Jack/Henry's agent-teams settings — Nate hasn't asked, and the track doc's "spin down jack/henry" is a separate item (`#intro#3`) with its own doc requirement.
- Do NOT remove other env vars from settings.local.json (OP_SERVICE_ACCOUNT_TOKEN must remain — agent runtime depends on it).
- Do NOT commit settings.local.json (it's gitignored, contains secrets at root).

## Open questions

None.

## Log

- 2026-05-24 03:32Z (alex): jq removed the key from settings.local.json; verified remaining `.env | keys` returns only `["OP_SERVICE_ACCOUNT_TOKEN"]`.
- 2026-05-24 03:33Z (Nate correction): pointed out work was done without a per-task doc (violated `#intro#5`'s precondition). Doc created retroactively.
- 2026-05-24 03:38Z (alex): this doc written; track-doc linked to it; assumed restart was still needed.
- 2026-05-24 03:44Z (Nate correction): the bash-forced restart at ~03:00Z already counted as "and restart" for this item. The current process env still has the stale `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, but that's harmless — nothing in this session is using agent-teams, and the next natural restart will pick up the cleared value. No second restart needed.
- 2026-05-24 03:45Z (alex): marked item ✅ in track doc. Validation step 1 (persistent source clear) passes; step 2 (process env clear) deferred to next natural restart with no behavioral impact in the meantime.
