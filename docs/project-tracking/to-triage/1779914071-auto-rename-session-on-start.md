Auto-rename Claude Code sessions on start to a stable, sortable timestamp so the `/resume` picker is readable across many forked/branched sessions.

Format: `[<agent> - started <ISO-8601 UTC>]` — e.g. `[agent alex - started 2026-05-27T20:34:00Z]`.

Why: after `/fork` (alias `/branch`), the new session inherits the parent's title (e.g. `[Agent alex]`) which is indistinguishable from the original in `/resume` lists. Manually renaming each branch is friction. A SessionStart hook that issues `/rename` (or sets the title via whatever underlying mechanism `/rename` uses) would give every session a unique, scannable label automatically.

Implementation paths to research:

- **SessionStart hook + `/rename` via send-keys / IPC**: `/rename` is a UI slash-command, not a skill — it can't be invoked via the Skill tool (the runtime returns `"fork is a UI command, not a skill"` for similar commands). Today the only way to fire it from inside claude is `tmux send-keys` into the same pane. A SessionStart hook could detect "no custom title set yet" and send the keys. Brittle (tmux-specific), but works.
- **Direct title-state file edit**: find where Claude Code persists the session title (likely under `$CLAUDE_CONFIG_DIR/projects/<slug>/<session-id>.jsonl` or a sibling state file) and have the SessionStart hook write the desired title there. If the title is read from a JSON field on session start, this is cleaner than send-keys. Needs research into the storage path.
- **Upstream Claude Code feature request**: ask for a CLI flag like `--title "[agent alex - started <iso>]"` on `claude` invocation, or an env var like `CLAUDE_SESSION_TITLE` that's honored when no manual title is set. This is the long-term clean fix and benefits all users.

Open questions for triage:

1. **Scope** — alex only, all agents (jack/henry too via the agents-repo plugin), or upstream-only-via-feature-request?
2. **Trigger** — on every SessionStart, or only when the title still equals the bare `[Agent <name>]` default (so manual renames stick)?
3. **Source of truth for the timestamp** — wall-clock `date -u +%FT%TZ` at SessionStart fire time, or pull from the session JSONL's first-message timestamp so resumed/compacted sessions keep their original "started" time?
4. **Fork lineage** — should branched sessions encode parent in the title (e.g. `[agent alex - started <iso> - branch of <parent-iso>]`)? Useful for `/resume` archaeology but adds length.

Source: Nate Discord 2026-05-27 [20:34Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1509293729356447796) — after I manually renamed the post-`/fork` session via `tmux send-keys '/rename [agent alex - started <iso>]' Enter`.

Related:

- `[Agent alex]` default title comes from `bin/agent` launcher (tmux pane title) — but the Claude Code session label (visible in `/resume`) is separate; needs separate mechanism.
- Connects to the broader "many agents observed in one place" thread (agents-observe transcripts mount @ [1509290622Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1509290622077374518)) — distinguishing forked sessions matters for telemetry too.
