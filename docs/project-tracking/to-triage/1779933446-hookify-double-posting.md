Investigate why hookify notifications are posting twice.

## What was observed

Hookify-driven Discord/Telegram notifications appear to fire twice for the same underlying event. Source: Nate, Discord [2026-05-28 01:54:08Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1509375013965533184) — "alex add a triage task to look into why those hookify things are posting twice".

## Things to check at triage

- Is the hookify plugin registering its hook twice (e.g. both project-scope and user-scope `settings.json` enabling the same plugin → duplicate matcher entries in the merged hook set)?
- Is there overlap between hookify's built-in notify hook and a separately-configured local hook for the same event (PostToolUse, Stop, etc.)? See sibling ticket `1779933446-hookify-notify-consolidation.md` — these may share a root cause.
- Does the duplicate manifest on every fire, or only after a `/reload-plugins` / launcher restart?
- Which event matchers are affected — Stop, PostToolUse(*), SubagentStop, all of them?
- Are the two posts identical (suggesting same hook firing twice) or differently-formatted (suggesting two different code paths producing similar output)?

## Reproduction notes (TBD)

Capture a transcript where the double-post is visible, with timestamps and the exact channel/thread, before triaging the fix.

## Priority

Default **3** — user-visible noise, but not blocking. Bump if it turns out to be amplifying notification volume in a way that drowns real signal.

## Related

- Sibling ticket: `1779933446-hookify-notify-consolidation.md` (hookify vs local-hook split)
- hookify plugin in `ai-mktpl`
