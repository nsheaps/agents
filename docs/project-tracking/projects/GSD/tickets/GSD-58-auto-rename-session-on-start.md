---
type: feature
id: GSD-58
legacy_ids:
  - "1779914071"
created: 2026-05-27T20:34:31Z
state: triage
project: GSD
priority: 4
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509293729356447796
  - id: discord-context
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509290622077374518
events:
  - { ts: 2026-05-27T20:34:31Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - { ts: 2026-05-28T02:02:19Z, by: alex-triager, change: "promoted to-triage → GSD-58 (state=triage) per triager workflow" }
---

# GSD-58 — Auto-rename Claude Code sessions on start

## Original ask

Auto-rename Claude Code sessions on start to a stable, sortable timestamp so the `/resume` picker is readable across many forked/branched sessions.

Format: `[<agent> - started <ISO-8601 UTC>]` — e.g. `[agent alex - started 2026-05-27T20:34:00Z]`.

Source: Nate Discord[^discord-ask] (2026-05-27 20:34Z) — after manually renaming the post-`/fork` session via `tmux send-keys '/rename [agent alex - started <iso>]' Enter`.

## Goal

Implement a mechanism (ideally a SessionStart hook) that automatically renames every Claude Code session to a unique, scannable label on startup. After `/fork` (alias `/branch`), the new session inherits the parent's title (e.g. `[Agent alex]`) which is indistinguishable from the original in `/resume` lists. Manually renaming each branch is friction.

## Implementation paths to research

- **SessionStart hook + `/rename` via send-keys / IPC**: `/rename` is a UI slash-command, not a skill — it can't be invoked via the Skill tool (the runtime returns `"fork is a UI command, not a skill"` for similar commands). Today the only way to fire it from inside claude is `tmux send-keys` into the same pane. A SessionStart hook could detect "no custom title set yet" and send the keys. Brittle (tmux-specific), but works.
- **Direct title-state file edit**: find where Claude Code persists the session title (likely under `$CLAUDE_CONFIG_DIR/projects/<slug>/<session-id>.jsonl` or a sibling state file) and have the SessionStart hook write the desired title there. If the title is read from a JSON field on session start, this is cleaner than send-keys. Needs research into the storage path.
- **Upstream Claude Code feature request**: ask for a CLI flag like `--title "[agent alex - started <iso>]"` on `claude` invocation, or an env var like `CLAUDE_SESSION_TITLE` that's honored when no manual title is set. This is the long-term clean fix and benefits all users.

## Open questions for triage

1. **Scope** — alex only, all agents (jack/henry too via the agents-repo plugin), or upstream-only-via-feature-request?
2. **Trigger** — on every SessionStart, or only when the title still equals the bare `[Agent <name>]` default (so manual renames stick)?
3. **Source of truth for the timestamp** — wall-clock `date -u +%FT%TZ` at SessionStart fire time, or pull from the session JSONL's first-message timestamp so resumed/compacted sessions keep their original "started" time?
4. **Fork lineage** — should branched sessions encode parent in the title (e.g. `[agent alex - started <iso> - branch of <parent-iso>]`)? Useful for `/resume` archaeology but adds length.

## Related

- `[Agent alex]` default title comes from `bin/agent` launcher (tmux pane title) — but the Claude Code session label (visible in `/resume`) is separate; needs separate mechanism.
- Connects to the broader "many agents observed in one place" thread[^discord-context] — distinguishing forked sessions matters for telemetry too.

## Acceptance criteria

1. Every new Claude Code session (including post-`/fork` sessions) is automatically renamed to `[agent <name> - started <ISO-8601 UTC>]` on SessionStart without manual intervention.
2. Mechanism does not clobber manually-set titles (if the user has already renamed the session, the hook is a no-op or detects the custom title).
3. Works for at minimum the `alex` agent; ideally generalized to all agents.
4. Open questions 1–4 above are resolved in triage before implementation begins.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509293729356447796
[^discord-context]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509290622077374518
