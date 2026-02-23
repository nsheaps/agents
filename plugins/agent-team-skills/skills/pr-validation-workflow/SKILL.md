# Validating and Merging PRs as a Team

How the agent team coordinates PR review, validation, and merge.

## Team PR Workflow

```
Author (software-eng)
  1. Implements changes on a feature branch
  2. Opens a draft PR immediately on first commit
  3. Notifies PM and QA when ready for review

QA (quality-assurance)
  4. Validates the PR against spec and quality standards
  5. Reports pass/fail to PM and author

PM (project-manager)
  6. Coordinates merge when QA approves
  7. Marks related tasks complete
```

The author does not self-merge. The PM coordinates merge timing to avoid conflicts with other in-flight PRs.

## Opening a Draft PR

Open a draft PR on the first commit -- do not wait until all work is complete:

```bash
git add <files>
git commit -m "feat: initial implementation of X"
git push -u origin <branch-name>
gh pr create --draft \
  --title "feat: short description under 70 chars" \
  --body "$(cat <<'EOF'
## Summary
- What this PR does (1-3 bullets)

## Test plan
- [ ] TODO: add test plan items

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Assign the PR to the appropriate reviewer immediately after opening it.

## What QA Validates

Before marking a PR as ready to merge, QA checks:

### 1. Lint and formatting pass

```bash
bun run fmt
bun run check
```

All files in the PR must pass prettier and any lint rules. If they don't, do not approve -- send back to the author to fix.

### 2. No unrelated changes

List all changed files in the PR:

```bash
gh pr diff <number> --name-only
```

Every file listed should be directly related to the PR's stated purpose. Unrelated changes (auto-formatted files, unrelated refactors, CI tweaks from a different task) must be removed before merge.

Common sources of unrelated changes:
- Prettier ran on files outside the PR scope
- A previous stash was accidentally included
- The branch was rebased onto a branch that had other changes

To restore an unrelated file to its base branch state:

```bash
git checkout origin/main -- <file>
git add <file>
git commit -m "chore: restore unrelated file to main state"
```

### 3. Spec compliance

Compare the PR changes to the relevant spec in `docs/specs/`. The implementation should match the spec. If there is no spec for this change, ask the PM or team lead whether one is needed.

### 4. Test coverage

For code changes: verify tests exist for the new behavior. The PR should not reduce test coverage. New edge cases introduced by the change should have corresponding tests.

## PR Description Format

Every PR description must follow this structure:

```markdown
## Summary
- What this PR does (1-3 bullets)
- Scope of the change
- Any notable decisions or tradeoffs

## Test plan
- [ ] Specific thing to verify
- [ ] Another thing to verify
- [ ] Edge case to confirm

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Update the description every time you push new commits. The description should always reflect the current state of the PR -- not a changelog of what changed since the last update.

## Link Format in PR References

When linking to PRs in messages, commit descriptions, or documentation, always use the format `repo#number` in the link text:

```markdown
[agent-team#81](https://github.com/nsheaps/agent-team/pull/81)
[agent-team#42](https://github.com/nsheaps/agent-team/issues/42)
```

Not:
```markdown
[PR #81](https://github.com/nsheaps/agent-team/pull/81)   -- missing repo name
[#81](https://github.com/nsheaps/agent-team/pull/81)      -- too ambiguous
```

This format makes references unambiguous when reading logs, slack messages, or multi-repo contexts.

## Stacked PRs

When work depends on a prior PR that is not yet merged, stack the branches:

```bash
# PR A is on branch feat/a (targets main)
# PR B depends on PR A -- target PR A's branch, not main

git checkout feat/a
git checkout -b feat/b
# ... make changes ...
git push -u origin feat/b
gh pr create --base feat/a --title "feat: PR B depends on PR A" --body "..."
```

When PR A merges, update PR B's base branch:

```bash
gh pr edit <B-number> --base main
git rebase main feat/b
git push --force-with-lease origin feat/b
```

**Warning**: force-pushing a stacked PR after rebase will rewrite history. Only do this before PR B has been reviewed. After review, prefer merge commits to avoid rewriting history reviewers have already seen.

## Moving from Draft to Ready

Move the PR from draft to ready only when:

- All planned work is complete
- `bun run fmt && bun run check` passes locally
- You have self-reviewed the diff (`gh pr diff <number>`)
- No unrelated changes are present
- The test plan in the description is filled out

```bash
gh pr ready <number>
```

Then notify QA via `SendMessage` that the PR is ready for review, including the PR link.

## Merge Coordination

The PM coordinates merge order to avoid conflicts. Before merging, confirm:

1. QA has approved (or the PR has the required review approvals)
2. CI checks are passing -- `gh pr checks <number>`
3. No merge conflicts -- `gh pr view <number> --json mergeable`

To merge:

```bash
gh pr merge <number> --squash --delete-branch
```

Use squash merge by default to keep `main` history clean. Use merge commits only when preserving commit history for a feature branch is important.

## References

- [pr-workflow rule](https://github.com/nsheaps/ai-mktpl/blob/main/.ai/rules/pr-workflow.md) -- standing orders for PR workflow
- [GitHub CLI PR docs](https://cli.github.com/manual/gh_pr)
- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
