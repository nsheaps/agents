---
name: task-subject-formatting
description: Convention for task subject formatting to ensure scannable, cross-referenceable task lists. Use whenever creating tasks via TaskCreate — immediately update the subject with the assigned ID prefix.
---

# Task Subject Formatting

All task subjects must include the `#ID:` prefix for cross-referenceability.

## Purpose

Task subjects appear in TaskList output, messages, reviews, and failure logs. Without a consistent ID prefix, tasks are harder to reference in conversation ("the task about incremental design" vs "#108"). This convention was lost after a compaction event (Failure #10) because it was only in working memory.

## The Convention

Task subjects follow this format:

```
#<ID>: <Imperative description>
```

Examples:
- `#108: Create incremental design behavior`
- `#117: Review agent launcher against claude-team for gaps`
- `#49: Verify Foghorn's #42 and #43 deliverables`

## Steps

`TaskCreate` does not accept an ID — it assigns one on creation. So the convention requires a two-step process:

1. **Create the task** with a descriptive subject (no ID yet):
   ```
   TaskCreate(subject: "Create incremental design behavior", ...)
   → Returns: "Task #108 created successfully"
   ```

2. **Immediately update the subject** with the assigned ID:
   ```
   TaskUpdate(taskId: "108", subject: "#108: Create incremental design behavior")
   ```

Do this for EVERY task you create. The update should be the very next tool call after creation — before any other work.

## When to Skip

- You may skip the prefix for throwaway or very short-lived tasks (e.g., a task you'll complete in the same turn)
- Never skip for tasks assigned to other teammates — they need the ID for cross-referencing

## Anti-Patterns

- Creating tasks without updating the subject with the ID prefix
- Using inconsistent formats (`Task #108`, `[108]`, `108:` — always use `#108:`)
- Batching multiple TaskCreate calls and forgetting to update subjects afterward
- Relying on memory for the convention instead of re-reading this behavior after compaction
