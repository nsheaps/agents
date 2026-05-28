# Version Prompt Tracking

Standing behavior for the AI Agent Eng: track Claude Code system prompt changes across versions.

## Trigger

Run this behavior when you detect a new Claude Code version via any of:

- Changelog mention in session start context
- Update notification from a teammate or the user
- Session start showing a different version than the last recorded one
- Explicit request from team lead or user

## Process

1. **Identify the new version number** from the trigger source

2. **Check if already extracted**:

   ```bash
   ls docs/research/prompts-<version>.md
   ```

   If file exists, skip — already captured.

3. **Run cchistory** (see `.claude/skills/cchistory.md` for full details):

   ```bash
   cd /Users/nathan.heaps/src/nsheaps/agent-team
   CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 cchistory <version> --claude-args '--dangerously-skip-permissions'
   ```

4. **Move output to permanent location**:

   ```bash
   mv prompts-<version>.md docs/research/prompts-<version>.md
   ```

5. **Diff against previous version** (if one exists):

   ```bash
   diff docs/research/prompts-<previous-version>.md docs/research/prompts-<version>.md > .claude/tmp/prompt-diff-<previous>-to-<version>.md
   ```

6. **Analyze the diff** for changes that affect:
   - Agent team instructions (TeamCreate, SendMessage, task tools)
   - Tool definitions (new tools, removed tools, changed parameters)
   - Permission model changes
   - Any behavioral changes that would affect agent definitions

7. **Record findings** — if significant changes found:
   - Save analysis to `docs/research/prompt-changes-<version>.md`
   - Notify team lead with a summary
   - If changes affect agent definitions, create a task to update them

## Output Location

| Artifact              | Location                                    |
| --------------------- | ------------------------------------------- |
| Raw prompt extraction | `docs/research/prompts-<version>.md`        |
| Diff between versions | `.claude/tmp/prompt-diff-<old>-to-<new>.md` |
| Change analysis       | `docs/research/prompt-changes-<version>.md` |

## Why This Matters

The system prompt is the foundation for all agent behavior. Changes to it can silently alter how agents work, break assumptions in agent definitions, or introduce new capabilities we should leverage. Tracking these changes gives us early warning and an audit trail.

## References

- [cchistory skill](./../skills/cchistory.md)
- [Road Runner's cchistory research](../../docs/research/cchistory.md)
- [cchistory web UI](https://cchistory.mariozechner.at/) — auto-updates every 30 min, useful for quick comparison
