Generate a mermaid dependency-graph markdown file from the task system (task-utils plugin or a Task\* hook in alex's repo), showing all tasks and their dependencies, colored by status, filtered to actionable leaf nodes.

## What was asked

When a task-lifecycle hook fires, produce (or regenerate) a markdown file containing a [Mermaid](https://mermaid.js.org/) `flowchart` or `graph` diagram that:

1. **Shows every task as a node** — the node label includes the task title and links to the per-task doc URL (GitHub URL or relative file path).
2. **Colors nodes by status** — e.g.
   - `pending` → grey / white
   - `in_progress` → blue
   - `completed` → green
   - `blocked` → red / orange
3. **Shows `blocks` / `blockedBy` edges** — tasks already have these dependency fields; the graph encodes them as directed edges.
4. **Filters to leaf/terminal tasks only** — omit any task that is an ancestor of a `pending` or `in_progress` task. In other words: only show tasks where no descendant is still in flight. These are the currently-visible work items that an agent (or human) could pick up today.

The output file location is TBD at triage — candidates include `.claude/task-graph.md`, `docs/tasks/dep-graph.md`, or an ephemeral rendered artifact.

## Context

- Task docs have frontmatter fields including `status`, `blocks` (list of task IDs this task is blocking), and `blockedBy` (list of task IDs blocking this one).
- The hook should run on any task status transition so the graph stays current.
- The feature is primarily for the agents repo / alex's task-utils usage, but should generalise to any agent using task-utils.
- Mermaid is already rendered natively by GitHub markdown, so a `.md` file with a fenced ` ```mermaid ``` ` block is sufficient for visualisation without a separate build step.

## Implementation paths to research at triage

- **Hook location**: PostToolUse hook on task-manage skill calls vs. a dedicated `task-graph` command/skill in task-utils.
- **Rendering approach**: write a shell script or Node.js/Python helper that walks task frontmatter and emits mermaid syntax; invoke from the hook.
- **Filter algorithm**: reverse-adjacency traversal — mark any task that has a descendant with `status: pending | in_progress` as "hidden"; show only unmarked tasks.
- **Link syntax in Mermaid**: use `click <nodeId> href "<url>"` statements to make nodes clickable.

## Open questions for triage

1. **Scope** — alex's repo only, or ship in the task-utils plugin for all agents?
2. **Trigger** — every task state change (PostToolUse), or on-demand command, or both?
3. **Output file** — committed to the repo, or written to `.claude/tmp/` as a scratch artifact?
4. **Filter depth** — should _completed_ parent tasks be shown (as "done" ancestry context) or fully hidden? Nate's ask says omit parents of pending/in-progress tasks, but completed parents of completed leaves may add useful context.
5. **Plugin home** — task-utils is the logical home; if so, this needs a PR against `ai-mktpl`. Alternatively, prototype locally in `.claude/skills/task-graph/` first (per skill-resolution-order rules) and upstream later.

## Priority

Default **4** (nice-to-have tooling improvement — not blocking any current work).

## Source

Nate, Discord [2026-05-28 ~01:08Z](https://discord.com/channels/1490863845252665415/1497431286661517353) — chat 1497431286661517353.
Follow-up authorization at 2026-05-28 01:34Z: "sure if you wanna go through the gsd ticket process lets do that in parallel with a sub-agent."

## Related

- task-utils plugin (`ai-mktpl`) — task lifecycle hooks and task-manage skill
- `blocks` / `blockedBy` fields on task frontmatter (see `1779766960-task-hierarchy-blocking-relaxation.md` for related task-graph semantics work)
- Mermaid docs: https://mermaid.js.org/syntax/flowchart.html
