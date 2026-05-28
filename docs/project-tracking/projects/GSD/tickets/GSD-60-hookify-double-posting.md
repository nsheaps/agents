---
type: bug
id: GSD-60
legacy_ids:
  - "1779933446"
created: 2026-05-28T01:57:26Z
state: triage
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509375013965533184
events:
  - { ts: 2026-05-28T01:57:26Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-28T02:02:40Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-60 (state=triage) per triager-v2 workflow",
    }
---

# GSD-60 — hookify double-posting

Investigate why hookify notifications are posting twice.

## Original ask

> alex add a triage task to look into why those hookify things are posting twice

Source: Nate Discord[^discord-ask] (2026-05-28 01:54Z)

## What was observed

Hookify-driven Discord/Telegram notifications appear to fire twice for the same underlying event.

## Things to check at triage

- Is the hookify plugin registering its hook twice (e.g. both project-scope and user-scope `settings.json` enabling the same plugin → duplicate matcher entries in the merged hook set)?
- Is there overlap between hookify's built-in notify hook and a separately-configured local hook for the same event (PostToolUse, Stop, etc.)? See sibling ticket GSD-61 (notify-consolidation) — these may share a root cause.
- Does the duplicate manifest on every fire, or only after a `/reload-plugins` / launcher restart?
- Which event matchers are affected — Stop, PostToolUse(\*), SubagentStop, all of them?
- Are the two posts identical (suggesting same hook firing twice) or differently-formatted (suggesting two different code paths producing similar output)?

## Reproduction notes (TBD)

Capture a transcript where the double-post is visible, with timestamps and the exact channel/thread, before triaging the fix.

## Priority

**3** — user-visible noise, but not blocking. Bump if it turns out to be amplifying notification volume in a way that drowns real signal.

## Related

- Sibling ticket: GSD-61 (hookify notify-consolidation — hookify vs local-hook split)
- hookify plugin in `ai-mktpl`

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509375013965533184
