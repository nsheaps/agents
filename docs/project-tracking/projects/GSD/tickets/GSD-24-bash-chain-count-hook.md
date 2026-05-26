---
type: feature
id: GSD-24
priority: 0
state: in-progress
created: 2026-05-25T23:42:00Z
project: GSD
assignee: contacts://heaps-group/byGithubAppUrl/https%3A%2F%2Fgithub.com%2Fapps%2Falex-nsheaps
requester: contacts://heaps-group/byGithubUsername/nsheaps
milestone: ../../../milestones/M2.md
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508616421360533577
  - id: sibling-mantra-ticket
    type: ticket
    url: ./GSD-23-chain-mantra-update.md
events:
  - { ts: 2026-05-25T23:42:00Z, by: alex, change: "created from Nate Discord ask[^discord-ask]" }
---

# GSD-24 — Bash chain-count PreToolUse hook

## Original ask

> update mantras in arch draft. Only ever call a chain of commands at most twice. If you would do something like that a third time, save the chain to a tool/script first, then run that script for the third instance. Prefer adapt-existing tools/scripts > new tools/scripts. Prefer mcp > skills/scripts. Skills + scripts are fine too. Add hooks, tool signature (the shasum of a call containing at least 1 ; | && & or ||) called twice or more should print a warning to the agent. If the same task is called more than 10 times, block. Always have a break glass mechanism (in this case, just calling it again indicates breakglass and not be blocked, but reset on success).

— Nate, Discord 2026-05-25 23:42Z[^discord-ask]

The mantra-documentation side of this directive lives in the sibling ticket [GSD-23](./GSD-23-chain-mantra-update.md). This ticket covers hook enforcement only.

## User story

As Alex (the agent), I want the Bash chain-count hook to actively enforce the chain-mantra from GSD-23 so that I get a warning the 2nd time I run the same chain, get blocked after 10, and can break-glass by re-issuing the same call.

## Stakeholders

- **Nate** (handler) — directive source; expects consistent enforcement across all agents
- **Alex** (subject) — hook lives in alex's repo first; primary enforced agent
- **Henry / Jack** — peer agents; rule should propagate to them via a shared plugin once the hook stabilises

## Requirements

- **Hook location**: `.claude/hooks/bash-chain-count.sh` in the alex repo (`nsheaps/.ai-agent-alex`), PreToolUse matcher `Bash`
- **Chain detection**: a tool_input.command is a "chain" if it contains at least one of the following: `;`, `|`, `&&`, `&`, `||`. Note: `;;` is a shell `case` statement terminator — treat the same as `;`. `||` contains `|` — detecting either operand char is sufficient; no special-casing needed.
- **Tool signature**: `shasum -a 256` of the full command string (exact bytes, no trimming)
- **State store**: per-signature counter persisted to `.claude/state/bash-chain-count/<sha256>.json` with fields `{count, last_blocked, last_ts}`
- **Behaviour by count**:
  - `count == 0` (first call): silent allow; increment to 1. No output.
  - `count == 1` (second call, count→2 after): allow + emit `systemMessage` warning. Warning text should:
    - State the count (e.g. "This chain has been called 2 times").
    - Suggest saving the chain to a script or breaking it apart.
    - Reference the chain-mantra from GSD-23.
  - `count >= 2` AND `count < 10` (third through tenth call): same warning as above (count→N+1 after). See open question on warning throttle.
  - `count > 10` AND `last_blocked == false`: BLOCK with `permissionDecision: deny`. Set `last_blocked = true`. Emit message explaining the block and the break-glass mechanism.
  - `count > 10` AND `last_blocked == true` (break-glass): ALLOW this one call. Reset semantics TBD — see open questions.
- **PostToolUse reset**: a second hook on PostToolUse matcher `Bash` — if the Bash command succeeded (exit code 0 in tool_response), reset the counter to 0 for that signature (i.e. delete or zero-out the state file).
- **settings.json wiring**: both PreToolUse and PostToolUse entries for matcher `Bash` added to `.claude/settings.json`
- **Unit tests**: shell harness covering all inbound states:
  1. First call (count 0→1, silent)
  2. Second call (count 1→2, warning emitted)
  3. Eleventh call with `last_blocked=false` (block + deny)
  4. Eleventh call with `last_blocked=true` (break-glass, allow)
  5. PostToolUse success reset (counter → 0)

## Acceptance criteria

- [ ] Hook script written at `.claude/hooks/bash-chain-count.sh` and marked executable
- [ ] PostToolUse reset hook written (separate script or combined) and marked executable
- [ ] `.claude/settings.json` updated with PreToolUse + PostToolUse entries for `Bash`
- [ ] State directory `.claude/state/bash-chain-count/` created (with `.gitkeep` or equivalent)
- [ ] Unit tests pass — all 5 cases above (first call, second-warn, 11th-block, break-glass-allow, success-reset)
- [ ] PR opened in `nsheaps/.ai-agent-alex`
- [ ] PR merged
- [ ] Live verification: trigger the same chain 11 times; confirm warning appears at call 2, block fires at call 11, break-glass allows call 12
- [ ] Follow-up captured: propagate hook + wiring to Henry + Jack (or move to shared plugin)

## Implementation

PR URL: TBD — the hook implementation is a separate follow-on task dispatched after this ticket is filed.

## Open questions

1. **Break-glass reset semantics**: on break-glass (repeat-of-blocked call), do we reset `count` to 0 (full reset), to 5 (partial — still warns but not immediately blocked again), or leave at 11 and just allow this one call through before the next one re-blocks? Leaning toward full reset (0) so the agent can continue working, but that could mask runaway chains.
2. **Warning throttle**: do we emit a warning on every call 2-10 (count 1-9), or just once per signature per session? Emitting every time is noisier but ensures the agent cannot ignore the signal. Recommend every time for now.
3. **Background `&` operator**: a trailing `&` (background job) or inline `&` both count as chain operators per the directive. Confirm this is intended — background subshells are a different concern than piped chains. Probably yes, both count.
4. **Trailing `;`**: `cmd ;` (trailing semicolon, e.g. from template expansion) — does this count as a chain? Probably yes, for consistency, but worth confirming so the detection regex is unambiguous.

## Follow-ups (out of scope)

- Propagate hook to Henry + Jack repos with the same wiring once merged and verified in alex's repo
- Move into a shared plugin (`ai-mktpl` or a new `shell-discipline` plugin) so the rule is centrally maintained and all agents pick it up without per-repo copying

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508616421360533577
