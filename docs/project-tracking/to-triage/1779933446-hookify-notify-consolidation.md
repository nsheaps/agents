Consolidate notify responsibility: either hookify does the notify, OR the local hook does — not split between them.

## What was asked

Source: Nate, Discord [2026-05-28 01:54:08Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1509375013965533184):

> "separately another [ticket] for either making hookify do the stuff, or the hook we have to do the notify, it shouldn't be split like that"

The current setup has notification responsibility split between the hookify plugin and a separately-configured local hook. Pick one owner and have it do the full notify; remove the responsibility from the other side.

## Decision needed at triage

1. **Which side wins** — hookify or the local hook?
   - Hookify pros: shared across agents, version-bumpable, gets fixes for free.
   - Local hook pros: faster to iterate (no plugin release cycle), can encode agent-specific format.
2. **What "doing the stuff" means concretely** — likely: format the message, pick the channel, call the Discord/Telegram MCP, handle errors, log.
3. **What the loser becomes** — fully removed, or kept as a thin trigger that delegates to the winner?

## Likely connection to sibling ticket

`1779933446-hookify-double-posting.md` — if both hookify and the local hook are firing on the same event, that's plausibly the source of the double-post. Consolidating ownership here may resolve that ticket as a side effect; triage them together.

## Implementation paths to research at triage

- Audit current `settings.json` `hooks` entries vs hookify's declared hooks in `plugin.json` — find the overlap.
- Decide whether the local hook predates hookify (legacy worth removing) or covers a use-case hookify doesn't (worth upstreaming into hookify).
- If hookify wins: file a PR against `ai-mktpl` for any missing functionality, then remove the local hook in the same release.

## Priority

Default **3** — architectural cleanup, but motivated by a real user-visible symptom (double-post). Should be triaged in the same session as the sibling ticket.

## Related

- Sibling ticket: `1779933446-hookify-double-posting.md`
- hookify plugin in `ai-mktpl`
