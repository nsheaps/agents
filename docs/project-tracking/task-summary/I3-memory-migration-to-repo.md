# Migrate alex memory files to repo `memory/`

**Track-doc item:** `I3` — [`#intro` § I3](../MASTER.md#intro) (was list-position #9 before completed items were hoisted on 2026-05-24 04:05Z per `#rules` Rule 2; assigned stable ID `I3` per `I6` on 2026-05-24)
**Status:** ✅ done
**Owner:** alex
**Scope-increase note:** This item was added retroactively per Nate Discord 2026-05-24 03:57Z. Allowed because it prevents future drift (memory in claude-internal state isn't shareable as links).

## Deliverable

- All 28 alex memory `.md` files live at `https://github.com/nsheaps/.ai-agent-alex/tree/main/memory`.
- The MEMORY.md index in that dir is the canonical lookup.
- Old location (`$CLAUDE_CONFIG_DIR/projects/-home-nsheaps-src-nsheaps--ai-agent-alex/memory/`) is empty + removed.

## Validation

- `ls /home/nsheaps/src/nsheaps/.ai-agent-alex/memory/*.md | wc -l` returns 28.
- `ls $CLAUDE_CONFIG_DIR/projects/-home-nsheaps-src-nsheaps--ai-agent-alex/` does not contain a `memory/` subdir.
- The PreToolUse block-hook ([`I4`](../MASTER.md#intro)) prevents accidental regression by blocking any new writes to the old location.

## Implementation

1. `mkdir -p /home/nsheaps/src/nsheaps/.ai-agent-alex/memory`.
2. `mv` all `.md` files from old location to new.
3. `rmdir` old memory dir.
4. Commit migrated files to alex/main (gitignored old location, tracked new).
5. Update hook coach message and add `.claude/rules/memory-location.md` rule to alex repo to enforce the new location for future writes.

Alex commit: [`4efbd3e`](https://github.com/nsheaps/.ai-agent-alex/commit/4efbd3e).

## Scope guardrails

- Do NOT modify memory file contents during migration — `mv` only.
- Do NOT remove the PreToolUse hook (`block-claude-projects-md-writes.sh`) — that's the regression guard.
- Memory entries about the migration itself (none exist yet) would be written to the NEW location.

## Open questions

- The system prompt's "auto memory" section directs me to the OLD location. Local rule overrides per `skill-resolution-order.md`, but it would be cleaner to have the system prompt updated upstream. Out of scope here; flagging for future agent-config work.

## Log

- 2026-05-24 03:50Z (Nate correction): "alex you wrote to the project memory bad job. Add a hook that prevents you from writing markdown files in `$CLAUDE_CONFIG_DIR/projects/**/*.md`, I don't wanna see any memory there."
- 2026-05-24 03:55Z (alex): hook landed ([`#intro#10`](../MASTER.md#intro)), proposed three new-location options on Discord.
- 2026-05-24 03:56Z (Nate): "the repo. You have to be able to send me links to them so on machine is not an option."
- 2026-05-24 03:58Z (alex): migrated 28 files via `mv`, removed empty source dir, updated coach + added rule, commit 4efbd3e on alex/main.
- 2026-05-24 04:00Z (alex): added retroactive tracking entry in MASTER.md as `#intro#9` per Nate's "track everything" directive.
