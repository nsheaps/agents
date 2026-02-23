# Handling Prettier/Lint Failures Across PRs

How to find and fix formatting failures before pushing and after CI reports them.

## Standing Order: Run `bun run fmt` Before Every Push

**Always** run the project formatter before pushing:

```bash
bun run fmt
```

This runs prettier over all project files and writes the formatted output in place. Do this before every `git push`, not just when you think something changed. Formatting drift is invisible until CI fails.

After running `bun run fmt`, check for changes:

```bash
git diff --name-only
```

If files changed, stage and commit them:

```bash
git add <changed files>
git commit -m "chore: fix prettier formatting"
git push
```

## When Lint Fails in CI

If CI reports a prettier failure, run the formatter on the affected files and push a fix commit.

### Step 1 -- Identify which files need fixing

**Option A** -- check CI output for the specific failing files (fastest when CI reports them explicitly).

**Option B** -- run prettier check mode to find all failures:

```bash
npx prettier --check .
```

This prints a list of files that would be reformatted. No files are changed.

**Option C** -- scope to only PR-changed files (recommended when fixing a specific PR):

```bash
git diff --name-only main...HEAD
```

This lists all files changed in the current branch relative to `main`. Run prettier only on those files to avoid formatting unrelated files in the same commit.

### Step 2 -- Fix the files

Fix only the files that the PR actually changed. Do not run `npx prettier --write .` on the entire repository -- that adds unrelated formatting changes to the PR.

```bash
# Fix only PR-changed files
git diff --name-only main...HEAD > /tmp/changed-files.txt
npx prettier --write $(cat /tmp/changed-files.txt | tr '\n' ' ')
```

Or fix specific file types only:

```bash
npx prettier --write "src/**/*.ts" "bin/**/*.sh"
```

### Step 3 -- Verify the fix

```bash
npx prettier --check .
```

Should report no failures. If it still fails, check whether there are files outside the PR scope that need fixing (run prettier on the full repo to verify, then decide whether to fix them in this PR or a separate cleanup commit).

### Step 4 -- Commit the fix

Use the standard commit message pattern for formatting fixes:

```bash
git add <formatted files>
git commit -m "chore: fix prettier formatting"
git push
```

Do NOT mix formatting fixes with functional changes in the same commit. Keep them separate so reviewers can easily identify what actually changed vs. what was just reformatted.

## Identifying Changed Files by PR

The core command to identify which files your PR changes:

```bash
git diff --name-only main...HEAD
```

This uses the three-dot `...` syntax (not two-dot `..`), which finds the common ancestor of `main` and `HEAD` and compares from there. This is correct even if your branch has been rebased recently.

If you are on a branch that does not track `main`, substitute the appropriate base branch:

```bash
git diff --name-only origin/main...HEAD
```

## Parallel Fixes Across Multiple PRs

When multiple PRs have lint failures at the same time, fix each in its own worktree to avoid cross-contamination:

### Set up a worktree per PR

```bash
# For PR #42 on branch feat/some-feature
git worktree add ../repo.worktrees/pr-42-lint feat/some-feature

# For PR #43 on branch feat/other-feature
git worktree add ../repo.worktrees/pr-43-lint feat/other-feature
```

### Fix and push each independently

```bash
# In worktree for PR 42
cd ../repo.worktrees/pr-42-lint
git diff --name-only main...HEAD > /tmp/changed-42.txt
npx prettier --write $(cat /tmp/changed-42.txt | tr '\n' ' ')
git add -p
git commit -m "chore: fix prettier formatting"
git push

# In worktree for PR 43
cd ../repo.worktrees/pr-43-lint
git diff --name-only main...HEAD > /tmp/changed-43.txt
npx prettier --write $(cat /tmp/changed-43.txt | tr '\n' ' ')
git add -p
git commit -m "chore: fix prettier formatting"
git push
```

### Clean up worktrees when done

```bash
git worktree remove ../repo.worktrees/pr-42-lint
git worktree remove ../repo.worktrees/pr-43-lint
```

## Pre-Push Checklist

Before every `git push`:

- [ ] `bun run fmt` -- run formatter and stage any changes
- [ ] `bun run check` -- run lint and type checks
- [ ] `git diff --name-only` -- verify no unrelated files were changed by the formatter
- [ ] `git status` -- confirm working directory is clean
- [ ] Review `git log --oneline -5` -- confirm commit history looks right

If `bun run fmt` is not available in this project, use:

```bash
npx prettier --write .
```

## Common Causes of Unexpected Formatting Failures

| Cause                                    | Fix                                                              |
| :--------------------------------------- | :--------------------------------------------------------------- |
| Forgot to run `bun run fmt` before push  | Run it now, commit the fix                                       |
| Editor auto-formatter conflicts          | Configure editor to use the project's prettier config            |
| Newer prettier version reformats more    | Run `bun run fmt`, review diff, commit                           |
| Tabs vs spaces in a new file             | Run `bun run fmt` -- prettier enforces consistent style          |
| Trailing whitespace or end-of-file issues | Run `bun run fmt` -- prettier handles these                     |

## References

- [Prettier CLI docs](https://prettier.io/docs/en/cli.html)
- [pr-workflow rule](https://github.com/nsheaps/ai-mktpl/blob/main/.ai/rules/pr-workflow.md) -- "Keep PRs Focused" section on removing unrelated changes
- [PR Validation Workflow Skill](../pr-validation-workflow/SKILL.md) -- QA checklist for PR review
