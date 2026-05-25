> The following is the contents of the file as previously lived in docs/project-tracking/task-summary/xxxx.md. To triage this ticket, we'll need to appropriately file this as an actual ticket within the appropriate project.
> Review the summary, and MASTER.md, and build out the ticket to triage.
> Then, get the triage request to the actual ticket(s) in triage state and in the correct project(s). This will likely be one ticket per file for now, but you may choose to make more than one if you deem appropriate.
> The ticket should capture this original summary, and the original messaging as it appears in MASTER.md. It MUST also be linked to the appropriate milestone.
> When the ticket is ready, in the triage state, and is confirmed to have the needed information, update master.md appropriately to link to the ticket instead of keeping info in master.md. The link should be: `[$emojiState | $ticketShortDescription](relative/link/to/file/that/works/on/github/and/local/instead/of/link/to/github/directly.md)` the ticket short description.


---

# Block markdown writes under `$CLAUDE_CONFIG_DIR/projects/`

**Track-doc item:** `I4` — [`#intro` / I4](../MASTER.md#intro) (was list-position #10 before completed items were hoisted on 2026-05-24 04:05Z per `#rules` Rule 2; assigned stable ID `I4` per `I6` on 2026-05-24)
**Status:** ✅ done
**Owner:** alex

## Original message

> alex you wrote to the project memory bad job. Add a hook that prevents you from writing markdown files in `$CLAUDE_CONFIG_DIR/projects/**/*.md`, I don't wanna see any memory there.

— Nate, Discord 2026-05-24 03:50Z. Task added retroactively to MASTER.md; no pre-N2 MASTER.md bullet exists with verbatim handler text (alex-written tracking entry). Verified from I4 Log.

## Deliverable

- A `PreToolUse` hook on `Write|Edit|MultiEdit` blocks any attempt to write a `.md` file under `$CLAUDE_CONFIG_DIR/projects/`.
- Hook is in alex repo at `.claude/hooks/block-claude-projects-md-writes.sh`, wired via `.claude/settings.json`.
- Coach message in the block points the agent at the canonical memory location (`/home/nsheaps/src/nsheaps/.ai-agent-alex/memory/`).

## Validation

- `bash .../block-claude-projects-md-writes.sh` self-test:
  - JSON for `Write` to `$CLAUDE_CONFIG_DIR/projects/foo/bar.md` → exit 2 + coach message.
  - JSON for `Write` to `/tmp/foo.md` → exit 0.
  - JSON for `Write` to `$CLAUDE_CONFIG_DIR/projects/foo/bar.txt` → exit 0 (only `.md` is blocked).
- End-to-end: a real `Write` tool call to `/home/nsheaps/.agents/alex/.claude/projects/test-block/dummy.md` returned `PreToolUse:Write hook error` with the coach text, no file written.

## Implementation

1. Write `.claude/hooks/block-claude-projects-md-writes.sh` reading JSON stdin, matching `tool_name in (Write|Edit|MultiEdit)` + `file_path` prefix `$projects_dir/` + suffix `.md`.
2. `chmod +x` the script.
3. Add a `hooks.PreToolUse` block to `.claude/settings.json` referencing the script via `${CLAUDE_PROJECT_DIR}/.claude/hooks/...`.
4. Self-test all three branches; end-to-end test with a real `Write`.

Alex commits: [`60163ca`](https://github.com/nsheaps/.ai-agent-alex/commit/60163ca) (hook + wiring), [`4efbd3e`](https://github.com/nsheaps/.ai-agent-alex/commit/4efbd3e) (coach message updated after Nate's "repo, not on-machine" clarification).

## Scope guardrails

- Hook only blocks `.md`. Other extensions under `$CLAUDE_CONFIG_DIR/projects/` (jsonl transcripts, env files, shell snapshots) are claude-internal and must remain writable.
- Hook is `Write|Edit|MultiEdit` only — NOT `Bash` (which can still `mv`/`cp` into the dir if explicitly needed for transcript management, though that's not expected).
- Existing transcripts (`*.jsonl`) in the dir are not affected — the block is per-write-attempt, not retroactive.

## Open questions

- None.

## Log

- 2026-05-24 03:50Z (Nate correction): asked for the hook.
- 2026-05-24 03:55Z (alex): hook + settings wiring landed, self-tested + end-to-end verified, commit 60163ca on alex/main.
- 2026-05-24 03:58Z (alex): coach message updated to point at repo `memory/` location, commit 4efbd3e.
- 2026-05-24 04:00Z (alex): retroactive tracking entry added in MASTER.md as `#intro#10`.
