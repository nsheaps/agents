---
name: verify-completion-evidence
description: Enforces that task completion messages include concrete evidence (commit hash, artifact path, or PR link) when the task involves code or file changes. Use when marking any code-related task as completed.
---

# Verify Completion Evidence

When marking a task as completed, the completion message **must** include concrete evidence that the work was actually done. "I made the changes" is not evidence. A commit hash is.

## When to Use

- Marking any task as completed that involved code changes, file edits, or artifact creation
- Reviewing another agent's task completion claim
- Self-checking before sending a "done" message to the team lead or PM

## Rule

If a task involves code or file changes, the completion message MUST include at least one of:

| Evidence Type | Example |
|:-------------|:--------|
| Commit hash | `Committed as abc1234` |
| Artifact path | `Report saved to .claude/tmp/review.md` |
| PR link | `PR #42 created` |
| File + line | `Fixed in src/lifecycle.ts:47` |

**No evidence = not done.** Do not mark the task complete. Instead, go back and verify the change landed.

### PR-specific: CI status is required

If the task involves a PR (creating, reviewing, or declaring "ready to merge"), the completion message MUST also include CI status:

| CI State | What to report | Can you declare ready? |
|:---------|:---------------|:----------------------|
| All checks passing | `CI green — gh pr checks #42 all passing` | Yes |
| Checks pending | `CI pending — waiting on [check name]` | No — wait |
| Checks failing | `CI failing — [check name] failed` | No — fix first |
| No checks configured | `No CI checks on this repo` | Yes (note it) |

**CI green is a prerequisite for "ready to merge."** Code review approval alone is not sufficient. Run `gh pr checks <number>` and include the result. If CI is failing or pending, the PR is not ready regardless of code quality.

## Procedure

### Before marking a task complete:

1. **Identify what changed**: Which files were created, modified, or deleted?
2. **Verify the change exists**: Read the file or run `git log --oneline -1` to confirm
3. **Capture the evidence**: Copy the commit hash, file path, or PR URL
4. **Include it in the completion message**: The evidence goes in the message to the team lead, PM, or task update

### If you can't find evidence:

1. **Check git status**: Did you forget to commit?
2. **Check git log**: Did the commit get lost in a rebase or reset?
3. **Check the file**: Does it actually contain your changes?
4. **If the change is missing**: Do not mark complete. Redo the work and commit it.

## Anti-Patterns

| Bad | Why | Good |
|:----|:----|:-----|
| "Done!" | No evidence | "Done — committed as `d9370f8`, pushed to main" |
| "Fixed the bug" | No proof it's fixed | "Fixed in `src/lifecycle.ts:47`, commit `a1b2c3d`" |
| "Created the report" | Where? | "Report saved to `.claude/tmp/swarm-review-coach.md`" |
| "Task complete" | Assertion without proof | "Task complete. PR #42 merged, commit `e4963db`" |

## Edge Cases

- **Research or analysis tasks** (no code changes): Evidence is the artifact file path. If the research was verbal-only, summarize findings in a file first.
- **Process tasks** (e.g., "review X"): Evidence is the review artifact or the message sent with findings.
- **Failed tasks**: Do not mark complete. Update the task with what went wrong and what remains.

## Origin

Created after Failure #14 — a task was marked complete but the fix was never committed. The file still contained the old code. This behavior prevents recurrence by requiring proof before claiming "done."

Updated after Failure #16 — PR #164 was declared "ready to merge" by both reviewer and author without checking CI status. The user caught the gap. CI verification is now a required evidence type for PR-related tasks.

## References

- Failure #14: `.claude/tmp/ai-agent-eng-failure-log.md`
- Failure #16: `.claude/tmp/ai-agent-eng-failure-log.md`
- Related rule: `never-say-done-prematurely` (ai-mktpl `.ai/rules/`)
- Related rule: `code-quality.md` — "Validation is considered a failure if CI fails"
