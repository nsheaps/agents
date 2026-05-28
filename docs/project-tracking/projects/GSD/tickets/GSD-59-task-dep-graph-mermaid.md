---
type: feature
id: GSD-59
legacy_ids:
  - "1779932231"
created: 2026-05-28T01:37:11Z
state: in-progress
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
  - {
      ts: 2026-05-28T02:15:00Z,
      by: alex-picard,
      change: "state=triage → in-progress — prototype skill built at .claude/skills/task-graph/ in alex repo; demo run generated 791-line output at .claude/tmp/task-graph.md; all 5 OQs resolved",
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

## Implementation — Prototype (2026-05-28)

### What was built

**Skill**: `.claude/skills/task-graph/` in alex's repo (`/home/nsheaps/src/nsheaps/.ai-agent-alex/`)

Files:

- `SKILL.md` — skill descriptor, invoke with `Skill(task-graph)`
- `generate.sh` — shell script wrapping a Python generator; reads from `$CLAUDE_CONFIG_DIR/tasks/$CLAUDE_CODE_TASK_LIST_ID/*.json`

**Output**: `$CLAUDE_CONFIG_DIR/tmp/task-graph.md` (ephemeral, not committed)

**Demo run results** (2026-05-28T02:12Z):

- Total tasks: 623 (572 completed, 49 pending, 2 in_progress)
- Leaf tasks in graph: 47 (pending/in_progress tasks with no pending/in_progress descendants)
- Edges in graph: 0 (all 47 leaf tasks are independent — no edges between terminal nodes)
- Output file: 791 lines

### Open questions — resolved

**OQ1: Scope** → Local skill in alex repo at `.claude/skills/task-graph/`. Follow-up: upstream to `task-utils` plugin in ai-mktpl. Marked with `<!-- UPSTREAM: task-utils -->` in SKILL.md.

**OQ2: Trigger** → On-demand skill (invoke as `Skill(task-graph)`). Hook integration (PostToolUse on TaskCreate/TaskUpdate) is a follow-up — not built now.

**OQ3: Output file** → `$CLAUDE_CONFIG_DIR/tmp/task-graph.md` (per no-system-tmp rule, NOT committed). Ephemeral, regenerated on each invocation.

**OQ4: Filter depth** → Completed parents of completed leaves are HIDDEN. Algorithm: a task is shown in View 1 if and only if (a) its status is not `completed`, AND (b) it has no pending/in_progress descendant (via DFS on `blocks` edges). All completed tasks are hidden from View 1.

**OQ5: Plugin home** → Same as OQ1 — alex local first, task-utils eventually.

### What is NOT yet done (follow-up work)

- **Hook trigger**: Wire skill to PostToolUse on TaskCreate/TaskUpdate so graph regenerates automatically on task state changes.
- **Plugin upstream**: Migrate to `task-utils` plugin in ai-mktpl once skill stabilizes.
- **GitHub URL mapping**: Current links use `https://github.com/nsheaps/.ai-agent-alex/issues/<id>` which assumes task IDs = GitHub issue numbers. This may not hold for all agents.
- **Configurable output path**: Hardcoded to alex's task list; needs parameterization for multi-agent use.

## Related

- task-utils plugin (`ai-mktpl`) — task lifecycle hooks and task-manage skill
- `blocks` / `blockedBy` fields on task frontmatter (see GSD-52 for related task-graph semantics work)
- Mermaid docs: https://mermaid.js.org/syntax/flowchart.html

---

[^discord-initial-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353

[^discord-refinement]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509373646945255565
