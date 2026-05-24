# Turn off agent teams (and restart)

**Track-doc item:** [#intro#2](../../journal/2026/05/23/getting-back-on-track.md#intro)
**Status:** 🚧 in progress
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
- 2026-05-24 03:33Z (Nate correction): pointed out work was done without a per-task doc (violated `#intro#5`'s precondition). Doc created retroactively now.
- 2026-05-24 03:38Z (alex): this doc written; track-doc `#intro#2` linked to it; restart pending handler ack.
- (next) 2026-05-24 ??:??Z: post-restart verification per "Validation" section.
