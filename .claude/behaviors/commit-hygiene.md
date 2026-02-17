---
name: commit-hygiene
description: Procedure for clean, logical git commits with conventional commit messages. Use every time you commit changes — no exceptions.
---

# Commit Hygiene

Procedure for creating clean, reviewable git commits. Every commit should tell a clear story about what changed and why.

## Purpose

Maintain a git history that is easy to review, bisect, revert, and understand. Clean commits make code review faster and debugging easier.

## When to Use

- Every time you commit changes
- When preparing work for a PR
- When multiple logical changes exist in the working tree

## Steps

1. **Review what changed** — Run `git status` and `git diff` before staging. Understand every change.

2. **Group logically** — Each commit should contain one logical change:
   - One feature, one bug fix, one refactor, or one doc update
   - If your working tree has multiple logical changes, make multiple commits
   - Stage specific files with `git add <file>` — avoid `git add -A` or `git add .`

3. **Check for sensitive files** — Never commit:
   - `.env` files or credentials
   - `settings.local.json` or personal config
   - Large binaries or lock files that shouldn't be tracked

4. **Write the commit message** — Use [conventional commits](https://www.conventionalcommits.org/):

   ```
   <type>: <description>

   [optional body explaining why, not what]
   ```

   Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

   The description should be imperative mood ("add feature" not "added feature"), lowercase, no period.

5. **Verify the commit** — After committing:
   - `git show --stat HEAD` — confirm only expected files are included
   - `git log --oneline -3` — confirm message looks right in context

6. **Push when appropriate** — Follow team conventions for when to push (immediately in CI, on request in interactive).

## Anti-Patterns

- Using `git add -A` or `git add .` without reviewing what's staged
- Committing unrelated changes together ("fix bug and also refactor utils")
- Vague commit messages ("fix stuff", "updates", "wip")
- Using `--amend` on pushed commits — create new commits instead
- Using `--force` push — use `--force-with-lease --force-if-includes` if absolutely necessary
- Committing without running the formatter first
- Skipping the post-commit verification step
