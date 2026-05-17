# task-utils

Task discipline hooks and the `manage-tasks` skill — packages the workflow originally proven out in [nsheaps/.ai-agent-alex](https://github.com/nsheaps/.ai-agent-alex).

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

**Skill**:

- **`manage-tasks`** — doctrine for the atomicity check, breakdown pattern, status-transition table, validation-steps mechanism, background-subagent (`AGENT(<n>)`) prefix, MONITORING(<monitor-id>) prefix, and behavior-changing-jumps-the-queue rule. Forks into an isolated context via `context: fork` so the parent's window stays lean and returns a ≤5-sentence imperative instruction.

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

The two PreToolUse hooks register automatically; the skill is available as `Skill(manage-tasks)`.

## Design

Full spec: [docs/specs/draft/task-discipline-plugin.md on alex/main](https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/specs/draft/task-discipline-plugin.md).

Worked example for the breakdown pattern: [nsheaps/agents/docs/journal/2026/05/16/managing-tasks-example.md](https://github.com/nsheaps/agents/blob/main/docs/journal/2026/05/16/managing-tasks-example.md).
