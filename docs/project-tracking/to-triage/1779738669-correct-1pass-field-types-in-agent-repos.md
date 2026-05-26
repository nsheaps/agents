---
type: bug
created: 2026-05-25T19:51:09Z
state: to-triage
project: GSD
priority: 4
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508557929991766087
events:
  - { ts: 2026-05-25T19:51:09Z, by: alex, change: "created from Discord ask[^discord-ask]" }
---

# Correct 1pass field types in agent repos

## Original Discord message

> add a task in the triage queue for correcting field types in agent repos

Source: Discord msg[^discord-ask] (2026-05-25 19:50Z)

## Context

While looking up the `github--app--alex` 1pass item to find the github-app URL, I filtered out fields by `type == "CONCEALED"` to mask secret values. The filter missed `GITHUB_APP_PRIVATE_KEY` because that field was NOT typed as CONCEALED (probably plain STRING or multi-line text), so the full PEM-encoded private key dumped into my transcript. Nate confirmed the transcript is private and no rotation needed, but the underlying issue is real:

**Some secret-bearing fields in 1pass agent items are not typed as `CONCEALED`**, so:

- Casual `op item get | jq` queries don't auto-mask them.
- Any tool that relies on `type == CONCEALED` to decide redaction (incl. our 1pass plugin's redact-secrets hook) won't redact them.
- The next agent (or future Alex) who runs the same exploratory query will leak the secret again.

## Scope

Affected vaults: `Agent-Alex`, `Agent-Jack`, `Agent-Henry` (likely also `Agent-Kenny` if it exists).

Items to audit per agent:

- `github--app--<agent>` — at minimum `GITHUB_APP_PRIVATE_KEY` and `GITHUB_APP_CLIENT_SECRET`. Verify both are `CONCEALED`.
- `ENVIRONMENT` (or equivalent op-exec env-bag item) — verify every `*_TOKEN`, `*_KEY`, `*_SECRET`, `*_PASSWORD`, `*_PEM`, OAuth-token field is `CONCEALED`.
- Any other items that hold token/key/PEM material.

## Suggested fix

1. List all items in each vault: `op item list --vault Agent-<Agent> --format json`.
2. For each item, fetch fields: `op item get <id> --vault Agent-<Agent> --format json`.
3. For each field whose label matches `(?i)(token|key|secret|password|pem|credential|private)`, verify `type == "CONCEALED"`. If not, edit it: `op item edit <id> --vault Agent-<Agent> "<field>[concealed]=$(op read op://Agent-<Agent>/<id>/<field>)"` (round-trip the value so the type changes without losing the value — or use the 1pass UI manually).
4. Document the audit + fixes in a script under `scripts/op/audit-concealed-field-types.sh` (or similar) so future agents can re-run it as a maintenance check.

## Acceptance criteria

- Every field across all `Agent-*` vaults that contains secret material has `type == "CONCEALED"`.
- An audit script exists that lists offenders + can be run any time to verify the state.
- A 1pass plugin (or skill) check exists that warns on agent-startup if any obviously-secret-named field is not CONCEALED.

## Notes

- This dovetails with the 1pass plugin's `redact-secrets.sh` hook — that hook uses `type == "CONCEALED"` as the redaction signal (per Nate's prior call: "only CONCEALED fields get redacted, full stop"). If field types are wrong upstream, the redaction layer can't help.
- Adjacent to but distinct from the task-utils validation-error bug filed earlier today (different repo/plugin scope).

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508557929991766087
