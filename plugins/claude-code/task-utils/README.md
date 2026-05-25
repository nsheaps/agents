# task-utils

Task discipline hooks and the `task-manage` skill (renamed from `manage-tasks` per noun-verb naming convention) — packages the workflow originally proven out in [nsheaps/.ai-agent-alex](https://github.com/nsheaps/.ai-agent-alex).

## What it provides

**Hooks** (PreToolUse):

- **`task-invariant.sh`** — gates `TaskCreate` / `TaskUpdate`:
  - Enforces 0-or-1 task in `in_progress` at any time.
  - Rejects `TaskCreate` with `status=in_progress` (tasks must enter `pending` first).
  - Parses `<validation-steps>` blocks from task descriptions and requires `RESULT(...)` lines on every checked `- [x]` step before allowing `* → completed`.
  - Emits lifecycle coach messages (STARTED / COMPLETED) after allowed transitions.
  - On TaskCreate, emits a `BEHAVIOR_CHANGING_COACH` reminding the agent that skill/plugin/hook updates jump the queue rather than being end-of-list ticketed.

- **`require-task-in-progress.sh`** — gates `Write` / `Edit` / `MultiEdit` / `NotebookEdit`:
  - Denies the write tool if no task is currently `in_progress`. Keeps file edits attached to a tracked unit of work.
  - **Known soft spot:** the `Bash` tool is NOT in the PreToolUse write-tool set (Claude Code limitation — Bash isn't in the matched set). So `bash -c 'cat > foo.txt'`, `sed -i`, `tee`, etc. bypass this gate. The invariant is "edits via Claude's native write tools require an in_progress task"; file writes via shell commands are not gated and rely on agent discipline alone.

**Skill**:

- **`task-manage`** — doctrine for the atomicity check, breakdown pattern, status-transition table, validation-steps mechanism, background-subagent (`AGENT(<n>)`) prefix, MONITORING(<monitor-id>) prefix, and behavior-changing-jumps-the-queue rule. Forks into an isolated context via `context: fork` so the parent's window stays lean and returns a ≤5-sentence imperative instruction.

## Installation

Add to your `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "task-utils@agents": true
  },
  "extraKnownMarketplaces": {
    "agents": {
      "source": { "source": "github", "repo": "nsheaps/agents" }
    }
  }
}
```

Then in a fresh session:

```bash
claude plugin install task-utils@agents
```

The two PreToolUse hooks register automatically; the skill is available as `Skill(task-manage)` (was `Skill(manage-tasks)` pre-rename).

## Design

Worked example for the breakdown pattern: [nsheaps/agents/docs/journal/2026/05/16/entry002-managing-tasks-example.md](https://github.com/nsheaps/agents/blob/main/docs/journal/2026/05/16/entry002-managing-tasks-example.md).

**Internal reference (private):** the full spec lives at `docs/specs/draft/task-discipline-plugin.md` and `docs/specs/draft/manage-tasks-skill.md` in the `nsheaps/.ai-agent-alex` private repo where the workflow was proven out. The behavior is fully documented in the SKILL.md doctrine sections in this plugin; the spec drafts are mainly useful for the design rationale + change history.
