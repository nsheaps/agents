---
type: feature
id: GSD-59
legacy_ids:
  - "1779932231"
created: 2026-05-28T01:37:11Z
state: triage
project: GSD
priority: 4
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-initial-ask
    type: discord-message
    url: "https://discord.com/channels/1490863845252665415/1497431286661517353"
  - id: discord-refinement
    type: discord-message
    url: "https://discord.com/channels/1490863845252665415/1497431286661517353/1509373646945255565"
events:
  - {
      ts: 2026-05-28T02:02:32Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-59 (state=triage)",
    }
---

# GSD-59 — Task dep-graph mermaid

Generate a mermaid dependency-graph markdown file from the task system (task-utils plugin or a Task\* hook in alex's repo), showing all tasks and their dependencies, colored by status, filtered to actionable leaf nodes.

## Original ask

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

## Refinement [^discord-refinement]

> "for the task mermaid diagram, I'd also love to add some scope, that I want a second list that's just a list of the tickets in the order that they appear in your console"

In addition to the filtered mermaid graph, the same hook should emit a second flat list — every task in the order they appear in the agent's task console (i.e. the order returned by `TaskList`). This gives the handler a quick scroll-friendly view of what's queued without having to render the graph.

Both outputs should live in the same generated markdown file (or sibling files), updated by the same task-lifecycle hook.

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

## Related

- task-utils plugin (`ai-mktpl`) — task lifecycle hooks and task-manage skill
- `blocks` / `blockedBy` fields on task frontmatter (see GSD-52 for related task-graph semantics work)
- Mermaid docs: https://mermaid.js.org/syntax/flowchart.html

---

[^discord-initial-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353

[^discord-refinement]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509373646945255565
