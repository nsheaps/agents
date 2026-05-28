## Managing Previous Reviews and Threads

### Minimizing your previous comments (NOT review threads)

Only minimize your own PR comments (general comments), not review threads on specific lines.
Never minimize or hide comments from other users.

- Get your comment IDs: `gh pr view <PR_NUMBER> --json comments`
- Minimize using graphql API with OUTDATED classifier:
  ```bash
  gh api graphql -f query='
    mutation {
      minimizeComment(input: {
        subjectId: "<COMMENT_ID>"
        classifier: OUTDATED
      }) {
        minimizedComment { isMinimized minimizedReason }
      }
    }'
  ```

### Resolving review threads

Review threads (inline comments on specific lines) should be RESOLVED, not minimized/hidden.
Use `gh pr-review review view "$(gh pr view --json url --jq .url)"` to list review threads.

**Resolve when:**

- The issue has been fixed in new commits
- The author addressed the feedback adequately
- The comment is no longer applicable due to code changes

**Do NOT resolve:**

- Comments praising good design choices (leave visible)
- Ongoing conversations that haven't concluded
- Issues that still need to be addressed
- Follow-up items at any priority level (keep visible)

**Other users' threads:** Never resolve them. If you believe one is addressed, comment explaining why with links to code, and let the original commenter resolve it.

```bash
gh api graphql -f query='
  mutation {
    resolveReviewThread(input: {
      threadId: "<THREAD_ID>"
    }) { thread { isResolved } }
  }'
```

### Updating existing comments

Use `gh api` to UPDATE comment bodies rather than posting new ones.
Add an "**Edit:**" section at the bottom:

```bash
gh api graphql -f query='
  mutation {
    updateIssueComment(input: {
      id: "<COMMENT_ID>"
      body: "Updated body here"
    }) { issueComment { id body } }
  }'
```
